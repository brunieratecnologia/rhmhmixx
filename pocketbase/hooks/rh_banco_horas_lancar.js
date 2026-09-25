routerAdd(
  'POST',
  '/backend/v1/rh/banco-horas/lancar',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { success: false, message: 'Não autenticado.' })
    }

    const role = auth.getString('role')
    if (role !== 'admin' && role !== 'rh') {
      return e.json(403, {
        success: false,
        message: 'Acesso negado. Apenas RH ou administradores podem lançar no banco de horas.',
      })
    }

    const body = e.requestInfo().body || {}
    const funcionarioId = (body.funcionario || '').toString().trim()
    const dataReferencia = (body.data_referencia || '').toString().trim() // YYYY-MM-DD
    const tipo = (body.tipo || '').toString().trim() // credito | debito | ajuste_manual
    const minutos = parseInt(body.minutos, 10)
    const motivo = (body.motivo || '').toString().trim()

    if (!funcionarioId || !dataReferencia || !tipo || isNaN(minutos) || minutos <= 0 || !motivo) {
      return e.json(400, {
        success: false,
        message:
          'Todos os campos são obrigatórios: funcionário, data de referência, tipo (credito/debito/ajuste_manual), quantidade de minutos (> 0) e motivo.',
      })
    }

    if (tipo !== 'credito' && tipo !== 'debito' && tipo !== 'ajuste_manual') {
      return e.json(400, {
        success: false,
        message: 'Tipo de lançamento inválido. Use credito, debito ou ajuste_manual.',
      })
    }

    // Check employee
    let func = null
    try {
      func = $app.findRecordById('funcionarios', funcionarioId)
    } catch (_) {
      return e.json(404, { success: false, message: 'Funcionário não encontrado.' })
    }

    const parts = dataReferencia.split('-')
    const ano = parts.length === 3 ? parseInt(parts[0], 10) : null
    const mes = parts.length === 3 ? parseInt(parts[1], 10) : null

    const col = $app.findCollectionByNameOrId('banco_horas')
    const rec = new Record(col)
    rec.set('funcionario', func.id)
    rec.set('data_referencia', dataReferencia)
    rec.set('tipo', tipo)
    rec.set('minutos', minutos)
    rec.set('motivo', motivo)
    rec.set('usuario_responsavel', auth.id)
    if (ano) rec.set('competencia_ano', ano)
    if (mes) rec.set('competencia_mes', mes)
    $app.save(rec)

    // Audit log
    try {
      const auditCol = $app.findCollectionByNameOrId('logs_auditoria')
      const audit = new Record(auditCol)
      audit.set('usuario', auth.id)
      audit.set('acao', 'lancamento_banco_horas')
      audit.set('entidade', 'banco_horas')
      audit.set('entidade_id', rec.id)
      audit.set(
        'detalhes',
        'Lançamento no banco de horas para ' +
          func.getString('nome') +
          ': ' +
          tipo +
          ' de ' +
          minutos +
          ' min (' +
          (minutos / 60).toFixed(2) +
          'h) ref. ' +
          dataReferencia +
          '. Motivo: ' +
          motivo,
      )
      audit.set('nivel', 'sensivel')
      audit.set('data', new Date().toISOString())
      $app.save(audit)
    } catch (_) {}

    return e.json(200, {
      success: true,
      message: 'Lançamento efetuado com sucesso no Banco de Horas.',
      registro: {
        id: rec.id,
        funcionario: func.id,
        tipo: tipo,
        minutos: minutos,
        motivo: motivo,
        data_referencia: dataReferencia,
      },
    })
  },
  $apis.requireAuth(),
)
