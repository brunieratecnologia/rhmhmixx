migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('jornadas')
    if (!col.fields.getByName('grade_semanal')) {
      col.fields.add(
        new JSONField({
          name: 'grade_semanal',
          required: false,
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('jornadas')
    const field = col.fields.getByName('grade_semanal')
    if (field) {
      col.fields.removeByName('grade_semanal')
      app.save(col)
    }
  },
)
