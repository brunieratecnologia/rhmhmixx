routerAdd(
  'POST',
  '/backend/v1/rh/fechamento/ajustar-ponto',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, {
        success: false,
        message: 'Não autenticado.',
      })
    }

    const role = auth.getString('role')
    if (role !== 'admin' && role !== 'rh') {
      return e.json(403, {
        success: false,
        message: 'Acesso negado. Apenas gestores e RH podem efetuar tratamentos de ponto.',
      })
    }

    const body = e.requestInfo().body || {}
    const funcionarioId = (body.funcionario || '').toString().trim()
    const dataRegistro = (body.data_registro || '').toString().trim() // YYYY-MM-DD
    const horaRegistro = (body.hora_registro || '').toString().trim() // HH:MM
    const tipo = (body.tipo || 'correcao').toString().trim() // correcao, justificativa, anulacao, etc.
    const tipoMarcacao = (body.tipo_marcacao || 'entrada').toString().trim()
    const justificativa = (body.justificativa || '').toString().trim()
    const registroOriginalId = (body.registro || '').toString().trim() // opcional ou obrigatório em anulação/correção
    const acaoTipo = (body.acao_tipo || (tipo === 'anulacao' ? 'anular' : 'incluir'))
      .toString()
      .trim() // 'incluir' | 'anular' | 'corrigir'

    if (!funcionarioId || !dataRegistro || !justificativa) {
      return e.json(400, {
        success: false,
        message: 'Funcionário, data de referência e motivo/justificativa são obrigatórios.',
      })
    }

    if ((acaoTipo === 'anular' || acaoTipo === 'corrigir') && !registroOriginalId) {
      return e.json(400, {
        success: false,
        message: 'Para anular ou corrigir uma marcação, identifique o registro a ser ajustado.',
      })
    }

    if (acaoTipo === 'corrigir' && !horaRegistro) {
      return e.json(400, {
        success: false,
        message: 'Informe o horário corrigido (formato HH:MM em 24h).',
      })
    }

    // 1. Validate employee exists
    let func = null
    try {
      func = $app.findRecordById('funcionarios', funcionarioId)
    } catch (_) {
      return e.json(404, {
        success: false,
        message: 'Funcionário não encontrado.',
      })
    }

    if (func.getString('situacao') === 'desligado') {
      return e.json(400, {
        success: false,
        message:
          'Não é permitido incluir ou alterar marcações de ponto para funcionários desligados.',
      })
    }

    // 2. Extract year and month from dataRegistro (YYYY-MM-DD)
    const parts = dataRegistro.split('-')
    if (parts.length !== 3) {
      return e.json(400, {
        success: false,
        message: 'Data de registro inválida. Use o formato AAAA-MM-DD.',
      })
    }
    const ano = parseInt(parts[0], 10)
    const mes = parseInt(parts[1], 10)

    // Check if month is in the future
    const now = new Date()
    const currentYear = now.getUTCFullYear()
    const currentMonth = now.getUTCMonth() + 1 // 1-12

    if (ano > currentYear || (ano === currentYear && mes > currentMonth)) {
      return e.json(400, {
        success: false,
        message: 'Não é permitido incluir ou tratar marcações em competências futuras.',
      })
    }

    // 3. Validação da competência:
    // O admin pode incluir/anular/corrigir marcações a qualquer momento no mês corrente e em meses anteriores.
    // Apenas se a folha da competência tiver sido encerrada ('fechado'), exige-se reabertura prévia do fechamento.
    let fechamentoRegistro = null
    try {
      const records = $app.findRecordsByFilter(
        'fechamentos_folha',
        'competencia_ano = ' + ano + ' && competencia_mes = ' + mes,
        '-created',
        1,
        0,
      )
      if (records && records.length > 0) {
        fechamentoRegistro = records[0]
      }
    } catch (_) {}

    if (fechamentoRegistro && fechamentoRegistro.getString('status') === 'fechado') {
      return e.json(403, {
        success: false,
        message:
          'A folha de ponto desta competência (' +
          mes +
          '/' +
          ano +
          ') já foi encerrada e está bloqueada para edições. Reabra o fechamento para efetuar novos ajustes.',
      })
    }

    const tratamentosCol = $app.findCollectionByNameOrId('tratamentos_ponto')
    const auditCol = $app.findCollectionByNameOrId('logs_auditoria')

    // Obter dados do registro original se informado
    let regOriginal = null
    let horaOriginalFormatada = ''
    if (registroOriginalId) {
      try {
        regOriginal = $app.findRecordById('registros_horario', registroOriginalId)
        const tsUtc = regOriginal.getString('timestamp_utc')
        if (tsUtc) {
          horaOriginalFormatada = tsUtc.slice(11, 16)
        } else {
          horaOriginalFormatada = (regOriginal.getString('hora_utc') || '').slice(0, 5)
        }
      } catch (_) {}
    }

    // OPERAÇÃO ATÔMICA: 'corrigir'
    // Anula o registro original + inclui a batida corrigida com vinculação mútua
    if (acaoTipo === 'corrigir') {
      let tratamentoAnulacaoId = ''
      let tratamentoCorrecaoId = ''

      $app.runInTransaction((txApp) => {
        const dataTratamentoISO = new Date().toISOString()

        // 1. Registro complementar de Anulação do original
        const tratAnulacao = new Record(tratamentosCol)
        tratAnulacao.set('funcionario', func.id)
        tratAnulacao.set('registro', registroOriginalId)
        tratAnulacao.set('tipo', 'anulacao')
        tratAnulacao.set('justificativa', justificativa)
        tratAnulacao.set('usuario_responsavel', auth.id)
        tratAnulacao.set('data_tratamento', dataTratamentoISO)
        tratAnulacao.set('data_registro', dataRegistro)
        if (horaOriginalFormatada) {
          tratAnulacao.set('hora_registro', horaOriginalFormatada)
        }
        tratAnulacao.set('origem_ajuste', 'anulacao_por_correcao')
        tratAnulacao.set(
          'informacao_corrigida',
          'Marcação original das ' +
            (horaOriginalFormatada || 'horário original') +
            ' anulada por motivo de correção para ' +
            horaRegistro +
            '. Motivo: ' +
            justificativa,
        )
        txApp.save(tratAnulacao)
        tratamentoAnulacaoId = tratAnulacao.id

        // 2. Registro complementar de Inclusão da batida corrigida
        const tratCorrecao = new Record(tratamentosCol)
        tratCorrecao.set('funcionario', func.id)
        tratCorrecao.set('registro', registroOriginalId) // Vincula ao registro original substituído
        tratCorrecao.set('tipo', 'correcao')
        tratCorrecao.set('justificativa', justificativa)
        tratCorrecao.set('usuario_responsavel', auth.id)
        tratCorrecao.set('data_tratamento', dataTratamentoISO)
        tratCorrecao.set('data_registro', dataRegistro)
        tratCorrecao.set('hora_registro', horaRegistro)
        if (tipoMarcacao) {
          tratCorrecao.set('tipo_marcacao', tipoMarcacao)
        }
        tratCorrecao.set('origem_ajuste', 'correcao_horario_batida')
        tratCorrecao.set(
          'informacao_corrigida',
          'Horário corrigido de ' +
            (horaOriginalFormatada || '--:--') +
            ' para ' +
            horaRegistro +
            ' (' +
            tipoMarcacao +
            '). Motivo: ' +
            justificativa,
        )
        txApp.save(tratCorrecao)
        tratamentoCorrecaoId = tratCorrecao.id

        // 3. Log de auditoria único
        try {
          const audit = new Record(auditCol)
          audit.set('usuario', auth.id)
          audit.set('acao', 'correcao_horario_ponto')
          audit.set('entidade', 'tratamentos_ponto')
          audit.set('entidade_id', tratCorrecao.id)
          audit.set(
            'detalhes',
            'Correção de batida de ponto para ' +
              func.getString('nome') +
              ' em ' +
              dataRegistro +
              ': horário original ' +
              (horaOriginalFormatada || '--:--') +
              ' corrigido para ' +
              horaRegistro +
              ' (' +
              tipoMarcacao +
              '). Registro original mantido imutável (anulado via tratamento ' +
              tratAnulacao.id +
              ', nova marcação via tratamento ' +
              tratCorrecao.id +
              '). Motivo: ' +
              justificativa,
          )
          audit.set('nivel', 'sensivel')
          audit.set('data', dataTratamentoISO)
          txApp.save(audit)
        } catch (_) {}
      })

      return e.json(200, {
        success: true,
        message:
          'Marcação corrigida com sucesso. O horário foi atualizado para ' +
          horaRegistro +
          ' e o registro original permanece preservado no histórico imutável.',
        tratamento_id: tratamentoCorrecaoId,
        tratamento_anulacao_id: tratamentoAnulacaoId,
      })
    }

    // OPERAÇÕES: 'anular' OU 'incluir'
    const novoTratamento = new Record(tratamentosCol)
    const ehAnulacao = acaoTipo === 'anular' || tipo === 'anulacao'
    const finalTipo = ehAnulacao ? 'anulacao' : tipo
    const finalOrigemAjuste = ehAnulacao ? 'anulacao_marcacao_indevida' : 'inclusao_ponto_faltante'

    novoTratamento.set('funcionario', func.id)
    if (registroOriginalId) {
      novoTratamento.set('registro', registroOriginalId)
    }
    novoTratamento.set('tipo', finalTipo)
    novoTratamento.set('justificativa', justificativa)
    novoTratamento.set('usuario_responsavel', auth.id)
    novoTratamento.set('data_tratamento', new Date().toISOString())
    novoTratamento.set('data_registro', dataRegistro)
    if (horaRegistro) {
      novoTratamento.set('hora_registro', horaRegistro)
    }
    if (!ehAnulacao && tipoMarcacao) {
      novoTratamento.set('tipo_marcacao', tipoMarcacao)
    }
    novoTratamento.set('origem_ajuste', finalOrigemAjuste)

    if (ehAnulacao) {
      novoTratamento.set(
        'informacao_corrigida',
        'Anulação de marcação errada por registro complementar em fechamento de folha: ' +
          dataRegistro +
          ' ' +
          (horaRegistro || '') +
          ' - Motivo: ' +
          justificativa,
      )
    } else {
      novoTratamento.set(
        'informacao_corrigida',
        'Inclusão de marcação complementar em fechamento de folha: ' +
          dataRegistro +
          ' ' +
          (horaRegistro || '') +
          ' (' +
          tipoMarcacao +
          ') - Motivo: ' +
          justificativa,
      )
    }

    $app.save(novoTratamento)

    // Audit log
    try {
      const audit = new Record(auditCol)
      audit.set('usuario', auth.id)
      audit.set('acao', ehAnulacao ? 'anulacao_ponto_fechamento' : 'ajuste_ponto_fechamento')
      audit.set('entidade', 'tratamentos_ponto')
      audit.set('entidade_id', novoTratamento.id)
      audit.set(
        'detalhes',
        (ehAnulacao ? 'Anulação de marcação de ponto' : 'Inclusão/ajuste de ponto complementar') +
          ' para o funcionário ' +
          func.getString('nome') +
          ' (' +
          dataRegistro +
          ' ' +
          (horaRegistro || '') +
          '). Justificativa: ' +
          justificativa,
      )
      audit.set('nivel', 'sensivel')
      audit.set('data', new Date().toISOString())
      $app.save(audit)
    } catch (_) {}

    return e.json(200, {
      success: true,
      message: ehAnulacao
        ? 'Marcação anulada com sucesso por registro complementar no fechamento.'
        : 'Marcação complementar registrada com sucesso no fechamento da folha.',
      tratamento_id: novoTratamento.id,
    })
  },
  $apis.requireAuth(),
)
