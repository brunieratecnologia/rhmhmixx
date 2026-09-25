migrate(
  (app) => {
    try {
      const records = app.findRecordsByFilter('funcionarios', 'id != ""', '-created', 1)
      if (!records || records.length === 0) return
      const func = records[0]

      const feriasCol = app.findCollectionByNameOrId('ferias')
      const ausenciasCol = app.findCollectionByNameOrId('ausencias')

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
      recFerias.set(
        'observacoes',
        'Período programado de 20 dias com abono pecuniário de 10 dias acordado.',
      )
      app.save(recFerias)

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
    } catch (e) {
      console.log('Seed error:', e)
    }
  },
  (app) => {},
)
