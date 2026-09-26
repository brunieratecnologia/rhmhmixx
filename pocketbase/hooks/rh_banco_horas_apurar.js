// pocketbase/hooks/rh_banco_horas_apurar.js
// Apuração e sincronização automática de créditos de banco de horas (após horário de saída previsto)
// e débitos (atrasos acima de 10 min de tolerância).

routerAdd('POST', '/backend/v1/rh/banco-horas/apurar-dia', (e) => {
  const adminOrRh = e.auth
  if (!adminOrRh) {
    return e.json(401, { error: 'Não autorizado. Faça login primeiro.' })
  }

  const role = adminOrRh.getString('role')
  if (role !== 'admin' && role !== 'rh') {
    return e.json(403, { error: 'Acesso restrito ao RH/Administrador.' })
  }

  const body = e.requestInfo().body || {}
  const funcionarioId = body.funcionario
  const dataRef = body.data_referencia // YYYY-MM-DD
  const minutosCredito = Number(body.minutos_credito || 0)
  const minutosDebito = Number(body.minutos_debito || 0)
  const motivoCustom = body.motivo || ''

  if (!funcionarioId || !dataRef) {
    return e.json(400, { error: 'Parâmetros funcionario e data_referencia são obrigatórios.' })
  }

  const parts = dataRef.split('-')
  const ano = parseInt(parts[0], 10)
  const mes = parseInt(parts[1], 10)

  const colBanco = $app.findCollectionByNameOrId('banco_horas')

  // Identificador de origem auditável
  // Ex: "Apuração automática de ponto (2025-05-10): trabalho pós-saída prevista"
  // Procurar lançamentos automáticos já existentes para este funcionário e data para evitar duplicações
  const existingRecords = $app.findRecordsByFilter(
    colBanco.id,
    "funcionario = '" +
      funcionarioId +
      "' && data_referencia ~ '" +
      dataRef +
      "' && motivo ~ 'Apuração automática'",
    '-created',
    10,
    0,
  )

  // Remove lançamentos automáticos anteriores do mesmo dia se estiver re-apurando
  for (let i = 0; i < existingRecords.length; i++) {
    try {
      $app.delete(existingRecords[i])
    } catch (_) {}
  }

  const lancamentosCriados = []

  if (minutosCredito > 0) {
    const recCred = new Record(colBanco)
    recCred.set('funcionario', funcionarioId)
    recCred.set('data_referencia', dataRef + ' 00:00:00.000Z')
    recCred.set('tipo', 'credito')
    recCred.set('minutos', minutosCredito)
    recCred.set(
      'motivo',
      motivoCustom ||
        'Apuração automática de ponto (' +
          dataRef +
          '): crédito por horas trabalhadas após o horário previsto de saída.',
    )
    recCred.set('usuario_responsavel', adminOrRh.id)
    recCred.set('competencia_ano', ano)
    recCred.set('competencia_mes', mes)
    $app.save(recCred)
    lancamentosCriados.push(recCred.id)
  }

  if (minutosDebito > 0) {
    const recDeb = new Record(colBanco)
    recDeb.set('funcionario', funcionarioId)
    recDeb.set('data_referencia', dataRef + ' 00:00:00.000Z')
    recDeb.set('tipo', 'debito')
    recDeb.set('minutos', minutosDebito)
    recDeb.set(
      'motivo',
      motivoCustom ||
        'Apuração automática de ponto (' +
          dataRef +
          '): débito por atraso excedente à tolerância de 10 minutos.',
    )
    recDeb.set('usuario_responsavel', adminOrRh.id)
    recDeb.set('competencia_ano', ano)
    recDeb.set('competencia_mes', mes)
    $app.save(recDeb)
    lancamentosCriados.push(recDeb.id)
  }

  return e.json(200, {
    success: true,
    message: 'Apuração do banco de horas processada com sucesso.',
    lancamentos: lancamentosCriados,
  })
})
