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
    const registroOriginalId = (body.registro || '').toString().trim() // opcional ou obrigatório em anulação
    const acaoTipo = (body.acao_tipo || (tipo === 'anulacao' ? 'anular' : 'incluir'))
      .toString()
      .trim() // 'incluir' | 'anular'

    if (!funcionarioId || !dataRegistro || !justificativa) {
      return e.json(400, {
        success: false,
        message: 'Funcionário, data de referência e motivo/justificativa são obrigatórios.',
      })
    }

    if (acaoTipo === 'anular' && !registroOriginalId) {
      return e.json(400, {
        success: false,
        message: 'Para anular uma marcação, identifique o registro a ser anulado.',
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
    // O admin pode incluir/anular marcações esquecidas a qualquer momento no mês corrente e em meses anteriores.
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

    // 4. Create complementary record in tratamentos_ponto (original registers are NEVER touched/mutated)
    const tratamentosCol = $app.findCollectionByNameOrId('tratamentos_ponto')
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

    // 5. Audit log
    try {
      const auditCol = $app.findCollectionByNameOrId('logs_auditoria')
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
