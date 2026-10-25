migrate(
  (app) => {
    const tratamentosCol = app.findCollectionByNameOrId('tratamentos_ponto')
    const origemField = tratamentosCol.fields.getByName('origem_ajuste')
    if (origemField) {
      // Garantir que correcao_horario_batida e anulacao_por_correcao estejam disponíveis
      const currentValues = origemField.values || []
      const newValues = [...currentValues]
      if (!newValues.includes('correcao_horario_batida')) {
        newValues.push('correcao_horario_batida')
      }
      if (!newValues.includes('anulacao_por_correcao')) {
        newValues.push('anulacao_por_correcao')
      }
      origemField.values = newValues
      app.save(tratamentosCol)
    }
  },
  (app) => {
    const tratamentosCol = app.findCollectionByNameOrId('tratamentos_ponto')
    const origemField = tratamentosCol.fields.getByName('origem_ajuste')
    if (origemField) {
      origemField.values = (origemField.values || []).filter(
        (v) => v !== 'correcao_horario_batida' && v !== 'anulacao_por_correcao',
      )
      app.save(tratamentosCol)
    }
  },
)
