onRecordCreateRequest(
  (e) => {
    e.next()
    try {
      const auth = e.auth
      const record = e.record
      if (!record) return

      // Do not log the audit logs creation itself to avoid recursive loops
      if (record.collection().name === 'logs_auditoria') return

      const auditCol = $app.findCollectionByNameOrId('logs_auditoria')
      const logRec = new Record(auditCol)
      if (auth) {
        logRec.set('usuario', auth.id)
      }
      logRec.set('acao', 'create')
      logRec.set('entidade', record.collection().name)
      logRec.set('entidade_id', record.id)
      logRec.set(
        'detalhes',
        'Criado registro na entidade ' + record.collection().name + ' com ID ' + record.id,
      )
      logRec.set('nivel', 'info')
      logRec.set('data', new Date().toISOString())
      $app.save(logRec)
    } catch (err) {
      console.log('Erro ao registrar log de auditoria (create):', err)
    }
  },
  'funcionarios',
  'empresa',
  'departamentos',
  'cargos',
  'jornadas',
  'ferias',
  'ausencias',
  'documentos',
)

onRecordUpdateRequest(
  (e) => {
    e.next()
    try {
      const auth = e.auth
      const record = e.record
      if (!record) return

      const auditCol = $app.findCollectionByNameOrId('logs_auditoria')
      const logRec = new Record(auditCol)
      if (auth) {
        logRec.set('usuario', auth.id)
      }
      logRec.set('acao', 'update')
      logRec.set('entidade', record.collection().name)
      logRec.set('entidade_id', record.id)
      logRec.set(
        'detalhes',
        'Atualizado registro na entidade ' + record.collection().name + ' com ID ' + record.id,
      )
      logRec.set('nivel', 'info')
      logRec.set('data', new Date().toISOString())
      $app.save(logRec)
    } catch (err) {
      console.log('Erro ao registrar log de auditoria (update):', err)
    }
  },
  'funcionarios',
  'empresa',
  'departamentos',
  'cargos',
  'jornadas',
  'ferias',
  'ausencias',
  'documentos',
)

onRecordDeleteRequest(
  (e) => {
    const auth = e.auth
    const record = e.record
    const colName = record ? record.collection().name : 'desconhecido'
    const recId = record ? record.id : ''

    e.next()

    try {
      const auditCol = $app.findCollectionByNameOrId('logs_auditoria')
      const logRec = new Record(auditCol)
      if (auth) {
        logRec.set('usuario', auth.id)
      }
      logRec.set('acao', 'delete')
      logRec.set('entidade', colName)
      logRec.set('entidade_id', recId)
      logRec.set('detalhes', 'Excluído registro na entidade ' + colName + ' com ID ' + recId)
      logRec.set('nivel', 'sensivel')
      logRec.set('data', new Date().toISOString())
      $app.save(logRec)
    } catch (err) {
      console.log('Erro ao registrar log de auditoria (delete):', err)
    }
  },
  'funcionarios',
  'departamentos',
  'cargos',
  'jornadas',
  'ferias',
  'ausencias',
  'documentos',
)
