routerAdd('GET', '/backend/v1/rh/terminal/info', (e) => {
  let nomeFantasia = ''
  let razaoSocial = ''
  let logotipo = ''
  let fusoHorario = 'America/Sao_Paulo'
  let id = ''

  try {
    const list = $app.findRecordsByFilter('empresa', '', '-created', 1, 0)
    if (list.length > 0) {
      const emp = list[0]
      id = emp.id
      nomeFantasia = emp.getString('nome_fantasia')
      razaoSocial = emp.getString('razao_social')
      logotipo = emp.getString('logotipo')
      fusoHorario = emp.getString('fuso_horario') || 'America/Sao_Paulo'
    }
  } catch (err) {
    console.log('Erro ao carregar empresa para terminal:', err)
  }

  // Lista dos funcionários ativos e seus pin_hashes para validação segura em modo offline
  const funcionariosOffline = []
  try {
    const colFuncs = $app.findCollectionByNameOrId('funcionarios')
    const funcs = $app.findRecordsByFilter(
      colFuncs.id,
      "situacao = 'ativo' && pin_hash != ''",
      'nome',
      100,
      0,
    )
    for (let i = 0; i < funcs.length; i++) {
      const f = funcs[i]
      funcionariosOffline.push({
        id: f.id,
        nome: f.getString('nome'),
        matricula: f.getString('matricula'),
        pin_hash: f.getString('pin_hash'),
      })
    }
  } catch (err) {
    console.log('Erro ao carregar funcionários para cache offline:', err)
  }

  const serverTime = new Date()
  const serverTimeMs = serverTime.getTime()

  // Formatar explicitamente o horário no fuso da empresa (UTC-3 / America/Sao_Paulo)
  // Sem depender do Intl no runtime Goja que pode não estar presente
  const spOffsetMs = -3 * 3600 * 1000
  const spDateObj = new Date(serverTimeMs + spOffsetMs)

  const pad = function (n) {
    return n < 10 ? '0' + n : '' + n
  }

  const spYear = spDateObj.getUTCFullYear()
  const spMonth = pad(spDateObj.getUTCMonth() + 1)
  const spDay = pad(spDateObj.getUTCDate())
  const spHours = pad(spDateObj.getUTCHours())
  const spMinutes = pad(spDateObj.getUTCMinutes())
  const spSeconds = pad(spDateObj.getUTCSeconds())

  const dataFormatada = spDay + '/' + spMonth + '/' + spYear
  const horarioFormatado = spHours + ':' + spMinutes + ':' + spSeconds

  return e.json(200, {
    status: 'online',
    server_time_utc: serverTime.toISOString(),
    server_time_ms: serverTimeMs,
    sp_time_formatted: horarioFormatado,
    sp_date_formatted: dataFormatada,
    empresa: {
      id: id,
      nome_fantasia: nomeFantasia,
      razao_social: razaoSocial,
      logotipo: logotipo,
      fuso_horario: fusoHorario,
    },
    funcionarios_offline: funcionariosOffline,
  })
})
