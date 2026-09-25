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

    // Unicidade de PIN entre funcionários ativos (requisito do usuário: identificação única apenas pelo PIN)
    try {
      const col = $app.findCollectionByNameOrId('funcionarios')
      const existingWithSamePin = $app.findRecordsByFilter(
        col.id,
        "pin_hash = '" + pinHash + "' && id != '" + funcionarioId + "' && situacao != 'desligado'",
        '',
        1,
        0,
      )

      if (existingWithSamePin && existingWithSamePin.length > 0) {
        return e.json(400, {
          success: false,
          message:
            'Este PIN já está cadastrado para outro funcionário ativo. Como o terminal utiliza apenas o PIN para identificação, cada colaborador deve possuir um PIN exclusivo.',
        })
      }
    } catch (filterErr) {
      console.log('Erro ao checar colisão de PIN:', filterErr)
    }

    funcRecord.set('pin_hash', pinHash)
    $app.save(funcRecord)

    // Reset any lock for this PIN hash
    try {
      const colTentativas = $app.findCollectionByNameOrId('tentativas_pin')
      const records = $app.findRecordsByFilter(
        colTentativas.id,
        "pin_hash = '" + pinHash + "'",
        '',
        10,
        0,
      )
      for (let i = 0; i < records.length; i++) {
        records[i].set('tentativas', 0)
        records[i].set('bloqueado_ate', '')
        $app.save(records[i])
      }
    } catch (_) {}

    // Reset also by matricula if existent
    const matricula = funcRecord.getString('matricula')
    if (matricula) {
      try {
        const attemptRecord = $app.findFirstRecordByData('tentativas_pin', 'matricula', matricula)
        attemptRecord.set('tentativas', 0)
        attemptRecord.set('bloqueado_ate', '')
        $app.save(attemptRecord)
      } catch (_) {}
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
        'Definição/Alteração de PIN exclusivo de terminal para o funcionário ' +
          funcRecord.getString('nome') +
          ' (Matrícula ' +
          matricula +
          ')',
      )
      logRec.set('nivel', 'sensivel')
      logRec.set('data', new Date().toISOString())
      $app.save(logRec)
    } catch (err) {
      console.log('Erro ao salvar log de alteração de PIN:', err)
    }

    return e.json(200, {
      success: true,
      message: 'PIN do funcionário atualizado com sucesso e validado como único.',
    })
  },
  $apis.requireAuth(),
)
