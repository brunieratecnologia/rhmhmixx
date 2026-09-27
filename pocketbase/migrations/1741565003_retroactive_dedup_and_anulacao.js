migrate(
  (app) => {
    // 1. Atualizar campos da coleção tratamentos_ponto
    const tratamentosCol = app.findCollectionByNameOrId('tratamentos_ponto')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // Permitir tipo 'anulacao' no select 'tipo'
    const tipoField = tratamentosCol.fields.getByName('tipo')
    if (tipoField) {
      // Modificar valores do select: justificativa, correcao, classificacao, anulacao
      tipoField.values = ['justificativa', 'correcao', 'classificacao', 'anulacao']
    }

    // Permitir 'anulacao_marcacao_duplicada' e 'anulacao_marcacao_indevida' no select 'origem_ajuste'
    const origemField = tratamentosCol.fields.getByName('origem_ajuste')
    if (origemField) {
      origemField.values = [
        'inclusao_ponto_faltante',
        'justificativa_inconsistencia',
        'abono_horas',
        'anulacao_marcacao_duplicada',
        'anulacao_marcacao_indevida',
      ]
    }

    app.save(tratamentosCol)

    // 2. Normalização retroativa de duplicatas:
    // Identificar registros de ponto consecutivos do mesmo funcionário dentro da janela de 90 segundos.
    // Preservar o primeiro registro da rajada e criar registro complementar de anulação para os excedentes.
    const funcs = app.findRecordsByFilter('funcionarios', "situacao != ''", 'created', 1000, 0)
    let adminUser = null
    try {
      adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'andrebruniera@gmail.com')
    } catch (_) {}

    const DEDUP_WINDOW_MS = 90 * 1000 // 90 segundos

    // Buscar tratamentos já existentes para não duplicar anulações
    const existingTratamentos = app.findRecordsByFilter(
      'tratamentos_ponto',
      "tipo = 'anulacao'",
      'created',
      1000,
      0,
    )
    const anuladosSet = new Set()
    for (let i = 0; i < existingTratamentos.length; i++) {
      const regId = existingTratamentos[i].getString('registro')
      if (regId) anuladosSet.add(regId)
    }

    for (let f = 0; f < funcs.length; f++) {
      const func = funcs[f]
      const registros = app.findRecordsByFilter(
        'registros_horario',
        "funcionario = '" + func.id + "'",
        'timestamp_utc,hora_utc,created',
        5000,
        0,
      )

      if (!registros || registros.length <= 1) continue

      let lastValidTime = null

      for (let r = 0; r < registros.length; r++) {
        const reg = registros[r]
        const tsStr = reg.getString('timestamp_utc') || reg.getString('created')
        const ts = new Date(tsStr).getTime()

        if (lastValidTime === null) {
          lastValidTime = ts
          continue
        }

        const diffMs = ts - lastValidTime

        // Se está dentro da janela consecutiva de 90 segundos (>= 0 e < 90000 ms)
        if (diffMs >= 0 && diffMs < DEDUP_WINDOW_MS) {
          // É uma duplicata excedente! Anular via registro complementar se ainda não anulado
          if (!anuladosSet.has(reg.id)) {
            const dataIso = tsStr.slice(0, 10)
            const horaUtc = reg.getString('hora_utc') || '10:40:00'

            const novoTrat = new Record(tratamentosCol)
            novoTrat.set('funcionario', func.id)
            novoTrat.set('registro', reg.id)
            novoTrat.set('tipo', 'anulacao')
            novoTrat.set('origem_ajuste', 'anulacao_marcacao_duplicada')
            novoTrat.set('data_registro', dataIso)
            novoTrat.set('hora_registro', horaUtc.slice(0, 5))
            novoTrat.set(
              'justificativa',
              'Normalização retroativa: anulação de batida duplicada consecutiva dentro da janela de 90 segundos (' +
                Math.round(diffMs / 1000) +
                's de intervalo).',
            )
            novoTrat.set(
              'informacao_corrigida',
              'Marcação duplicada anulada por registro complementar em fechamento.',
            )
            novoTrat.set('data_tratamento', new Date().toISOString())
            if (adminUser) {
              novoTrat.set('usuario_responsavel', adminUser.id)
            }

            app.save(novoTrat)
            anuladosSet.add(reg.id)
          }
          // Note: não avançamos lastValidTime para manter a âncora do primeiro válido
        } else {
          // Batida fora da janela de 90s: é um novo marco temporal válido
          lastValidTime = ts
        }
      }
    }
  },
  (app) => {
    // Reverter anulações criadas por normalização retroativa
    const tratamentosCol = app.findCollectionByNameOrId('tratamentos_ponto')
    const duplicatas = app.findRecordsByFilter(
      'tratamentos_ponto',
      "origem_ajuste = 'anulacao_marcacao_duplicada'",
      'created',
      1000,
      0,
    )
    for (let i = 0; i < duplicatas.length; i++) {
      try {
        app.delete(duplicatas[i])
      } catch (_) {}
    }
  },
)
