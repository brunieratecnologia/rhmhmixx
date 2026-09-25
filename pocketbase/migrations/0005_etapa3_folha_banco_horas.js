migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const funcCol = app.findCollectionByNameOrId('funcionarios')
    const regCol = app.findCollectionByNameOrId('registros_horario')

    // 1. Extend tratamentos_ponto: allow registro to be optional (null when adding missing punch)
    // and add data_registro, hora_registro, tipo_marcacao, fechamento_folha relation
    const tratamentos = app.findCollectionByNameOrId('tratamentos_ponto')
    const regField = tratamentos.fields.getByName('registro')
    if (regField) {
      regField.required = false
    }

    if (!tratamentos.fields.getByName('data_registro')) {
      tratamentos.fields.add(
        new TextField({
          name: 'data_registro',
          required: false,
        }),
      )
    }

    if (!tratamentos.fields.getByName('hora_registro')) {
      tratamentos.fields.add(
        new TextField({
          name: 'hora_registro',
          required: false,
        }),
      )
    }

    if (!tratamentos.fields.getByName('tipo_marcacao')) {
      tratamentos.fields.add(
        new SelectField({
          name: 'tipo_marcacao',
          required: false,
          values: ['entrada', 'inicio_intervalo', 'retorno_intervalo', 'saida', 'outro'],
          maxSelect: 1,
        }),
      )
    }

    if (!tratamentos.fields.getByName('origem_ajuste')) {
      tratamentos.fields.add(
        new SelectField({
          name: 'origem_ajuste',
          required: false,
          values: ['inclusao_ponto_faltante', 'justificativa_inconsistencia', 'abono_horas'],
          maxSelect: 1,
        }),
      )
    }

    app.save(tratamentos)

    // 2. Collection fechamentos_folha
    const fechamentos = new Collection({
      name: 'fechamentos_folha',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'competencia_ano', type: 'number', required: true },
        { name: 'competencia_mes', type: 'number', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['aberto_fechamento', 'fechado'],
          maxSelect: 1,
        },
        { name: 'data_abertura_fechamento', type: 'date' },
        { name: 'data_encerramento', type: 'date' },
        {
          name: 'responsavel_abertura',
          type: 'relation',
          collectionId: usersCol.id,
          maxSelect: 1,
        },
        {
          name: 'responsavel_encerramento',
          type: 'relation',
          collectionId: usersCol.id,
          maxSelect: 1,
        },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_fechamento_comp ON fechamentos_folha (competencia_ano, competencia_mes)',
        'CREATE INDEX idx_fechamento_status ON fechamentos_folha (status)',
      ],
    })
    app.save(fechamentos)

    // 3. Collection banco_horas
    const bancoHoras = new Collection({
      name: 'banco_horas',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || funcionario.user = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || funcionario.user = @request.auth.id)",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'funcionario',
          type: 'relation',
          collectionId: funcCol.id,
          required: true,
          maxSelect: 1,
        },
        { name: 'data_referencia', type: 'date', required: true },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['credito', 'debito', 'ajuste_manual'],
          maxSelect: 1,
        },
        { name: 'minutos', type: 'number', required: true },
        { name: 'motivo', type: 'text', required: true },
        {
          name: 'usuario_responsavel',
          type: 'relation',
          collectionId: usersCol.id,
          maxSelect: 1,
        },
        { name: 'competencia_ano', type: 'number' },
        { name: 'competencia_mes', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_banco_horas_func ON banco_horas (funcionario)',
        'CREATE INDEX idx_banco_horas_data ON banco_horas (data_referencia)',
        'CREATE INDEX idx_banco_horas_comp ON banco_horas (competencia_ano, competencia_mes)',
      ],
    })
    app.save(bancoHoras)

    // 4. Extend jornadas collection with overnight indicator and interval settings if not present
    const jornadasCol = app.findCollectionByNameOrId('jornadas')
    if (!jornadasCol.fields.getByName('atravessa_meia_noite')) {
      jornadasCol.fields.add(
        new BoolField({
          name: 'atravessa_meia_noite',
          required: false,
        }),
      )
    }
    if (!jornadasCol.fields.getByName('tipo_escala')) {
      jornadasCol.fields.add(
        new SelectField({
          name: 'tipo_escala',
          required: false,
          values: ['semanal_fixa', 'escala_12x36', 'escala_6x1', 'personalizada'],
          maxSelect: 1,
        }),
      )
    }
    app.save(jornadasCol)
  },
  (app) => {
    try {
      const bh = app.findCollectionByNameOrId('banco_horas')
      app.delete(bh)
    } catch (_) {}

    try {
      const ff = app.findCollectionByNameOrId('fechamentos_folha')
      app.delete(ff)
    } catch (_) {}

    try {
      const jornadasCol = app.findCollectionByNameOrId('jornadas')
      if (jornadasCol.fields.getByName('atravessa_meia_noite')) {
        jornadasCol.fields.removeByName('atravessa_meia_noite')
      }
      if (jornadasCol.fields.getByName('tipo_escala')) {
        jornadasCol.fields.removeByName('tipo_escala')
      }
      app.save(jornadasCol)
    } catch (_) {}
  },
)
