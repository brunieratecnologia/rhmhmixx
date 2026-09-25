migrate(
  (app) => {
    // 1. Atualizar coleção tentativas_pin: tornar matricula opcional e adicionar pin_hash com índice
    const tentativasCol = app.findCollectionByNameOrId('tentativas_pin')

    // Modificar matricula para não ser obrigatória (se existir)
    const matriculaField = tentativasCol.fields.getByName('matricula')
    if (matriculaField) {
      matriculaField.required = false
    }

    if (!tentativasCol.fields.getByName('pin_hash')) {
      tentativasCol.fields.add(
        new TextField({
          name: 'pin_hash',
          required: false,
          max: 128,
        }),
      )
    }

    if (!tentativasCol.fields.getByName('ip')) {
      tentativasCol.fields.add(
        new TextField({
          name: 'ip',
          required: false,
          max: 64,
        }),
      )
    }

    tentativasCol.addIndex('idx_tentativas_pin_hash', false, 'pin_hash', '')
    app.save(tentativasCol)

    // 2. Coleção de histórico de versões de holerite (holerites_versoes)
    // Permite substituir holerite incorreto mantendo rastreabilidade e histórico de versões
    let funcColId = ''
    try {
      funcColId = app.findCollectionByNameOrId('funcionarios').id
    } catch (_) {}

    let holeriteColId = ''
    try {
      holeriteColId = app.findCollectionByNameOrId('holerites').id
    } catch (_) {}

    try {
      app.findCollectionByNameOrId('holerites_versoes')
    } catch (_) {
      const versoesCol = new Collection({
        name: 'holerites_versoes',
        type: 'base',
        listRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        viewRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'holerite',
            type: 'relation',
            collectionId: holeriteColId,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'funcionario',
            type: 'relation',
            collectionId: funcColId,
            required: true,
            maxSelect: 1,
          },
          { name: 'competencia_mes', type: 'number', required: true },
          { name: 'competencia_ano', type: 'number', required: true },
          { name: 'versao', type: 'number', required: true },
          { name: 'motivo_substituicao', type: 'text' },
          {
            name: 'arquivo',
            type: 'file',
            maxSelect: 1,
            maxSize: 10485760,
            mimeTypes: ['application/pdf'],
            protected: true,
          },
          {
            name: 'usuario_responsavel',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_holerites_ver_hol ON holerites_versoes (holerite)',
          'CREATE INDEX idx_holerites_ver_func ON holerites_versoes (funcionario)',
        ],
      })
      app.save(versoesCol)
    }

    // 3. Garantir campos adicionais em documentos (ex: descricao ou observacoes se conveniente)
    const docCol = app.findCollectionByNameOrId('documentos')
    if (!docCol.fields.getByName('descricao')) {
      docCol.fields.add(
        new TextField({
          name: 'descricao',
          required: false,
        }),
      )
      app.save(docCol)
    }

    // 4. Garantir campo observacoes em holerites
    const holCol = app.findCollectionByNameOrId('holerites')
    if (!holCol.fields.getByName('observacoes')) {
      holCol.fields.add(
        new TextField({
          name: 'observacoes',
          required: false,
        }),
      )
      app.save(holCol)
    }
  },
  (app) => {
    try {
      const versoes = app.findCollectionByNameOrId('holerites_versoes')
      app.delete(versoes)
    } catch (_) {}
  },
)
