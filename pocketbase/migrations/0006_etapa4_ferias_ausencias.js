migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const funcCol = app.findCollectionByNameOrId('funcionarios')
    const feriasCol = app.findCollectionByNameOrId('ferias')
    const ausenciasCol = app.findCollectionByNameOrId('ausencias')

    // 1. Atualizar e enriquecer coleção 'ferias'
    // Status deve aceitar: programada | em_gozo | concluida | cancelada | solicitado | aprovado
    const statusField = feriasCol.fields.getByName('status')
    if (statusField) {
      statusField.values = [
        'programada',
        'em_gozo',
        'concluida',
        'cancelada',
        'solicitado',
        'aprovado',
      ]
      statusField.maxSelect = 1
    }

    if (!feriasCol.fields.getByName('dias_abono')) {
      feriasCol.fields.add(
        new NumberField({
          name: 'dias_abono',
          required: false,
          min: 0,
          max: 10,
        }),
      )
    }

    if (!feriasCol.fields.getByName('observacoes')) {
      feriasCol.fields.add(
        new TextField({
          name: 'observacoes',
          required: false,
        }),
      )
    }

    if (!feriasCol.fields.getByName('justificativa_rh')) {
      feriasCol.fields.add(
        new TextField({
          name: 'justificativa_rh',
          required: false,
        }),
      )
    }

    if (!feriasCol.fields.getByName('faltas_injustificadas_periodo')) {
      feriasCol.fields.add(
        new NumberField({
          name: 'faltas_injustificadas_periodo',
          required: false,
          min: 0,
        }),
      )
    }

    if (!feriasCol.fields.getByName('usuario_responsavel')) {
      feriasCol.fields.add(
        new RelationField({
          name: 'usuario_responsavel',
          collectionId: usersCol.id,
          required: false,
          maxSelect: 1,
        }),
      )
    }

    // Permitir permissões tanto para admin quanto rh
    feriasCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || funcionario.user = @request.auth.id)"
    feriasCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || funcionario.user = @request.auth.id)"
    feriasCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')"
    feriasCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')"
    feriasCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')"

    app.save(feriasCol)

    // 2. Atualizar e enriquecer coleção 'ausencias'
    // Categoria: falta | atraso_justificado | atestado | afastamento | licenca | folga_compensatoria
    // Situacao: informada | justificada | abonada | nao_justificada
    if (!ausenciasCol.fields.getByName('situacao')) {
      ausenciasCol.fields.add(
        new SelectField({
          name: 'situacao',
          required: false,
          values: ['informada', 'justificada', 'abonada', 'nao_justificada'],
          maxSelect: 1,
        }),
      )
    }

    if (!ausenciasCol.fields.getByName('usuario_responsavel')) {
      ausenciasCol.fields.add(
        new RelationField({
          name: 'usuario_responsavel',
          collectionId: usersCol.id,
          required: false,
          maxSelect: 1,
        }),
      )
    }

    if (!ausenciasCol.fields.getByName('impacta_aquisitivo')) {
      ausenciasCol.fields.add(
        new BoolField({
          name: 'impacta_aquisitivo',
          required: false,
        }),
      )
    }

    if (!ausenciasCol.fields.getByName('observacoes')) {
      ausenciasCol.fields.add(
        new TextField({
          name: 'observacoes',
          required: false,
        }),
      )
    }

    ausenciasCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || funcionario.user = @request.auth.id)"
    ausenciasCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh' || funcionario.user = @request.auth.id)"
    ausenciasCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')"
    ausenciasCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')"
    ausenciasCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'rh')"

    app.save(ausenciasCol)
  },
  (app) => {
    // down migration
    try {
      const feriasCol = app.findCollectionByNameOrId('ferias')
      if (feriasCol.fields.getByName('dias_abono')) {
        feriasCol.fields.removeByName('dias_abono')
      }
      if (feriasCol.fields.getByName('observacoes')) {
        feriasCol.fields.removeByName('observacoes')
      }
      if (feriasCol.fields.getByName('justificativa_rh')) {
        feriasCol.fields.removeByName('justificativa_rh')
      }
      if (feriasCol.fields.getByName('faltas_injustificadas_periodo')) {
        feriasCol.fields.removeByName('faltas_injustificadas_periodo')
      }
      if (feriasCol.fields.getByName('usuario_responsavel')) {
        feriasCol.fields.removeByName('usuario_responsavel')
      }
      app.save(feriasCol)
    } catch (_) {}

    try {
      const ausenciasCol = app.findCollectionByNameOrId('ausencias')
      if (ausenciasCol.fields.getByName('situacao')) {
        ausenciasCol.fields.removeByName('situacao')
      }
      if (ausenciasCol.fields.getByName('usuario_responsavel')) {
        ausenciasCol.fields.removeByName('usuario_responsavel')
      }
      if (ausenciasCol.fields.getByName('impacta_aquisitivo')) {
        ausenciasCol.fields.removeByName('impacta_aquisitivo')
      }
      if (ausenciasCol.fields.getByName('observacoes')) {
        ausenciasCol.fields.removeByName('observacoes')
      }
      app.save(ausenciasCol)
    } catch (_) {}
  },
)
