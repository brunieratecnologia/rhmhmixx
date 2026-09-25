migrate(
  (app) => {
    // 1. Update users collection with role, nome, ativo, pin_hash
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!users.fields.getByName('role')) {
      users.fields.add(
        new SelectField({
          name: 'role',
          required: false,
          values: ['admin', 'rh', 'funcionario'],
          maxSelect: 1,
        }),
      )
    }

    if (!users.fields.getByName('nome')) {
      users.fields.add(
        new TextField({
          name: 'nome',
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('ativo')) {
      users.fields.add(
        new BoolField({
          name: 'ativo',
          required: false,
        }),
      )
    }

    if (!users.fields.getByName('pin_hash')) {
      users.fields.add(
        new TextField({
          name: 'pin_hash',
          required: false,
          hidden: true,
        }),
      )
    }

    // Set access rules for users
    users.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.id = id)"
    users.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.id = id)"
    users.createRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    users.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.id = id)"
    users.deleteRule =
      "@request.auth.id != '' && @request.auth.role = 'admin' && @request.auth.id != id"

    app.save(users)

    // 2. Create empresa collection (single record expected)
    const empresa = new Collection({
      name: 'empresa',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'razao_social', type: 'text' },
        { name: 'nome_fantasia', type: 'text' },
        { name: 'cnpj', type: 'text' },
        { name: 'endereco', type: 'text' },
        { name: 'telefone', type: 'text' },
        { name: 'email', type: 'text' },
        {
          name: 'logotipo',
          type: 'file',
          maxSelect: 1,
          maxSize: 2097152,
          mimeTypes: ['image/jpeg', 'image/png'],
        },
        { name: 'fuso_horario', type: 'text' },
        { name: 'responsavel_rh', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_empresa_cnpj ON empresa (cnpj) WHERE cnpj != ''"],
    })
    app.save(empresa)

    // 3. Create departamentos
    const departamentos = new Collection({
      name: 'departamentos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_departamentos_nome ON departamentos (nome)'],
    })
    app.save(departamentos)

    // 4. Create cargos
    const cargos = new Collection({
      name: 'cargos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_cargos_nome ON cargos (nome)'],
    })
    app.save(cargos)

    // 5. Create jornadas
    const jornadas = new Collection({
      name: 'jornadas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'nome', type: 'text', required: true },
        {
          name: 'dias_trabalho',
          type: 'select',
          values: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'],
          maxSelect: 7,
        },
        { name: 'hora_entrada', type: 'text' },
        { name: 'hora_inicio_intervalo', type: 'text' },
        { name: 'hora_retorno_intervalo', type: 'text' },
        { name: 'hora_saida', type: 'text' },
        { name: 'duracao_jornada_min', type: 'number' },
        {
          name: 'dias_folga',
          type: 'select',
          values: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'],
          maxSelect: 7,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_jornadas_nome ON jornadas (nome)'],
    })
    app.save(jornadas)

    const cargosCol = app.findCollectionByNameOrId('cargos')
    const depCol = app.findCollectionByNameOrId('departamentos')
    const jorCol = app.findCollectionByNameOrId('jornadas')

    // 6. Create funcionarios
    const funcionarios = new Collection({
      name: 'funcionarios',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || user = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || user = @request.auth.id)",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'user', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'nome', type: 'text', required: true },
        { name: 'cpf', type: 'text', required: true },
        { name: 'data_nascimento', type: 'date' },
        { name: 'telefone', type: 'text' },
        { name: 'email', type: 'email', required: true },
        { name: 'endereco', type: 'text' },
        {
          name: 'fotografia',
          type: 'file',
          maxSelect: 1,
          maxSize: 2097152,
          mimeTypes: ['image/jpeg', 'image/png'],
        },
        { name: 'contato_emergencia', type: 'text' },
        { name: 'matricula', type: 'text', required: true },
        { name: 'data_admissao', type: 'date', required: true },
        { name: 'cargo', type: 'relation', collectionId: cargosCol.id, maxSelect: 1 },
        { name: 'departamento', type: 'relation', collectionId: depCol.id, maxSelect: 1 },
        {
          name: 'tipo_vinculo',
          type: 'select',
          values: ['CLT', 'Estágio', 'PJ', 'Terceirizado', 'Aprendiz'],
          maxSelect: 1,
        },
        { name: 'jornada_atual', type: 'relation', collectionId: jorCol.id, maxSelect: 1 },
        {
          name: 'situacao',
          type: 'select',
          values: ['ativo', 'afastado', 'em_ferias', 'desligado'],
          maxSelect: 1,
        },
        { name: 'data_desligamento', type: 'date' },
        { name: 'salario_contratual', type: 'number' },
        { name: 'data_inicio_contrato', type: 'date' },
        {
          name: 'tipo_contrato',
          type: 'select',
          values: ['CLT', 'Estágio', 'PJ', 'Terceirizado', 'Aprendiz'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_funcionarios_cpf ON funcionarios (cpf)',
        'CREATE UNIQUE INDEX idx_funcionarios_matricula ON funcionarios (matricula)',
        'CREATE UNIQUE INDEX idx_funcionarios_email ON funcionarios (email)',
        'CREATE INDEX idx_funcionarios_situacao ON funcionarios (situacao)',
        'CREATE INDEX idx_funcionarios_cargo ON funcionarios (cargo)',
        'CREATE INDEX idx_funcionarios_departamento ON funcionarios (departamento)',
      ],
    })
    app.save(funcionarios)

    const funcCol = app.findCollectionByNameOrId('funcionarios')

    // 7. historico_jornadas
    const histJornadas = new Collection({
      name: 'historico_jornadas',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || funcionario.user = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || funcionario.user = @request.auth.id)",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'funcionario',
          type: 'relation',
          collectionId: funcCol.id,
          required: true,
          maxSelect: 1,
        },
        {
          name: 'jornada',
          type: 'relation',
          collectionId: jorCol.id,
          required: true,
          maxSelect: 1,
        },
        { name: 'data_inicio', type: 'date', required: true },
        { name: 'data_fim', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_hist_jornadas_func ON historico_jornadas (funcionario)'],
    })
    app.save(histJornadas)

    // 8. registros_horario
    const registrosHorario = new Collection({
      name: 'registros_horario',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || funcionario.user = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || funcionario.user = @request.auth.id)",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'funcionario',
          type: 'relation',
          collectionId: funcCol.id,
          required: true,
          maxSelect: 1,
        },
        { name: 'data_utc', type: 'date' },
        { name: 'hora_utc', type: 'text' },
        { name: 'timestamp_utc', type: 'date' },
        { name: 'origem', type: 'select', values: ['terminal', 'admin', 'portal'], maxSelect: 1 },
        { name: 'id_requisicao', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_reg_horario_func ON registros_horario (funcionario)',
        'CREATE INDEX idx_reg_horario_timestamp ON registros_horario (timestamp_utc)',
        'CREATE INDEX idx_reg_horario_data ON registros_horario (data_utc)',
        "CREATE UNIQUE INDEX idx_reg_horario_req ON registros_horario (id_requisicao) WHERE id_requisicao != ''",
      ],
    })
    app.save(registrosHorario)

    const regCol = app.findCollectionByNameOrId('registros_horario')

    // 9. tratamentos_ponto
    const tratamentosPonto = new Collection({
      name: 'tratamentos_ponto',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || funcionario.user = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || funcionario.user = @request.auth.id)",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'registro',
          type: 'relation',
          collectionId: regCol.id,
          required: true,
          maxSelect: 1,
        },
        {
          name: 'funcionario',
          type: 'relation',
          collectionId: funcCol.id,
          required: true,
          maxSelect: 1,
        },
        {
          name: 'tipo',
          type: 'select',
          values: ['justificativa', 'correcao', 'classificacao'],
          maxSelect: 1,
        },
        { name: 'justificativa', type: 'text' },
        {
          name: 'usuario_responsavel',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'data_tratamento', type: 'date' },
        { name: 'informacao_corrigida', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_tratamentos_func ON tratamentos_ponto (funcionario)'],
    })
    app.save(tratamentosPonto)

    // 10. ferias
    const ferias = new Collection({
      name: 'ferias',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || funcionario.user = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || funcionario.user = @request.auth.id)",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'funcionario',
          type: 'relation',
          collectionId: funcCol.id,
          required: true,
          maxSelect: 1,
        },
        { name: 'data_inicio', type: 'date', required: true },
        { name: 'data_fim', type: 'date', required: true },
        { name: 'dias', type: 'number' },
        { name: 'tipo', type: 'select', values: ['integral', 'fracionada'], maxSelect: 1 },
        {
          name: 'status',
          type: 'select',
          values: ['solicitado', 'aprovado', 'concluido'],
          maxSelect: 1,
        },
        { name: 'periodo_aquisitivo_inicio', type: 'date' },
        { name: 'periodo_aquisitivo_fim', type: 'date' },
        { name: 'periodo_concessivo_fim', type: 'date' },
        { name: 'saldo_dias', type: 'number' },
        { name: 'dias_usufruidos', type: 'number' },
        { name: 'solicitado_por', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_ferias_func ON ferias (funcionario)',
        'CREATE INDEX idx_ferias_inicio ON ferias (data_inicio)',
        'CREATE INDEX idx_ferias_status ON ferias (status)',
      ],
    })
    app.save(ferias)

    // 11. documentos
    const documentos = new Collection({
      name: 'documentos',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || (funcionario.user = @request.auth.id && nivel_acesso != 'restrito_medico'))",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || (funcionario.user = @request.auth.id && nivel_acesso != 'restrito_medico'))",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'funcionario',
          type: 'relation',
          collectionId: funcCol.id,
          required: true,
          maxSelect: 1,
        },
        {
          name: 'categoria',
          type: 'select',
          values: [
            'contrato_trabalho',
            'documentacao_admissional',
            'atestado_medico',
            'comprovantes',
            'termos_internos',
            'documentos_ferias',
            'outros',
          ],
          maxSelect: 1,
        },
        { name: 'nome', type: 'text', required: true },
        { name: 'data_envio', type: 'date' },
        { name: 'data_validade', type: 'date' },
        {
          name: 'arquivo',
          type: 'file',
          maxSelect: 1,
          maxSize: 10485760,
          mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
          protected: true,
        },
        {
          name: 'nivel_acesso',
          type: 'select',
          values: ['publico_interno', 'restrito_rh', 'restrito_medico'],
          maxSelect: 1,
        },
        {
          name: 'usuario_responsavel',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_documentos_func ON documentos (funcionario)',
        'CREATE INDEX idx_documentos_data_envio ON documentos (data_envio)',
        'CREATE INDEX idx_documentos_validade ON documentos (data_validade)',
      ],
    })
    app.save(documentos)

    const docCol = app.findCollectionByNameOrId('documentos')

    // 12. ausencias
    const ausencias = new Collection({
      name: 'ausencias',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || funcionario.user = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || funcionario.user = @request.auth.id)",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'funcionario',
          type: 'relation',
          collectionId: funcCol.id,
          required: true,
          maxSelect: 1,
        },
        {
          name: 'categoria',
          type: 'select',
          values: [
            'falta',
            'atraso_justificado',
            'atestado',
            'afastamento',
            'licenca',
            'folga_compensatoria',
          ],
          maxSelect: 1,
        },
        { name: 'data_inicio', type: 'date', required: true },
        { name: 'data_fim', type: 'date' },
        { name: 'justificativa', type: 'text' },
        { name: 'documentos', type: 'relation', collectionId: docCol.id, maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_ausencias_func ON ausencias (funcionario)',
        'CREATE INDEX idx_ausencias_inicio ON ausencias (data_inicio)',
      ],
    })
    app.save(ausencias)

    // 13. holerites
    const holerites = new Collection({
      name: 'holerites',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || funcionario.user = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || funcionario.user = @request.auth.id)",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'funcionario',
          type: 'relation',
          collectionId: funcCol.id,
          required: true,
          maxSelect: 1,
        },
        { name: 'competencia_mes', type: 'number', required: true },
        { name: 'competencia_ano', type: 'number', required: true },
        { name: 'data_envio', type: 'date' },
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
        { name: 'versao', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_holerites_func ON holerites (funcionario)',
        'CREATE INDEX idx_holerites_competencia ON holerites (competencia_ano, competencia_mes)',
      ],
    })
    app.save(holerites)

    // 14. solicitacoes
    const solicitacoes = new Collection({
      name: 'solicitacoes',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || funcionario.user = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || funcionario.user = @request.auth.id)",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || funcionario.user = @request.auth.id)",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'funcionario',
          type: 'relation',
          collectionId: funcCol.id,
          required: true,
          maxSelect: 1,
        },
        {
          name: 'tipo',
          type: 'select',
          values: ['correcao_ponto', 'justificativa', 'ferias', 'documento', 'outro'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          values: ['pendente', 'aprovado', 'recusado', 'cancelado'],
          maxSelect: 1,
        },
        { name: 'motivo', type: 'text' },
        { name: 'detalhes', type: 'text' },
        { name: 'decidido_por', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'decidido_em', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_solicitacoes_func ON solicitacoes (funcionario)',
        'CREATE INDEX idx_solicitacoes_status ON solicitacoes (status)',
      ],
    })
    app.save(solicitacoes)

    // 15. logs_auditoria
    const logsAuditoria = new Collection({
      name: 'logs_auditoria',
      type: 'base',
      listRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      viewRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'usuario', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'acao', type: 'text', required: true },
        { name: 'entidade', type: 'text' },
        { name: 'entidade_id', type: 'text' },
        { name: 'detalhes', type: 'text' },
        { name: 'ip', type: 'text' },
        { name: 'data', type: 'date' },
        { name: 'nivel', type: 'select', values: ['info', 'sensivel'], maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_logs_entidade ON logs_auditoria (entidade, entidade_id)',
        'CREATE INDEX idx_logs_data ON logs_auditoria (data)',
      ],
    })
    app.save(logsAuditoria)

    // 16. historico_funcionario
    const historicoFuncionario = new Collection({
      name: 'historico_funcionario',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || funcionario.user = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || funcionario.user = @request.auth.id)",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'funcionario',
          type: 'relation',
          collectionId: funcCol.id,
          required: true,
          maxSelect: 1,
        },
        {
          name: 'tipo',
          type: 'select',
          values: [
            'cadastro',
            'edicao',
            'promocao',
            'desligamento',
            'reativacao',
            'alteracao_salarial',
            'outro',
          ],
          maxSelect: 1,
        },
        { name: 'descricao', type: 'text' },
        { name: 'data', type: 'date' },
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
        'CREATE INDEX idx_hist_func_func ON historico_funcionario (funcionario)',
        'CREATE INDEX idx_hist_func_data ON historico_funcionario (data)',
      ],
    })
    app.save(historicoFuncionario)

    // 17. tentativas_pin (preparação para Etapa 2)
    const tentativasPin = new Collection({
      name: 'tentativas_pin',
      type: 'base',
      listRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      viewRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'matricula', type: 'text', required: true },
        { name: 'tentativas', type: 'number' },
        { name: 'bloqueado_ate', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_tentativas_pin_mat ON tentativas_pin (matricula)'],
    })
    app.save(tentativasPin)
  },
  (app) => {
    const toDelete = [
      'tentativas_pin',
      'historico_funcionario',
      'logs_auditoria',
      'solicitacoes',
      'holerites',
      'ausencias',
      'documentos',
      'ferias',
      'tratamentos_ponto',
      'registros_horario',
      'historico_jornadas',
      'funcionarios',
      'jornadas',
      'cargos',
      'departamentos',
      'empresa',
    ]
    for (const name of toDelete) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
