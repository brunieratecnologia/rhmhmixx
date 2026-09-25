/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Ajuste de permissões de segurança:
    // 1. documentos: colaborador só visualiza documentos que lhe pertencem e que não sejam nível restrito_medico
    const docs = app.findCollectionByNameOrId('documentos')
    if (docs) {
      // Garante que o funcionário no portal nunca liste ou visualize documento médico sigiloso
      docs.listRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "rh" || (funcionario.user = @request.auth.id && nivel_acesso != "restrito_medico"))'
      docs.viewRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "rh" || (funcionario.user = @request.auth.id && nivel_acesso != "restrito_medico"))'
      app.save(docs)
    }

    // 2. registros_horario: registros originais são estritamente imutáveis
    // Inclusões/ajustes manuais só ocorrem via hook de fechamento mensal rh_fechamento_ajustar
    const regHorario = app.findCollectionByNameOrId('registros_horario')
    if (regHorario) {
      regHorario.updateRule = null
      regHorario.deleteRule = '@request.auth.role = "admin"'
      app.save(regHorario)
    }

    // 3. logs_auditoria: imutável e acessível apenas para admin
    const logs = app.findCollectionByNameOrId('logs_auditoria')
    if (logs) {
      logs.createRule = null // Apenas inserção via hooks server-side com superuser
      logs.updateRule = null
      logs.deleteRule = null
      logs.listRule = '@request.auth.role = "admin"'
      logs.viewRule = '@request.auth.role = "admin"'
      app.save(logs)
    }
  },
  (app) => {
    // Revert
  },
)
