routerAdd(
  'POST',
  '/backend/v1/rh/pin/padrao-massa',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { message: 'Não autorizado. Faça login como administrador ou RH.' })
    }

    const role = auth.getString('role')
    if (role !== 'admin' && role !== 'rh') {
      return e.json(403, {
        message: 'Acesso negado. Apenas Admin e RH podem gerenciar PINs.',
      })
    }

    const salt = 'rh_skip_pin_salt_2026'

    // 1. Obter todos os funcionários ativos
    let funcs = []
    try {
      const col = $app.findCollectionByNameOrId('funcionarios')
      funcs = $app.findRecordsByFilter(col.id, "situacao != 'desligado'", 'nome', 500, 0)
    } catch (err) {
      return e.json(500, { message: 'Erro ao buscar funcionários: ' + err.message })
    }

    // Mapear hashes já ocupados por funcionários ativos que já possuem PIN
    const hashesOcupados = {}
    for (let i = 0; i < funcs.length; i++) {
      const f = funcs[i]
      const h = f.getString('pin_hash')
      if (h) {
        hashesOcupados[h] = {
          id: f.id,
          nome: f.getString('nome'),
          matricula: f.getString('matricula'),
        }
      }
    }

    const atualizados = []
    const semDataNascimento = []
    const jaPossuemPin = []
    const colisoes = []

    for (let i = 0; i < funcs.length; i++) {
      const f = funcs[i]
      const currentHash = f.getString('pin_hash')
      const nome = f.getString('nome')
      const matricula = f.getString('matricula')
      const dtNasc = f.getString('data_nascimento')

      if (currentHash) {
        jaPossuemPin.push({ id: f.id, nome, matricula })
        continue
      }

      if (!dtNasc) {
        semDataNascimento.push({ id: f.id, nome, matricula })
        continue
      }

      // Derivar PIN DDMMAA da data_nascimento (esperado YYYY-MM-DD...)
      const datePart = dtNasc.split('T')[0]
      const parts = datePart.split('-')
      if (parts.length < 3) {
        semDataNascimento.push({ id: f.id, nome, matricula })
        continue
      }
      const yyyy = parts[0]
      const mm = parts[1]
      const dd = parts[2]
      const aa = yyyy.slice(-2)
      const pinPadrao = dd + mm + aa // 6 dígitos numéricos

      if (!/^\d{6}$/.test(pinPadrao)) {
        semDataNascimento.push({ id: f.id, nome, matricula })
        continue
      }

      const pinHash = $security.sha256(pinPadrao + ':' + salt)

      // Verificar se o hash colide com alguém que já tem PIN ou com outro já atribuído nesta rodada
      if (hashesOcupados[pinHash]) {
        colisoes.push({
          id: f.id,
          nome,
          matricula,
          pinTentado: pinPadrao,
          conflitoCom:
            hashesOcupados[pinHash].nome + ' (Matrícula ' + hashesOcupados[pinHash].matricula + ')',
        })
        continue
      }

      // Atribuir PIN padrão
      try {
        f.set('pin_hash', pinHash)
        $app.save(f)

        hashesOcupados[pinHash] = { id: f.id, nome, matricula }
        atualizados.push({ id: f.id, nome, matricula, pinGerado: pinPadrao })

        // Resetar qualquer tentativa bloqueada desse hash
        try {
          const colTentativas = $app.findCollectionByNameOrId('tentativas_pin')
          const recs = $app.findRecordsByFilter(
            colTentativas.id,
            "pin_hash = '" + pinHash + "'",
            '',
            10,
            0,
          )
          for (let j = 0; j < recs.length; j++) {
            recs[j].set('tentativas', 0)
            recs[j].set('bloqueado_ate', '')
            $app.save(recs[j])
          }
        } catch (_) {}

        // Log de auditoria individual
        try {
          const auditCol = $app.findCollectionByNameOrId('logs_auditoria')
          const logRec = new Record(auditCol)
          logRec.set('usuario', auth.id)
          logRec.set('acao', 'update_pin_padrao_massa')
          logRec.set('entidade', 'funcionarios')
          logRec.set('entidade_id', f.id)
          logRec.set(
            'detalhes',
            'Definição automática do PIN padrão (data de nascimento DDMMAA) para o colaborador ' +
              nome +
              ' (Matrícula ' +
              matricula +
              ')',
          )
          logRec.set('nivel', 'sensivel')
          logRec.set('data', new Date().toISOString())
          $app.save(logRec)
        } catch (_) {}
      } catch (saveErr) {
        colisoes.push({
          id: f.id,
          nome,
          matricula,
          pinTentado: pinPadrao,
          conflitoCom: 'Erro ao salvar: ' + saveErr.message,
        })
      }
    }

    return e.json(200, {
      success: true,
      totalProcessados: funcs.length,
      atualizadosCount: atualizados.length,
      atualizados,
      jaPossuemPinCount: jaPossuemPin.length,
      semDataNascimentoCount: semDataNascimento.length,
      semDataNascimento,
      colisoesCount: colisoes.length,
      colisoes,
    })
  },
  $apis.requireAuth(),
)
