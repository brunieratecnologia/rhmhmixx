migrate(
  (app) => {
    // 1. Atualizar regras de holerites para permitir que rh e admin gerenciem, e funcionario leia seus próprios
    const holeritesCol = app.findCollectionByNameOrId('holerites')
    holeritesCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || funcionario.user = @request.auth.id)"
    holeritesCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || funcionario.user = @request.auth.id)"
    holeritesCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')"
    holeritesCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')"
    holeritesCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')"
    app.save(holeritesCol)

    // 2. Atualizar regras de documentos:
    // Funcionário só pode ver documentos onde nivel_acesso != 'restrito_rh' && nivel_acesso != 'restrito_medico' && ativo = true
    const docsCol = app.findCollectionByNameOrId('documentos')
    docsCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || (funcionario.user = @request.auth.id && nivel_acesso != 'restrito_rh' && nivel_acesso != 'restrito_medico' && ativo = true))"
    docsCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || (funcionario.user = @request.auth.id && nivel_acesso != 'restrito_rh' && nivel_acesso != 'restrito_medico' && ativo = true))"
    docsCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')"
    docsCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')"
    docsCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')"
    app.save(docsCol)

    // 3. Atualizar regras de solicitacoes:
    // Funcionário pode listar e visualizar as próprias solicitações, e criar solicitação para si próprio
    const solicitacoesCol = app.findCollectionByNameOrId('solicitacoes')
    solicitacoesCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || funcionario.user = @request.auth.id)"
    solicitacoesCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || funcionario.user = @request.auth.id)"
    solicitacoesCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || funcionario.user = @request.auth.id)"
    solicitacoesCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')"
    solicitacoesCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')"
    app.save(solicitacoesCol)

    // 4. Atualizar regras de funcionarios:
    // Funcionário pode ler seu próprio registro (user = @request.auth.id)
    const funcCol = app.findCollectionByNameOrId('funcionarios')
    funcCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || user = @request.auth.id)"
    funcCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || user = @request.auth.id)"
    app.save(funcCol)

    // 5. Atualizar regras de registros_horario:
    // Funcionário pode ler seus registros, apenas admin/rh podem criar diretamente fora do terminal
    const regCol = app.findCollectionByNameOrId('registros_horario')
    regCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || funcionario.user = @request.auth.id)"
    regCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || funcionario.user = @request.auth.id)"
    app.save(regCol)

    // 6. Atualizar regras de tratamentos_ponto:
    const tratCol = app.findCollectionByNameOrId('tratamentos_ponto')
    tratCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || funcionario.user = @request.auth.id)"
    tratCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || funcionario.user = @request.auth.id)"
    app.save(tratCol)

    // 7. Atualizar dados padrão da empresa para "MH MIXX — Açaí e Frutas Congeladas"
    try {
      const empresaList = app.findRecordsByFilter('empresa', '', '', 1, 0)
      if (empresaList && empresaList.length > 0) {
        const emp = empresaList[0]
        emp.set('nome_fantasia', 'MH MIXX — Açaí e Frutas Congeladas')
        app.save(emp)
      }
    } catch (_) {}
  },
  (app) => {
    // Revert rules to previous states
  },
)
