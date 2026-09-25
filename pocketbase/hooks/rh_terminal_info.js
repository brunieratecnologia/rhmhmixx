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

  const serverTime = new Date()

  return e.json(200, {
    status: 'online',
    server_time_utc: serverTime.toISOString(),
    empresa: {
      id: id,
      nome_fantasia: nomeFantasia,
      razao_social: razaoSocial,
      logotipo: logotipo,
      fuso_horario: fusoHorario,
    },
  })
})
