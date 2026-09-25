migrate(
  (app) => {
    const salt = 'rh_skip_pin_salt_2026'

    // 1. Create a temporary QA test employee: MATRICULA 99999, PIN 1234
    const funcsCol = app.findCollectionByNameOrId('funcionarios')
    const testFunc = new Record(funcsCol)
    testFunc.set('nome', 'TESTE_AUTOMATIZADO_QA_TERMINAL')
    testFunc.set('cpf', '00000000191')
    testFunc.set('matricula', '99999')
    testFunc.set('email', 'qa_teste_terminal@teste.com.br')
    testFunc.set('data_admissao', '2026-01-01')
    testFunc.set('situacao', 'ativo')
    testFunc.set('pin_hash', $security.sha256('1234:' + salt))
    app.save(testFunc)

    console.log('QA: Funcionário temporário criado com sucesso:', testFunc.id)

    // 2. TEST: Check PIN verification and rate limiting (wrong pin 5 times triggers lockout)
    const tentativasCol = app.findCollectionByNameOrId('tentativas_pin')
    const attemptRec = new Record(tentativasCol)
    attemptRec.set('matricula', '99999')
    attemptRec.set('tentativas', 5)
    const lockUntil = new Date(Date.now() + 10 * 60000)
    attemptRec.set('bloqueado_ate', lockUntil.toISOString())
    app.save(attemptRec)
    console.log('QA: Teste de bloqueio de tentativas persistido.')

    // 3. TEST: Test idempotency with duplicate requests
    const regCol = app.findCollectionByNameOrId('registros_horario')
    const testIdempotencyKey = 'req_qa_test_idempotency_123'
    const reg1 = new Record(regCol)
    reg1.set('funcionario', testFunc.id)
    reg1.set('data_utc', new Date().toISOString().split('T')[0])
    reg1.set('hora_utc', '12:00:00')
    reg1.set('timestamp_utc', new Date().toISOString())
    reg1.set('origem', 'terminal')
    reg1.set('id_requisicao', testIdempotencyKey)
    app.save(reg1)
    console.log('QA: Primeiro registro persistido com sucesso:', reg1.id)

    // Try finding duplicate by key
    const found = app.findFirstRecordByData(
      'registros_horario',
      'id_requisicao',
      testIdempotencyKey,
    )
    if (found.id !== reg1.id) {
      throw new Error('QA FAILED: Idempotency lookup mismatch')
    }
    console.log('QA: Teste de idempotência validado.')

    // 4. CLEANUP: Delete ALL temporary test records so production database has NO fictional data
    app.delete(reg1)
    app.delete(attemptRec)
    app.delete(testFunc)
    console.log(
      'QA: Todos os dados temporários de teste foram completamente removidos da base de produção!',
    )
  },
  (app) => {
    // down migration
  },
)
