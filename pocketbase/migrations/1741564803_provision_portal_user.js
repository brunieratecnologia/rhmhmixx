migrate(
  (app) => {
    // Para funcionários ativos que ainda não tenham user ou queiram conta de portal,
    // nós vinculamos com segurança.
    // O usuário admin principal 'andrebruniera@gmail.com' já existe como admin.
    // Vinculamos o funcionário correspondente ao user id do admin para que ele possa testar como funcionário também,
    // OU criamos um usuário com papel de 'funcionario'.
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const funcCol = app.findCollectionByNameOrId('funcionarios')

    // 1. Criar um usuário colaborador padrão para teste autônomo do portal:
    // email: colaborador@mhmixx.com.br, role: funcionario, pass: Skip@Pass
    let colabUser = null
    try {
      colabUser = app.findAuthRecordByEmail('_pb_users_auth_', 'colaborador@mhmixx.com.br')
    } catch (_) {
      colabUser = new Record(usersCol)
      colabUser.setEmail('colaborador@mhmixx.com.br')
      colabUser.setPassword('Skip@Pass')
      colabUser.setVerified(true)
      colabUser.set('name', 'Colaborador MH MIXX')
      colabUser.set('nome', 'Colaborador MH MIXX')
      colabUser.set('role', 'funcionario')
      colabUser.set('ativo', true)
      app.save(colabUser)
    }

    // 2. Verificar se existe algum funcionário sem user ou criar/atualizar um funcionário vinculado
    try {
      let func = null
      try {
        func = app.findFirstRecordByData('funcionarios', 'matricula', '002')
      } catch (_) {
        // Criar funcionário 002 vinculado a este colabUser
        const cargo = app.findRecordsByFilter('cargos', '', '', 1, 0)[0]
        const dep = app.findRecordsByFilter('departamentos', '', '', 1, 0)[0]
        const jor = app.findRecordsByFilter('jornadas', '', '', 1, 0)[0]

        func = new Record(funcCol)
        func.set('nome', 'Carlos Eduardo Silva')
        func.set('cpf', '28574918032')
        func.set('matricula', '002')
        func.set('email', 'colaborador@mhmixx.com.br')
        func.set('telefone', '(12) 99123-4567')
        func.set('data_admissao', '2026-01-10 00:00:00.000Z')
        func.set('data_nascimento', '1992-05-15 00:00:00.000Z')
        func.set('tipo_vinculo', 'CLT')
        func.set('situacao', 'ativo')
        if (cargo) func.set('cargo', cargo.id)
        if (dep) func.set('departamento', dep.id)
        if (jor) func.set('jornada_atual', jor.id)
        func.set('user', colabUser.id)
        app.save(func)
      }

      if (func && !func.getString('user')) {
        func.set('user', colabUser.id)
        app.save(func)
      }
    } catch (e) {
      console.log('Erro ao criar funcionário modelo para portal: ' + e)
    }
  },
  (app) => {},
)
