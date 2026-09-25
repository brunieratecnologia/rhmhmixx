migrate(
  (app) => {
    // 1. Seed or update admin user andrebruniera@gmail.com
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    try {
      const adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'andrebruniera@gmail.com')
      adminUser.set('role', 'admin')
      adminUser.set('nome', 'Administrador RH')
      adminUser.set('ativo', true)
      adminUser.setPassword('Skip@Pass')
      adminUser.setVerified(true)
      app.save(adminUser)
    } catch (_) {
      const adminRecord = new Record(users)
      adminRecord.setEmail('andrebruniera@gmail.com')
      adminRecord.setPassword('Skip@Pass')
      adminRecord.setVerified(true)
      adminRecord.set('name', 'Administrador RH')
      adminRecord.set('nome', 'Administrador RH')
      adminRecord.set('role', 'admin')
      adminRecord.set('ativo', true)
      app.save(adminRecord)
    }

    // 2. Seed single empresa record (empty fields for owner to fill in Settings)
    const empresaCol = app.findCollectionByNameOrId('empresa')
    try {
      const existingEmpresa = app.findRecordsByFilter('empresa', '', '-created', 1, 0)
      if (existingEmpresa.length === 0) {
        const emp = new Record(empresaCol)
        emp.set('razao_social', '')
        emp.set('nome_fantasia', '')
        emp.set('cnpj', '')
        emp.set('endereco', '')
        emp.set('telefone', '')
        emp.set('email', '')
        emp.set('fuso_horario', 'America/Sao_Paulo')
        emp.set('responsavel_rh', '')
        app.save(emp)
      }
    } catch (err) {
      console.log('Error checking empresa seed:', err)
    }

    // 3. Seed departamentos (Administrativo, Operacional, Comercial)
    const depCol = app.findCollectionByNameOrId('departamentos')
    const deps = ['Administrativo', 'Operacional', 'Comercial']
    for (const depName of deps) {
      try {
        app.findFirstRecordByData('departamentos', 'nome', depName)
      } catch (_) {
        const depRec = new Record(depCol)
        depRec.set('nome', depName)
        app.save(depRec)
      }
    }

    // 4. Seed cargos (Analista de RH, Assistente Administrativo, Operador de Produção, Vendedor)
    const cargoCol = app.findCollectionByNameOrId('cargos')
    const cargos = [
      'Analista de RH',
      'Assistente Administrativo',
      'Operador de Produção',
      'Vendedor',
    ]
    for (const cargoName of cargos) {
      try {
        app.findFirstRecordByData('cargos', 'nome', cargoName)
      } catch (_) {
        const cargoRec = new Record(cargoCol)
        cargoRec.set('nome', cargoName)
        app.save(cargoRec)
      }
    }

    // 5. Seed jornada "Comercial 08h-17h" (seg-sex, 08:00/12:00/13:00/17:00, 480 min)
    const jorCol = app.findCollectionByNameOrId('jornadas')
    try {
      app.findFirstRecordByData('jornadas', 'nome', 'Comercial 08h-17h')
    } catch (_) {
      const jorRec = new Record(jorCol)
      jorRec.set('nome', 'Comercial 08h-17h')
      jorRec.set('dias_trabalho', ['seg', 'ter', 'qua', 'qui', 'sex'])
      jorRec.set('hora_entrada', '08:00')
      jorRec.set('hora_inicio_intervalo', '12:00')
      jorRec.set('hora_retorno_intervalo', '13:00')
      jorRec.set('hora_saida', '17:00')
      jorRec.set('duracao_jornada_min', 480)
      jorRec.set('dias_folga', ['sab', 'dom'])
      app.save(jorRec)
    }

    // NOTE: Strictly obeying rule: NÃO criar funcionários fictícios de exemplo — o usuário proibiu dados fictícios nas telas; o dashboard deve nascer vazio com empty states.
  },
  (app) => {
    // down migration
  },
)
