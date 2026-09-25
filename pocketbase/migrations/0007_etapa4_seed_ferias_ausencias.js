migrate(
  (app) => {
    try {
      const func = app.findFirstRecordByFilter('funcionarios', 'matricula = "001"')
      if (!func) return

      const feriasCol = app.findCollectionByNameOrId('ferias')
      const ausenciasCol = app.findCollectionByNameOrId('ausencias')

      // Verificar se já tem registros
      const hasFerias = app.findFirstRecordByFilter('ferias', `funcionario = "${func.id}"`)
      if (!hasFerias) {
        // Criar um período de férias programado
        const recFerias = new Record(feriasCol)
        recFerias.set('funcionario', func.id)
        recFerias.set('data_inicio', '2026-10-15')
        recFerias.set('data_fim', '2026-11-03')
        recFerias.set('dias', 20)
        recFerias.set('dias_abono', 10)
        recFerias.set('tipo', 'fracionada')
        recFerias.set('status', 'programada')
        recFerias.set('periodo_aquisitivo_inicio', '2026-02-02')
        recFerias.set('periodo_aquisitivo_fim', '2027-02-01')
        recFerias.set('periodo_concessivo_fim', '2028-02-01')
        recFerias.set('saldo_dias', 0)
        recFerias.set(
          'observacoes',
          'Período programado de 20 dias com abono pecuniário de 10 dias acordado.',
        )
        app.save(recFerias)
      }

      const hasAusencia = app.findFirstRecordByFilter('ausencias', `funcionario = "${func.id}"`)
      if (!hasAusencia) {
        // Criar registro de atestado médico
        const recAus = new Record(ausenciasCol)
        recAus.set('funcionario', func.id)
        recAus.set('categoria', 'atestado')
        recAus.set('situacao', 'justificada')
        recAus.set('data_inicio', '2026-03-10')
        recAus.set('data_fim', '2026-03-11')
        recAus.set('justificativa', 'Atestado médico de 2 dias - Consulta e exames laboratoriais.')
        recAus.set('impacta_aquisitivo', false)
        recAus.set('observacoes', 'Documento arquivado no prontuário do colaborador.')
        app.save(recAus)
      }
    } catch (e) {
      // Ignorar caso já exista
    }
  },
  (app) => {},
)
