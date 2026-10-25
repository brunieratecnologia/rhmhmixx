migrate(
  (app) => {
    // 1. Atualizar regra de criação de ferias para bloquear novos cadastros de férias para funcionários desligados
    const feriasCol = app.findCollectionByNameOrId('ferias')
    feriasCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh') && funcionario.situacao != 'desligado'"
    app.save(feriasCol)

    // 2. Atualizar regra de criação de ausencias para bloquear novos registros para funcionários desligados
    const ausenciasCol = app.findCollectionByNameOrId('ausencias')
    ausenciasCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh') && funcionario.situacao != 'desligado'"
    app.save(ausenciasCol)

    // 3. Atualizar regra de solicitações
    const solicitacoesCol = app.findCollectionByNameOrId('solicitacoes')
    solicitacoesCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || (funcionario.user = @request.auth.id && funcionario.situacao != 'desligado'))"
    app.save(solicitacoesCol)
  },
  (app) => {
    try {
      const feriasCol = app.findCollectionByNameOrId('ferias')
      feriasCol.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')"
      app.save(feriasCol)
    } catch (_) {}

    try {
      const ausenciasCol = app.findCollectionByNameOrId('ausencias')
      ausenciasCol.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')"
      app.save(ausenciasCol)
    } catch (_) {}

    try {
      const solicitacoesCol = app.findCollectionByNameOrId('solicitacoes')
      solicitacoesCol.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || funcionario.user = @request.auth.id)"
      app.save(solicitacoesCol)
    } catch (_) {}
  },
)
