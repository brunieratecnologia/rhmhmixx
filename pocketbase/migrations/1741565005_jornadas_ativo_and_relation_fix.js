migrate(
  (app) => {
    // 1. Add 'ativo' field to 'jornadas' (default true for existing)
    const jornadasCol = app.findCollectionByNameOrId('jornadas')
    if (!jornadasCol.fields.getByName('ativo')) {
      jornadasCol.fields.add(
        new BoolField({
          name: 'ativo',
          required: false,
        }),
      )
      app.save(jornadasCol)
    }

    // Set all existing jornadas to ativo = true
    app
      .db()
      .newQuery('UPDATE jornadas SET ativo = true WHERE ativo IS NULL OR ativo = false')
      .execute()

    // 2. In historico_jornadas, modify the 'jornada' relation field to required: false and cascadeDelete: false
    // so if a jornada record is deleted or unlinked, PocketBase does not block with "required relation reference"
    const histCol = app.findCollectionByNameOrId('historico_jornadas')
    const jornadaField = histCol.fields.getByName('jornada')
    if (jornadaField) {
      jornadaField.required = false
      app.save(histCol)
    }

    // 3. In funcionarios, ensure 'jornada_atual' relation field is required: false
    const funcCol = app.findCollectionByNameOrId('funcionarios')
    const jornadaAtualField = funcCol.fields.getByName('jornada_atual')
    if (jornadaAtualField) {
      jornadaAtualField.required = false
      app.save(funcCol)
    }
  },
  (app) => {
    try {
      const jornadasCol = app.findCollectionByNameOrId('jornadas')
      if (jornadasCol.fields.getByName('ativo')) {
        jornadasCol.fields.removeByName('ativo')
        app.save(jornadasCol)
      }
    } catch (_) {}
  },
)
