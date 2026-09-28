migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('jornadas')

    // 1. Jornada "Segunda a Sexta" (44 horas semanais)
    // - Seg a Qui: entrada 08:00, almoço 1h (12:00 às 13:00), saída 18:00 -> 9h líquidas = 540 min por dia (4 dias = 36h)
    // - Sex: entrada 08:00, almoço 1h (12:00 às 13:00), saída 17:00 -> 8h líquidas = 480 min (1 dia = 8h)
    // - Sáb e Dom: folga.
    // Total semanal = 36h + 8h = 44 horas semanais.
    const gradeSegSex = {
      seg: {
        ativo: true,
        hora_entrada: '08:00',
        hora_inicio_intervalo: '12:00',
        hora_retorno_intervalo: '13:00',
        hora_saida: '18:00',
        duracao_min: 540,
        atravessa_meia_noite: false,
      },
      ter: {
        ativo: true,
        hora_entrada: '08:00',
        hora_inicio_intervalo: '12:00',
        hora_retorno_intervalo: '13:00',
        hora_saida: '18:00',
        duracao_min: 540,
        atravessa_meia_noite: false,
      },
      qua: {
        ativo: true,
        hora_entrada: '08:00',
        hora_inicio_intervalo: '12:00',
        hora_retorno_intervalo: '13:00',
        hora_saida: '18:00',
        duracao_min: 540,
        atravessa_meia_noite: false,
      },
      qui: {
        ativo: true,
        hora_entrada: '08:00',
        hora_inicio_intervalo: '12:00',
        hora_retorno_intervalo: '13:00',
        hora_saida: '18:00',
        duracao_min: 540,
        atravessa_meia_noite: false,
      },
      sex: {
        ativo: true,
        hora_entrada: '08:00',
        hora_inicio_intervalo: '12:00',
        hora_retorno_intervalo: '13:00',
        hora_saida: '17:00',
        duracao_min: 480,
        atravessa_meia_noite: false,
      },
      sab: {
        ativo: false,
        hora_entrada: '',
        hora_inicio_intervalo: '',
        hora_retorno_intervalo: '',
        hora_saida: '',
        duracao_min: 0,
        atravessa_meia_noite: false,
      },
      dom: {
        ativo: false,
        hora_entrada: '',
        hora_inicio_intervalo: '',
        hora_retorno_intervalo: '',
        hora_saida: '',
        duracao_min: 0,
        atravessa_meia_noite: false,
      },
    }

    let recSegSex
    try {
      recSegSex = app.findFirstRecordByData('jornadas', 'nome', 'Segunda a Sexta')
    } catch (_) {
      recSegSex = new Record(col)
      recSegSex.set('nome', 'Segunda a Sexta')
    }
    recSegSex.set('hora_entrada', '08:00')
    recSegSex.set('hora_inicio_intervalo', '12:00')
    recSegSex.set('hora_retorno_intervalo', '13:00')
    recSegSex.set('hora_saida', '18:00')
    recSegSex.set('duracao_jornada_min', 528) // média diária (44h / 5 dias = 8h48m = 528 min)
    recSegSex.set('dias_trabalho', ['seg', 'ter', 'qua', 'qui', 'sex'])
    recSegSex.set('dias_folga', ['sab', 'dom'])
    recSegSex.set('tipo_escala', 'semanal_fixa')
    recSegSex.set('atravessa_meia_noite', false)
    recSegSex.set('grade_semanal', gradeSegSex)
    app.save(recSegSex)

    // 2. Jornada chamada "SABADO" (nome exato solicitado pelo usuário)
    // - Segunda: entrada 10:00, saída 18:00, almoço 1h30 (12:00 às 13:30 ou 13:00 às 14:30) -> 6h30 = 390 min líquidas
    // - Terça a sábado: entrada 09:00, saída 18:00, almoço 1h30 (12:00 às 13:30) -> 7h30 = 450 min líquidas por dia (5 dias = 37h30)
    // - Domingo: folga.
    // Total semanal = 6h30 + 37h30 = 44 horas semanais.
    const gradeSabado = {
      seg: {
        ativo: true,
        hora_entrada: '10:00',
        hora_inicio_intervalo: '13:00',
        hora_retorno_intervalo: '14:30',
        hora_saida: '18:00',
        duracao_min: 390,
        atravessa_meia_noite: false,
      },
      ter: {
        ativo: true,
        hora_entrada: '09:00',
        hora_inicio_intervalo: '12:00',
        hora_retorno_intervalo: '13:30',
        hora_saida: '18:00',
        duracao_min: 450,
        atravessa_meia_noite: false,
      },
      qua: {
        ativo: true,
        hora_entrada: '09:00',
        hora_inicio_intervalo: '12:00',
        hora_retorno_intervalo: '13:30',
        hora_saida: '18:00',
        duracao_min: 450,
        atravessa_meia_noite: false,
      },
      qui: {
        ativo: true,
        hora_entrada: '09:00',
        hora_inicio_intervalo: '12:00',
        hora_retorno_intervalo: '13:30',
        hora_saida: '18:00',
        duracao_min: 450,
        atravessa_meia_noite: false,
      },
      sex: {
        ativo: true,
        hora_entrada: '09:00',
        hora_inicio_intervalo: '12:00',
        hora_retorno_intervalo: '13:30',
        hora_saida: '18:00',
        duracao_min: 450,
        atravessa_meia_noite: false,
      },
      sab: {
        ativo: true,
        hora_entrada: '09:00',
        hora_inicio_intervalo: '12:00',
        hora_retorno_intervalo: '13:30',
        hora_saida: '18:00',
        duracao_min: 450,
        atravessa_meia_noite: false,
      },
      dom: {
        ativo: false,
        hora_entrada: '',
        hora_inicio_intervalo: '',
        hora_retorno_intervalo: '',
        hora_saida: '',
        duracao_min: 0,
        atravessa_meia_noite: false,
      },
    }

    let recSabado
    try {
      recSabado = app.findFirstRecordByData('jornadas', 'nome', 'SABADO')
    } catch (_) {
      recSabado = new Record(col)
      recSabado.set('nome', 'SABADO')
    }
    recSabado.set('hora_entrada', '10:00')
    recSabado.set('hora_inicio_intervalo', '13:00')
    recSabado.set('hora_retorno_intervalo', '14:30')
    recSabado.set('hora_saida', '18:00')
    recSabado.set('duracao_jornada_min', 440) // média diária (44h / 6 dias = 440 min)
    recSabado.set('dias_trabalho', ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'])
    recSabado.set('dias_folga', ['dom'])
    recSabado.set('tipo_escala', 'escala_6x1')
    recSabado.set('atravessa_meia_noite', false)
    recSabado.set('grade_semanal', gradeSabado)
    app.save(recSabado)
  },
  (app) => {
    try {
      const j1 = app.findFirstRecordByData('jornadas', 'nome', 'Segunda a Sexta')
      app.delete(j1)
    } catch (_) {}
    try {
      const j2 = app.findFirstRecordByData('jornadas', 'nome', 'SABADO')
      app.delete(j2)
    } catch (_) {}
  },
)
