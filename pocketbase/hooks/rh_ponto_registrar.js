routerAdd('POST', '/backend/v1/rh/ponto/registrar', (e) => {
  const body = e.requestInfo().body || {}
  const matricula = (body.matricula || '').toString().trim().toUpperCase()
  const pin = (body.pin || '').toString().trim()
  const idRequisicao = (body.id_requisicao || '').toString().trim()

  if (!matricula || !pin) {
    return e.json(400, {
      success: false,
      message: 'Matrícula e PIN são obrigatórios.',
    })
  }

  const MAX_ATTEMPTS = 5
  const LOCKOUT_MINUTES = 10
  const now = new Date()
  const nowIso = now.toISOString()

  // 1. Check attempt lockout for this matricula
  let attemptRecord = null
  try {
    attemptRecord = $app.findFirstRecordByData('tentativas_pin', 'matricula', matricula)
  } catch (_) {
    // Record does not exist yet
  }

  if (attemptRecord) {
    const bloqueadoAte = attemptRecord.getString('bloqueado_ate')
    if (bloqueadoAte) {
      const lockDate = new Date(bloqueadoAte)
      if (now < lockDate) {
        const remainingMinutes = Math.max(
          1,
          Math.ceil((lockDate.getTime() - now.getTime()) / 60000),
        )
        return e.json(429, {
          success: false,
          locked: true,
          message:
            'Terminal temporariamente bloqueado para esta matrícula por excesso de tentativas incorretas. Tente novamente em ' +
            remainingMinutes +
            ' minuto(s).',
        })
      }
    }
  }

  // 2. Find employee by matricula
  let func = null
  try {
    func = $app.findFirstRecordByData('funcionarios', 'matricula', matricula)
  } catch (_) {
    // Employee doesn't exist. Record failed attempt for rate limiting
    try {
      if (!attemptRecord) {
        const col = $app.findCollectionByNameOrId('tentativas_pin')
        attemptRecord = new Record(col)
        attemptRecord.set('matricula', matricula)
        attemptRecord.set('tentativas', 1)
      } else {
        const currentAttempts = (attemptRecord.getInt('tentativas') || 0) + 1
        attemptRecord.set('tentativas', currentAttempts)
        if (currentAttempts >= MAX_ATTEMPTS) {
          const lockUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60000)
          attemptRecord.set('bloqueado_ate', lockUntil.toISOString())
        }
      }
      $app.save(attemptRecord)
    } catch (_) {}

    return e.json(401, {
      success: false,
      message: 'Matrícula ou PIN inválido.',
    })
  }

  // 3. Verify employee is active
  const situacao = func.getString('situacao')
  if (situacao !== 'ativo') {
    let motivoSituacao = 'Funcionário inativo no sistema.'
    if (situacao === 'afastado') {
      motivoSituacao = 'Funcionário com situação de afastamento registrada.'
    } else if (situacao === 'em_ferias') {
      motivoSituacao = 'Funcionário com período de férias ativo.'
    } else if (situacao === 'desligado') {
      motivoSituacao = 'Funcionário desligado da empresa.'
    }
    return e.json(403, {
      success: false,
      message: 'Marcação não permitida: ' + motivoSituacao + ' Procure o RH.',
    })
  }

  // 4. Verify PIN hash
  const storedHash = func.getString('pin_hash')
  if (!storedHash) {
    return e.json(400, {
      success: false,
      message:
        'Funcionário ainda não possui PIN de terminal cadastrado. Solicite ao RH a definição do seu PIN.',
    })
  }

  const salt = 'rh_skip_pin_salt_2026'
  const computedHash = $security.sha256(pin + ':' + salt)

  if (storedHash !== computedHash) {
    // Increment failed attempts
    try {
      if (!attemptRecord) {
        const col = $app.findCollectionByNameOrId('tentativas_pin')
        attemptRecord = new Record(col)
        attemptRecord.set('matricula', matricula)
        attemptRecord.set('tentativas', 1)
      } else {
        const currentAttempts = (attemptRecord.getInt('tentativas') || 0) + 1
        attemptRecord.set('tentativas', currentAttempts)
        if (currentAttempts >= MAX_ATTEMPTS) {
          const lockUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60000)
          attemptRecord.set('bloqueado_ate', lockUntil.toISOString())
        }
      }
      $app.save(attemptRecord)
    } catch (_) {}

    return e.json(401, {
      success: false,
      message: 'Matrícula ou PIN inválido.',
    })
  }

  // PIN verified! Reset attempts
  if (attemptRecord) {
    try {
      attemptRecord.set('tentativas', 0)
      attemptRecord.set('bloqueado_ate', '')
      $app.save(attemptRecord)
    } catch (_) {}
  }

  // 5. Idempotency Check: if id_requisicao is provided and already recorded, return that record
  if (idRequisicao) {
    try {
      const existing = $app.findFirstRecordByData(
        'registros_horario',
        'id_requisicao',
        idRequisicao,
      )
      if (existing) {
        const tsExisting = new Date(existing.getString('timestamp_utc'))
        const spTimeExisting = new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(tsExisting)

        const spDateExisting = new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(tsExisting)

        return e.json(200, {
          success: true,
          idempotent: true,
          identificador: existing.id,
          funcionario_nome: func.getString('nome'),
          data_formatada: spDateExisting,
          horario_formatado: spTimeExisting,
          timestamp_utc: existing.getString('timestamp_utc'),
          fuso_horario: 'America/Sao_Paulo',
          mensagem: 'Marcação confirmada com sucesso (registro previamente recebido).',
        })
      }
    } catch (_) {}
  }

  // 6. Official server timestamp in UTC
  const officialServerTime = new Date()
  const officialUtcIso = officialServerTime.toISOString()
  const dateUtc = officialUtcIso.split('T')[0]
  const timeUtc = officialUtcIso.split('T')[1].slice(0, 8)

  // 7. Persist record into registros_horario
  const regCol = $app.findCollectionByNameOrId('registros_horario')
  const newReg = new Record(regCol)
  newReg.set('funcionario', func.id)
  newReg.set('data_utc', dateUtc)
  newReg.set('hora_utc', timeUtc)
  newReg.set('timestamp_utc', officialUtcIso)
  newReg.set('origem', 'terminal')
  if (idRequisicao) {
    newReg.set('id_requisicao', idRequisicao)
  }
  $app.save(newReg)

  // 8. Format date and time for Brazilian timezone America/Sao_Paulo
  let spTimeFormatted = timeUtc
  let spDateFormatted = dateUtc
  try {
    spTimeFormatted = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(officialServerTime)

    spDateFormatted = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(officialServerTime)
  } catch (_) {}

  return e.json(200, {
    success: true,
    idempotent: false,
    identificador: newReg.id,
    funcionario_nome: func.getString('nome'),
    data_formatada: spDateFormatted,
    horario_formatado: spTimeFormatted,
    timestamp_utc: officialUtcIso,
    fuso_horario: 'America/Sao_Paulo',
    mensagem: 'Ponto registrado com sucesso!',
  })
})
