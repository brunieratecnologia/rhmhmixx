migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('registros_horario')
    if (!col.fields.getByName('offline_sync')) {
      col.fields.add(
        new BoolField({
          name: 'offline_sync',
          required: false,
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('registros_horario')
    if (col.fields.getByName('offline_sync')) {
      col.fields.removeByName('offline_sync')
      app.save(col)
    }
  },
)
