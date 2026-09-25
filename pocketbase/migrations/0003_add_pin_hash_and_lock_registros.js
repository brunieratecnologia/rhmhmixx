migrate(
  (app) => {
    // 1. Add pin_hash to funcionarios collection (hidden)
    const funcionarios = app.findCollectionByNameOrId('funcionarios')

    if (!funcionarios.fields.getByName('pin_hash')) {
      funcionarios.fields.add(
        new TextField({
          name: 'pin_hash',
          required: false,
          hidden: true,
        }),
      )
    }

    app.save(funcionarios)

    // 2. Ensure registros_horario collection rules are immutable
    // In Etapa 2, time punches can be created by authenticated requests or hooks.
    // Original punches cannot be updated or deleted via API.
    const registros = app.findCollectionByNameOrId('registros_horario')
    registros.updateRule = null
    registros.deleteRule = null
    app.save(registros)
  },
  (app) => {
    const funcionarios = app.findCollectionByNameOrId('funcionarios')
    if (funcionarios.fields.getByName('pin_hash')) {
      funcionarios.fields.removeByName('pin_hash')
      app.save(funcionarios)
    }
  },
)
