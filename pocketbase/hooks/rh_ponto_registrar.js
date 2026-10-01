routerAdd('POST', '/backend/v1/rh/ponto/registrar', (e) => {
  const body = e.requestInfo().body || {}
  const pin = (body.pin || '').toString().trim()
  const idRequisicao = (body.id_requisicao || '').toString().trim()
  const timestampInformadoUtc = (body.timestamp_utc || '').toString().trim()
  const isOfflineSync = Boolean(body.offline || body.offline_sync)

  // Terminal agora autentica EXCLUSIVAMENTE pelo PIN do funcionário
  if (!pin) {
    return e.json(400, {
      success: false,
      message: 'PIN é obrigatório para registrar o ponto.',
    })
  }

  if (pin.length < 4 || pin.length > 6 || !/^\d{4,6}$/.test(pin)) {
    return e.json(400, {
      success: false,
      message: 'O PIN deve conter entre 4 e 6 dígitos numéricos.',
    })
  }

  const salt = 'rh_skip_pin_salt_2026'
  const computedHash = $security.sha256(pin + ':' + salt)

  // Taxa limite / Rate limiting e bloqueio temporário por tentativas incorretas repetidas
  // Como o PIN é o único fator, limitamos por hash de PIN tentado e/ou IP do terminal
  const MAX_ATTEMPTS = 5
  const LOCKOUT_MINUTES = 10
  const now = new Date()

  // 1. Verificar bloqueio temporário ativo para este PIN hash (apenas para requisições em tempo real)
  let attemptRecord = null
  if (!isOfflineSync) {
    try {
      const colTentativas = $app.findCollectionByNameOrId('tentativas_pin')
      const recs = $app.findRecordsByFilter(
        colTentativas.id,
        "pin_hash = '" + computedHash + "'",
        '-created',
        1,
        0,
      )
      if (recs && recs.length > 0) {
        attemptRecord = recs[0]
      }
    } catch (_) {}

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
              'Acesso temporariamente bloqueado por excesso de tentativas incorretas. Tente novamente em ' +
              remainingMinutes +
              ' minuto(s).',
          })
        }
      }
    }
  }

  // 2. Localizar funcionário APENAS pelo pin_hash
  let func = null
  try {
    const colFuncs = $app.findCollectionByNameOrId('funcionarios')
    const found = $app.findRecordsByFilter(
      colFuncs.id,
      "pin_hash = '" + computedHash + "'",
      '-created',
      2,
      0,
    )
    if (found && found.length > 0) {
      func = found[0]
    }
  } catch (_) {}

  if (!func) {
    // PIN inexistente: registrar tentativa com falha sem jamais revelar se o PIN existe ou a quem pertence
    if (!isOfflineSync) {
      try {
        const col = $app.findCollectionByNameOrId('tentativas_pin')
        if (!attemptRecord) {
          attemptRecord = new Record(col)
          attemptRecord.set('pin_hash', computedHash)
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
    }

    return e.json(401, {
      success: false,
      message: 'PIN inválido ou não cadastrado.',
    })
  }

  // 3. Verificar situação do funcionário
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

  // PIN válido e funcionário ativo! Zerar tentativas se houver registro prévio
  if (attemptRecord) {
    try {
      attemptRecord.set('tentativas', 0)
      attemptRecord.set('bloqueado_ate', '')
      $app.save(attemptRecord)
    } catch (_) {}
  }

  // Função interna para formatar timestamp UTC no fuso oficial America/Sao_Paulo (UTC-3)
  // Sem depender do objeto Intl (que não existe no runtime Goja do backend)
  const pad = function (n) {
    return n < 10 ? '0' + n : '' + n
  }

  const formatSaoPauloDateTime = function (d) {
    const spOffsetMs = -3 * 3600 * 1000
    const spDateObj = new Date(d.getTime() + spOffsetMs)

    const year = spDateObj.getUTCFullYear()
    const month = pad(spDateObj.getUTCMonth() + 1)
    const day = pad(spDateObj.getUTCDate())
    const hours = pad(spDateObj.getUTCHours())
    const minutes = pad(spDateObj.getUTCMinutes())
    const seconds = pad(spDateObj.getUTCSeconds())

    return {
      dateFormatted: day + '/' + month + '/' + year,
      timeFormatted: hours + ':' + minutes + ':' + seconds,
      spDateIso: year + '-' + month + '-' + day,
    }
  }

  // 4. Checagem de idempotência com id_requisicao
  if (idRequisicao) {
    try {
      const existing = $app.findFirstRecordByData(
        'registros_horario',
        'id_requisicao',
        idRequisicao,
      )
      if (existing) {
        const existingUtcStr = existing.getString('timestamp_utc')
        const tsExisting = new Date(existingUtcStr)
        const spParts = formatSaoPauloDateTime(tsExisting)

        return e.json(200, {
          success: true,
          idempotent: true,
          identificador: existing.id,
          funcionario_nome: func.getString('nome'),
          data_formatada: spParts.dateFormatted,
          horario_formatado: spParts.timeFormatted,
          timestamp_utc: existingUtcStr,
          server_timestamp_ms: tsExisting.getTime(),
          fuso_horario: 'America/Sao_Paulo',
          offline_sync: existing.getBool('offline_sync'),
          mensagem: 'Marcação confirmada com sucesso (registro previamente recebido).',
        })
      }
    } catch (_) {}
  }

  // Determinar timestamp da batida:
  // Se for sincronização offline com timestamp informado válido, usa o timestamp registrado no momento real da batida.
  // Caso contrário, usa o horário oficial atual do servidor.
  let officialServerTime = new Date()
  if (isOfflineSync && timestampInformadoUtc) {
    const parsedTs = new Date(timestampInformadoUtc)
    if (!isNaN(parsedTs.getTime())) {
      officialServerTime = parsedTs
    }
  }

  // 4.1 Deduplicação de batidas consecutivas em janela de 90 segundos (mesmo funcionário)
  // Regra: "quando o funcionário bater 2 vezes no intervalo pequeno, registrar apenas 1. não registrar duas vezes."
  // Para batidas offline/sincronizadas, compara o timestamp da batida com batidas já existentes no banco
  const DEDUP_WINDOW_MS = 90 * 1000 // 90 segundos
  try {
    const colRegistros = $app.findCollectionByNameOrId('registros_horario')
    const recsRecentes = $app.findRecordsByFilter(
      colRegistros.id,
      "funcionario = '" + func.id + "'",
      '-timestamp_utc,-created',
      5,
      0,
    )

    if (recsRecentes && recsRecentes.length > 0) {
      const targetTimeMs = officialServerTime.getTime()
      for (let i = 0; i < recsRecentes.length; i++) {
        const ultRec = recsRecentes[i]
        const ultUtcStr = ultRec.getString('timestamp_utc') || ultRec.getString('created')
        if (ultUtcStr) {
          const tsUlt = new Date(ultUtcStr).getTime()
          const diffMs = Math.abs(targetTimeMs - tsUlt)

          if (diffMs < DEDUP_WINDOW_MS) {
            const spParts = formatSaoPauloDateTime(new Date(ultUtcStr))
            const horaSimples = spParts.timeFormatted.slice(0, 5) // HH:MM
            return e.json(200, {
              success: true,
              idempotent: true,
              deduplicated: true,
              identificador: ultRec.id,
              funcionario_nome: func.getString('nome'),
              data_formatada: spParts.dateFormatted,
              horario_formatado: spParts.timeFormatted,
              timestamp_utc: ultUtcStr,
              server_timestamp_ms: tsUlt,
              fuso_horario: 'America/Sao_Paulo',
              offline_sync: ultRec.getBool('offline_sync'),
              mensagem: 'Sua batida às ' + horaSimples + ' já valeu — não precisa bater de novo.',
            })
          }
        }
      }
    }
  } catch (_) {}

  // 5. Horário final formatado em UTC
  const officialUtcIso = officialServerTime.toISOString()
  const dateUtc = officialUtcIso.split('T')[0]
  const timeUtc = officialUtcIso.split('T')[1].slice(0, 8)

  // 6. Gravar em registros_horario
  const regCol = $app.findCollectionByNameOrId('registros_horario')
  const newReg = new Record(regCol)
  newReg.set('funcionario', func.id)
  newReg.set('data_utc', dateUtc)
  newReg.set('hora_utc', timeUtc)
  newReg.set('timestamp_utc', officialUtcIso)
  newReg.set('origem', 'terminal')
  if (isOfflineSync) {
    newReg.set('offline_sync', true)
  }
  if (idRequisicao) {
    newReg.set('id_requisicao', idRequisicao)
  }
  $app.save(newReg)

  // 7. Formatar fuso horário oficial America/Sao_Paulo
  const spParts = formatSaoPauloDateTime(officialServerTime)

  return e.json(200, {
    success: true,
    idempotent: false,
    identificador: newReg.id,
    funcionario_nome: func.getString('nome'),
    data_formatada: spParts.dateFormatted,
    horario_formatado: spParts.timeFormatted,
    timestamp_utc: officialUtcIso,
    server_timestamp_ms: officialServerTime.getTime(),
    fuso_horario: 'America/Sao_Paulo',
    offline_sync: isOfflineSync,
    mensagem: isOfflineSync
      ? 'Marcação offline sincronizada com sucesso!'
      : 'Ponto registrado com sucesso!',
  })
})
