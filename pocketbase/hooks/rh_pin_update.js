routerAdd(
  'POST',
  '/backend/v1/rh/pin/update',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { message: 'Não autorizado. Faça login como administrador ou RH.' })
    }

    const role = auth.getString('role')
    if (role !== 'admin' && role !== 'rh') {
      return e.json(403, {
        message: 'Acesso negado. Apenas Admin e RH podem definir ou alterar PIN.',
      })
    }

    const body = e.requestInfo().body || {}
    const funcionarioId = (body.funcionarioId || '').toString().trim()
    const pin = (body.pin || '').toString().trim()

    if (!funcionarioId) {
      return e.json(400, { message: 'Identificador do funcionário é obrigatório.' })
    }

    if (!pin || !/^\d{4,6}$/.test(pin)) {
      return e.json(400, {
        message: 'O PIN deve conter exclusivamente entre 4 e 6 dígitos numéricos.',
      })
    }

    let funcRecord = null
    try {
      funcRecord = $app.findRecordById('funcionarios', funcionarioId)
    } catch (_) {
      return e.json(404, { message: 'Funcionário não encontrado.' })
    }

    // Hash the PIN using sha256 with salt
    const salt = 'rh_skip_pin_salt_2026'
    const pinHash = $security.sha256(pin + ':' + salt)

    funcRecord.set('pin_hash', pinHash)
    $app.save(funcRecord)

    // Reset any lock for this employee's matricula
    const matricula = funcRecord.getString('matricula')
    try {
      const attemptRecord = $app.findFirstRecordByData('tentativas_pin', 'matricula', matricula)
      attemptRecord.set('tentativas', 0)
      attemptRecord.set('bloqueado_ate', '')
      $app.save(attemptRecord)
    } catch (_) {
      // Record does not exist, nothing to reset
    }

    // Audit log
    try {
      const auditCol = $app.findCollectionByNameOrId('logs_auditoria')
      const logRec = new Record(auditCol)
      logRec.set('usuario', auth.id)
      logRec.set('acao', 'update_pin')
      logRec.set('entidade', 'funcionarios')
      logRec.set('entidade_id', funcionarioId)
      logRec.set(
        'detalhes',
        'Definição/Alteração de PIN de terminal para o funcionário matrícula ' + matricula,
      )
      logRec.set('nivel', 'sensivel')
      logRec.set('data', new Date().toISOString())
      $app.save(logRec)
    } catch (err) {
      console.log('Erro ao salvar log de alteração de PIN:', err)
    }

    return e.json(200, {
      success: true,
      message: 'PIN do funcionário atualizado com sucesso.',
    })
  },
  $apis.requireAuth(),
)
