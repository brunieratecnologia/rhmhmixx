routerAdd(
  'POST',
  '/backend/v1/rh/fechamento/status',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { success: false, message: 'Não autenticado.' })
    }

    const role = auth.getString('role')
    if (role !== 'admin' && role !== 'rh') {
      return e.json(403, {
        success: false,
        message: 'Apenas administradores e RH podem gerenciar o fechamento de folha.',
      })
    }

    const body = e.requestInfo().body || {}
    const ano = parseInt(body.competencia_ano, 10)
    const mes = parseInt(body.competencia_mes, 10)
    const acao = (body.acao || '').toString().trim() // 'abrir_fechamento' | 'encerrar_fechamento' | 'reabrir_fechamento'
    const observacoes = (body.observacoes || '').toString().trim()

    if (!ano || !mes || !acao) {
      return e.json(400, {
        success: false,
        message: 'Ano, mês da competência e ação são obrigatórios.',
      })
    }

    const now = new Date()
    const currentYear = now.getUTCFullYear()
    const currentMonth = now.getUTCMonth() + 1

    if (ano > currentYear || (ano === currentYear && mes > currentMonth)) {
      return e.json(400, {
        success: false,
        message: 'Competências futuras não podem ser abertas para fechamento.',
      })
    }

    let record = null
    try {
      const records = $app.findRecordsByFilter(
        'fechamentos_folha',
        'competencia_ano = ' + ano + ' && competencia_mes = ' + mes,
        '-created',
        1,
        0,
      )
      if (records && records.length > 0) {
        record = records[0]
      }
    } catch (_) {}

    const col = $app.findCollectionByNameOrId('fechamentos_folha')

    if (acao === 'abrir_fechamento') {
      if (record && record.getString('status') === 'fechado') {
        return e.json(400, {
          success: false,
          message: 'A competência já está encerrada/fechada. Utilize a reabertura se necessário.',
        })
      }

      if (!record) {
        record = new Record(col)
        record.set('competencia_ano', ano)
        record.set('competencia_mes', mes)
      }

      record.set('status', 'aberto_fechamento')
      record.set('data_abertura_fechamento', new Date().toISOString())
      record.set('responsavel_abertura', auth.id)
      if (observacoes) record.set('observacoes', observacoes)
      $app.save(record)

      // Audit log
      try {
        const auditCol = $app.findCollectionByNameOrId('logs_auditoria')
        const log = new Record(auditCol)
        log.set('usuario', auth.id)
        log.set('acao', 'abrir_fechamento_folha')
        log.set('entidade', 'fechamentos_folha')
        log.set('entidade_id', record.id)
        log.set(
          'detalhes',
          'Abertura de período de fechamento da folha ' +
            mes +
            '/' +
            ano +
            ' para ajustes e inclusão de pontos faltantes.',
        )
        log.set('nivel', 'sensivel')
        log.set('data', new Date().toISOString())
        $app.save(log)
      } catch (_) {}

      return e.json(200, {
        success: true,
        message:
          'Período de fechamento aberto com sucesso. Agora é possível incluir marcações faltantes e justificar ocorrências nesta competência.',
        record: {
          id: record.id,
          competencia_ano: ano,
          competencia_mes: mes,
          status: 'aberto_fechamento',
        },
      })
    } else if (acao === 'encerrar_fechamento') {
      if (!record) {
        return e.json(400, {
          success: false,
          message: 'O fechamento desta competência nem sequer foi iniciado.',
        })
      }

      record.set('status', 'fechado')
      record.set('data_encerramento', new Date().toISOString())
      record.set('responsavel_encerramento', auth.id)
      if (observacoes) {
        const prevObs = record.getString('observacoes')
        record.set('observacoes', prevObs ? prevObs + ' | ' + observacoes : observacoes)
      }
      $app.save(record)

      // Audit log
      try {
        const auditCol = $app.findCollectionByNameOrId('logs_auditoria')
        const log = new Record(auditCol)
        log.set('usuario', auth.id)
        log.set('acao', 'encerrar_fechamento_folha')
        log.set('entidade', 'fechamentos_folha')
        log.set('entidade_id', record.id)
        log.set(
          'detalhes',
          'Encerramento definitivo da folha ' + mes + '/' + ano + '. Ajustes bloqueados.',
        )
        log.set('nivel', 'sensivel')
        log.set('data', new Date().toISOString())
        $app.save(log)
      } catch (_) {}

      return e.json(200, {
        success: true,
        message:
          'Fechamento da folha de ponto encerrado e bloqueado com sucesso. Nenhuma edição ou inclusão adicional será permitida.',
        record: {
          id: record.id,
          competencia_ano: ano,
          competencia_mes: mes,
          status: 'fechado',
        },
      })
    } else if (acao === 'reabrir_fechamento') {
      // Only admin can re-open a closed month
      if (role !== 'admin') {
        return e.json(403, {
          success: false,
          message: 'Apenas administradores podem reabrir uma folha já encerrada.',
        })
      }

      if (!record) {
        return e.json(400, {
          success: false,
          message: 'Competência não encontrada.',
        })
      }

      record.set('status', 'aberto_fechamento')
      record.set('data_encerramento', '')
      record.set('responsavel_abertura', auth.id)
      if (observacoes) {
        const prevObs = record.getString('observacoes')
        record.set(
          'observacoes',
          prevObs ? prevObs + ' | Reaberto: ' + observacoes : 'Reaberto: ' + observacoes,
        )
      }
      $app.save(record)

      // Audit log
      try {
        const auditCol = $app.findCollectionByNameOrId('logs_auditoria')
        const log = new Record(auditCol)
        log.set('usuario', auth.id)
        log.set('acao', 'reabrir_fechamento_folha')
        log.set('entidade', 'fechamentos_folha')
        log.set('entidade_id', record.id)
        log.set(
          'detalhes',
          'Reabertura administrativa da folha ' + mes + '/' + ano + ' por administrador.',
        )
        log.set('nivel', 'sensivel')
        log.set('data', new Date().toISOString())
        $app.save(log)
      } catch (_) {}

      return e.json(200, {
        success: true,
        message: 'Fechamento de folha reaberto com sucesso.',
        record: {
          id: record.id,
          competencia_ano: ano,
          competencia_mes: mes,
          status: 'aberto_fechamento',
        },
      })
    }

    return e.json(400, {
      success: false,
      message: 'Ação desconhecida: ' + acao,
    })
  },
  $apis.requireAuth(),
)
