migrate(
  (app) => {
    // PARTE 1: Inserir a marcação de saída às 18:00 (horário de SP = 21:00:00 UTC) em 02/10/2026
    // para cada um dos 11 funcionários ativos da empresa MH MIXX.
    // Origem: 'admin' (inclusão administrativa da batida esquecida/queda de internet no fechamento)
    // Imutabilidade: novos registros independentes, offline_sync: false.

    const colRegistros = app.findCollectionByNameOrId('registros_horario')
    const colFuncionarios = app.findCollectionByNameOrId('funcionarios')

    // 1. Obter os 11 funcionários ativos
    const funcsAtivos = app.findRecordsByFilter(
      colFuncionarios.id,
      "situacao = 'ativo'",
      'matricula',
      50,
      0,
    )

    console.log(
      'Migracao 1741565007: Encontrados ' +
        funcsAtivos.length +
        ' funcionarios ativos para inclusao da saida 18:00 em 02/10/2026',
    )

    const dateUtc = '2026-10-02'
    const horaUtc = '21:00:00'
    const timestampUtc = '2026-10-02 21:00:00.000Z'

    let inseridos = 0
    let jaExistentes = 0

    for (let i = 0; i < funcsAtivos.length; i++) {
      const f = funcsAtivos[i]
      const funcId = f.id
      const matricula = f.getString('matricula')
      const idRequisicao = 'admin_oct02_saida_18h_' + funcId

      // Idempotência: verificar se já existe registro com esse id_requisicao
      try {
        const existente = app.findFirstRecordByData(
          'registros_horario',
          'id_requisicao',
          idRequisicao,
        )
        if (existente) {
          jaExistentes++
          continue
        }
      } catch (_) {}

      // Checar também se o funcionário já possui marcação após 12:00 UTC no dia 02/10/2026
      try {
        const tarde = app.findRecordsByFilter(
          colRegistros.id,
          "funcionario = '" +
            funcId +
            "' && timestamp_utc >= '2026-10-02 15:00:00' && timestamp_utc <= '2026-10-02 23:59:59'",
          '-timestamp_utc',
          1,
          0,
        )
        if (tarde && tarde.length > 0) {
          jaExistentes++
          continue
        }
      } catch (_) {}

      const rec = new Record(colRegistros)
      rec.set('funcionario', funcId)
      rec.set('data_utc', dateUtc)
      rec.set('hora_utc', horaUtc)
      rec.set('timestamp_utc', timestampUtc)
      rec.set('origem', 'admin')
      rec.set('id_requisicao', idRequisicao)
      rec.set('offline_sync', false)

      app.save(rec)
      inseridos++
      console.log(
        'Criada marcacao saida 18h (21h UTC) para ' +
          f.getString('nome') +
          ' (mat ' +
          matricula +
          ', id ' +
          funcId +
          ')',
      )
    }

    console.log(
      'Migracao 1741565007 concluida com sucesso. Total inseridos: ' +
        inseridos +
        ', Ja existentes: ' +
        jaExistentes,
    )
  },
  (app) => {
    // Reverter inclusão caso necessário
    try {
      app
        .db()
        .newQuery(
          "DELETE FROM registros_horario WHERE id_requisicao LIKE 'admin_oct02_saida_18h_%'",
        )
        .execute()
    } catch (err) {
      console.log('Erro ao reverter migracao 1741565007:', err)
    }
  },
)
