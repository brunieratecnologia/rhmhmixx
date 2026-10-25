import {
  calcularPrevistoJornada,
  calcularHorasRealizadas,
  construirEspelhoMensal,
  timeStringToMinutes,
  minutesToTimeString,
} from './calculoHoras'
import type { Jornada, RegistroHorario, TratamentoPonto } from '@/types/rh'

// Test Suite para Intervalo Automático de Almoço
export function executarTestesIntervaloAutomatico(): {
  todosPassaram: boolean
  resultados: { nome: string; passou: boolean; detalhe: string }[]
} {
  const resultados: { nome: string; passou: boolean; detalhe: string }[] = []

  const jornadaPadrao: Jornada = {
    id: 'jornada-comercial-1',
    nome: 'Comercial 08h às 17h',
    dias_trabalho: ['seg', 'ter', 'qua', 'qui', 'sex'],
    dias_folga: ['sab', 'dom'],
    hora_entrada: '08:00',
    hora_inicio_intervalo: '12:00',
    hora_retorno_intervalo: '13:00',
    hora_saida: '17:00',
    duracao_jornada_min: 480, // 8h
    atravessa_meia_noite: false,
    created: '',
    updated: '',
  }

  const jornadaNoturna: Jornada = {
    id: 'jornada-noturna-1',
    nome: 'Noturna 22h às 06h',
    dias_trabalho: ['seg', 'ter', 'qua', 'qui', 'sex'],
    dias_folga: ['sab', 'dom'],
    hora_entrada: '22:00',
    hora_inicio_intervalo: '02:00',
    hora_retorno_intervalo: '03:00',
    hora_saida: '06:00',
    duracao_jornada_min: 420, // 7h líquidas
    atravessa_meia_noite: true,
    created: '',
    updated: '',
  }

  // TESTE 1: Dia com entrada e saída batidas (2 batidas) e sem almoço
  // Previsto: 480 min (8h). Entrada 08:00, Saída 17:00. Total permanência: 9h (540m).
  // Com intervalo auto de 60m (12:00 às 13:00): Realizado = 480 min. Diferença = 0.
  {
    const regs: RegistroHorario[] = [
      {
        id: 'r1',
        funcionario: 'f1',
        data_utc: '2026-09-01',
        hora_utc: '08:00:00',
        timestamp_utc: '2026-09-01T11:00:00.000Z', // 08:00 America/Sao_Paulo
        origem: 'terminal',
        created: '',
        updated: '',
      },
      {
        id: 'r2',
        funcionario: 'f1',
        data_utc: '2026-09-01',
        hora_utc: '17:00:00',
        timestamp_utc: '2026-09-01T20:00:00.000Z', // 17:00 America/Sao_Paulo
        origem: 'terminal',
        created: '',
        updated: '',
      },
    ]

    const res = calcularHorasRealizadas(regs, [], jornadaPadrao, { ehDiaFolga: false })
    const passou =
      res.minutosTrabalhados === 480 &&
      res.intervaloAutomaticoAplicado === true &&
      res.todasMarcacoes.length === 4 &&
      res.todasMarcacoes[1].origem === 'intervalo_automatico' &&
      res.todasMarcacoes[1].horario === '12:00' &&
      res.todasMarcacoes[2].horario === '13:00' &&
      !res.isIncompleto

    resultados.push({
      nome: 'Teste (a): Entrada + Saída sem batida de almoço aplica intervalo automático',
      passou,
      detalhe: `Trabalhado: ${res.minutosTrabalhados}m (esperado 480m), autoAplicado: ${res.intervaloAutomaticoAplicado}, totalMarcacoes: ${res.todasMarcacoes.length}`,
    })
  }

  // TESTE 2: Dia com as 4 marcações reais batidas (não deve haver duplo desconto)
  // Entrada 08:00, Saída Almoço 12:00, Retorno Almoço 13:00, Saída 17:00
  // Realizado deve ser exatamente 480 min, sem adicionar mais nenhum intervalo
  {
    const regs: RegistroHorario[] = [
      {
        id: 'r1',
        funcionario: 'f1',
        data_utc: '2026-09-02',
        hora_utc: '08:00:00',
        timestamp_utc: '2026-09-02T11:00:00.000Z',
        origem: 'terminal',
        created: '',
        updated: '',
      },
      {
        id: 'r2',
        funcionario: 'f1',
        data_utc: '2026-09-02',
        hora_utc: '12:00:00',
        timestamp_utc: '2026-09-02T15:00:00.000Z',
        origem: 'terminal',
        created: '',
        updated: '',
      },
      {
        id: 'r3',
        funcionario: 'f1',
        data_utc: '2026-09-02',
        hora_utc: '13:00:00',
        timestamp_utc: '2026-09-02T16:00:00.000Z',
        origem: 'terminal',
        created: '',
        updated: '',
      },
      {
        id: 'r4',
        funcionario: 'f1',
        data_utc: '2026-09-02',
        hora_utc: '17:00:00',
        timestamp_utc: '2026-09-02T20:00:00.000Z',
        origem: 'terminal',
        created: '',
        updated: '',
      },
    ]

    const res = calcularHorasRealizadas(regs, [], jornadaPadrao, { ehDiaFolga: false })
    const passou =
      res.minutosTrabalhados === 480 &&
      res.intervaloAutomaticoAplicado === false &&
      res.todasMarcacoes.length === 4 &&
      res.todasMarcacoes.every((m) => m.origem === 'terminal')

    resultados.push({
      nome: 'Teste (b): 4 batidas reais preservadas sem duplo desconto',
      passou,
      detalhe: `Trabalhado: ${res.minutosTrabalhados}m (esperado 480m), autoAplicado: ${res.intervaloAutomaticoAplicado}`,
    })
  }

  // TESTE 3: Jornada noturna com virada de meia-noite (22:00 às 06:00, almoço 02:00 às 03:00)
  // Colaborador bateu 22:00 e saiu 06:00 (permanência 8h = 480m).
  // Intervalo previsto: 02:00 às 03:00 (60m).
  // Realizado: 420m (7h líquidas).
  {
    const regs: RegistroHorario[] = [
      {
        id: 'rn1',
        funcionario: 'f1',
        data_utc: '2026-09-03',
        hora_utc: '22:00:00',
        timestamp_utc: '2026-09-04T01:00:00.000Z', // 22:00 SP
        origem: 'terminal',
        created: '',
        updated: '',
      },
      {
        id: 'rn2',
        funcionario: 'f1',
        data_utc: '2026-09-04',
        hora_utc: '06:00:00',
        timestamp_utc: '2026-09-04T09:00:00.000Z', // 06:00 SP
        origem: 'terminal',
        created: '',
        updated: '',
      },
    ]

    const res = calcularHorasRealizadas(regs, [], jornadaNoturna, { ehDiaFolga: false })
    const passou =
      res.minutosTrabalhados === 420 &&
      res.intervaloAutomaticoAplicado === true &&
      res.todasMarcacoes[1].horario === '02:00' &&
      res.todasMarcacoes[2].horario === '03:00'

    resultados.push({
      nome: 'Teste (c): Intervalo automático em jornada noturna que cruza a meia-noite',
      passou,
      detalhe: `Trabalhado: ${res.minutosTrabalhados}m (esperado 420m), autoAplicado: ${res.intervaloAutomaticoAplicado}`,
    })
  }

  // TESTE 4: Marcação incompleta (1 batida só às 08:00)
  // Não deve aplicar intervalo automático e deve marcar como incompleto
  {
    const regs: RegistroHorario[] = [
      {
        id: 'r1',
        funcionario: 'f1',
        data_utc: '2026-09-05',
        hora_utc: '08:00:00',
        timestamp_utc: '2026-09-05T11:00:00.000Z',
        origem: 'terminal',
        created: '',
        updated: '',
      },
    ]

    const res = calcularHorasRealizadas(regs, [], jornadaPadrao, { ehDiaFolga: false })
    const passou = res.isIncompleto === true && res.intervaloAutomaticoAplicado === false

    resultados.push({
      nome: 'Teste (d): Marcação incompleta (1 batida) não aplica intervalo auto e aponta pendência',
      passou,
      detalhe: `isIncompleto: ${res.isIncompleto}, autoAplicado: ${res.intervaloAutomaticoAplicado}`,
    })
  }

  // TESTE 5: Saída antes do almoço (ex: 08:00 às 11:30 e o almoço é 12:00 às 13:00)
  // Não deve descontar intervalo automático pois o colaborador não permaneceu durante o intervalo
  {
    const regs: RegistroHorario[] = [
      {
        id: 'r1',
        funcionario: 'f1',
        data_utc: '2026-09-06',
        hora_utc: '08:00:00',
        timestamp_utc: '2026-09-06T11:00:00.000Z',
        origem: 'terminal',
        created: '',
        updated: '',
      },
      {
        id: 'r2',
        funcionario: 'f1',
        data_utc: '2026-09-06',
        hora_utc: '11:30:00',
        timestamp_utc: '2026-09-06T14:30:00.000Z',
        origem: 'terminal',
        created: '',
        updated: '',
      },
    ]

    const res = calcularHorasRealizadas(regs, [], jornadaPadrao, { ehDiaFolga: false })
    const passou = res.minutosTrabalhados === 210 && res.intervaloAutomaticoAplicado === false

    resultados.push({
      nome: 'Teste (e): Saída antes do intervalo não sofre desconto indevido',
      passou,
      detalhe: `Trabalhado: ${res.minutosTrabalhados}m (esperado 210m = 3h30), autoAplicado: ${res.intervaloAutomaticoAplicado}`,
    })
  }

  // TESTE 6: Consistência de fechamento mensal e saldo de banco de horas
  {
    const espelho = construirEspelhoMensal({
      ano: 2026,
      mes: 9, // Setembro 2026 (30 dias)
      jornadaAtual: jornadaPadrao,
      historicoJornadas: [],
      registrosMes: [
        // Dia 01 (terça-feira): trabalhou 08:00 às 17:00 sem bater almoço -> 8h realizadas, previsto 8h => saldo 0
        {
          id: 'm1',
          funcionario: 'f1',
          data_utc: '2026-09-01',
          hora_utc: '08:00:00',
          timestamp_utc: '2026-09-01T11:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        {
          id: 'm2',
          funcionario: 'f1',
          data_utc: '2026-09-01',
          hora_utc: '17:00:00',
          timestamp_utc: '2026-09-01T20:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
      ],
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
    })

    const dia1 = espelho.dias.find((d) => d.data === '2026-09-01')
    const passou =
      Boolean(dia1) &&
      dia1?.realizadoMinutos === 480 &&
      dia1?.diferencaMinutos === 0 &&
      dia1?.intervaloAutomaticoAplicado === true

    resultados.push({
      nome: 'Teste (f): Espelho mensal reflete 08:00 realizadas e saldo exato com a jornada',
      passou,
      detalhe: `Dia 1 Realizado: ${dia1?.realizadoMinutos}m, Dif: ${dia1?.diferencaMinutos}m, Auto: ${dia1?.intervaloAutomaticoAplicado}`,
    })
  }

  // TESTE 7: Jornada SÁBADO com horários diferentes por dia da semana
  // Segunda: 10:00–18:00 com 1h30 intervalo (12:30–14:00) -> 6h30 = 390 min
  // Terça a Sexta: 09:00–18:00 com 1h30 intervalo (12:30–14:00) -> 7h30 = 450 min
  // Sábado e Domingo: folga -> previsto 0
  {
    const jornadaSabado: Jornada = {
      id: 'j-sabado-teste',
      nome: 'SÁBADO',
      dias_trabalho: ['seg', 'ter', 'qua', 'qui', 'sex'],
      hora_entrada: '09:00',
      hora_inicio_intervalo: '12:30',
      hora_retorno_intervalo: '14:00',
      hora_saida: '18:00',
      duracao_jornada_min: 438,
      dias_folga: ['sab', 'dom'],
      grade_semanal: {
        seg: {
          ativo: true,
          hora_entrada: '10:00',
          hora_inicio_intervalo: '12:30',
          hora_retorno_intervalo: '14:00',
          hora_saida: '18:00',
          duracao_min: 390,
          atravessa_meia_noite: false,
        },
        ter: {
          ativo: true,
          hora_entrada: '09:00',
          hora_inicio_intervalo: '12:30',
          hora_retorno_intervalo: '14:00',
          hora_saida: '18:00',
          duracao_min: 450,
          atravessa_meia_noite: false,
        },
        qua: {
          ativo: true,
          hora_entrada: '09:00',
          hora_inicio_intervalo: '12:30',
          hora_retorno_intervalo: '14:00',
          hora_saida: '18:00',
          duracao_min: 450,
          atravessa_meia_noite: false,
        },
        qui: {
          ativo: true,
          hora_entrada: '09:00',
          hora_inicio_intervalo: '12:30',
          hora_retorno_intervalo: '14:00',
          hora_saida: '18:00',
          duracao_min: 450,
          atravessa_meia_noite: false,
        },
        sex: {
          ativo: true,
          hora_entrada: '09:00',
          hora_inicio_intervalo: '12:30',
          hora_retorno_intervalo: '14:00',
          hora_saida: '18:00',
          duracao_min: 450,
          atravessa_meia_noite: false,
        },
        sab: {
          ativo: false,
          hora_entrada: '',
          hora_saida: '',
          duracao_min: 0,
          atravessa_meia_noite: false,
        },
        dom: {
          ativo: false,
          hora_entrada: '',
          hora_saida: '',
          duracao_min: 0,
          atravessa_meia_noite: false,
        },
      },
      created: '',
      updated: '',
    }

    // Setembro 2026:
    // 2026-09-07 é Segunda-feira
    // 2026-09-08 é Terça-feira
    // 2026-09-12 é Sábado (Folga)
    const espelho = construirEspelhoMensal({
      ano: 2026,
      mes: 9,
      jornadaAtual: jornadaSabado,
      historicoJornadas: [],
      registrosMes: [
        // Segunda 07/09: bateu 10:00 e 18:00 (sem bater almoço) -> auto intervalo 12:30–14:00 (90 min) -> realizado 390 min (6h30)
        {
          id: 'seg1',
          funcionario: 'f1',
          data_utc: '2026-09-07',
          hora_utc: '10:00:00',
          timestamp_utc: '2026-09-07T13:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        {
          id: 'seg2',
          funcionario: 'f1',
          data_utc: '2026-09-07',
          hora_utc: '18:00:00',
          timestamp_utc: '2026-09-07T21:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        // Terça 08/09: bateu 09:00 e 18:00 (sem bater almoço) -> auto intervalo 12:30–14:00 (90 min) -> realizado 450 min (7h30)
        {
          id: 'ter1',
          funcionario: 'f1',
          data_utc: '2026-09-08',
          hora_utc: '09:00:00',
          timestamp_utc: '2026-09-08T12:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        {
          id: 'ter2',
          funcionario: 'f1',
          data_utc: '2026-09-08',
          hora_utc: '18:00:00',
          timestamp_utc: '2026-09-08T21:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
      ],
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
    })

    const diaSeg = espelho.dias.find((d) => d.data === '2026-09-07')
    const diaTer = espelho.dias.find((d) => d.data === '2026-09-08')
    const diaSab = espelho.dias.find((d) => d.data === '2026-09-12')

    const passouSeg =
      Boolean(diaSeg) &&
      diaSeg?.previstoMinutos === 390 && // 6h30
      diaSeg?.realizadoMinutos === 390 &&
      diaSeg?.diferencaMinutos === 0 &&
      diaSeg?.intervaloAutomaticoAplicado === true

    const passouTer =
      Boolean(diaTer) &&
      diaTer?.previstoMinutos === 450 && // 7h30
      diaTer?.realizadoMinutos === 450 &&
      diaTer?.diferencaMinutos === 0 &&
      diaTer?.intervaloAutomaticoAplicado === true

    const passouSab =
      Boolean(diaSab) && diaSab?.previstoMinutos === 0 && diaSab?.ehDiaFolga === true

    const passouJornadaFlexivel = Boolean(passouSeg && passouTer && passouSab)

    resultados.push({
      nome: 'Teste (g): Jornada flexível "SÁBADO" calcula Segunda (6h30), Ter–Sex (7h30) e Folga Sáb/Dom corretamente',
      passou: passouJornadaFlexivel,
      detalhe: `Seg Prev: ${diaSeg?.previstoMinutos}m / Real: ${diaSeg?.realizadoMinutos}m; Ter Prev: ${diaTer?.previstoMinutos}m / Real: ${diaTer?.realizadoMinutos}m; Sáb Folga: ${diaSab?.ehDiaFolga}`,
    })
  }

  // TESTE 7B: Validar as duas jornadas reais do usuário (Segunda a Sexta 44h e SABADO)
  {
    // 1. Jornada "Segunda a Sexta" (44h): Seg-Qui 08:00-18:00 (almoço 12:00-13:00 = 9h liq = 540 min), Sex 08:00-17:00 (almoço 12:00-13:00 = 8h liq = 480 min)
    const jornadaSegSexReal: Jornada = {
      id: 'j-seg-sex-real',
      nome: 'Segunda a Sexta',
      hora_entrada: '08:00',
      hora_inicio_intervalo: '12:00',
      hora_retorno_intervalo: '13:00',
      hora_saida: '18:00',
      duracao_jornada_min: 528,
      dias_trabalho: ['seg', 'ter', 'qua', 'qui', 'sex'],
      dias_folga: ['sab', 'dom'],
      grade_semanal: {
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
      },
      created: '',
      updated: '',
    }

    const espelhoSegSex = construirEspelhoMensal({
      ano: 2026,
      mes: 9,
      jornadaAtual: jornadaSegSexReal,
      historicoJornadas: [],
      registrosMes: [],
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
    })

    // 2026-09-07 (Seg): 540 min (9h), horário 08:00 - 18:00
    // 2026-09-10 (Qui): 540 min (9h), horário 08:00 - 18:00
    // 2026-09-11 (Sex): 480 min (8h), horário 08:00 - 17:00
    // 2026-09-12 (Sáb): Folga
    const diaSegReal = espelhoSegSex.dias.find((d) => d.data === '2026-09-07')
    const diaQuiReal = espelhoSegSex.dias.find((d) => d.data === '2026-09-10')
    const diaSexReal = espelhoSegSex.dias.find((d) => d.data === '2026-09-11')
    const diaSabReal = espelhoSegSex.dias.find((d) => d.data === '2026-09-12')

    const passouSegSexReal =
      diaSegReal?.previstoMinutos === 540 &&
      diaSegReal?.previstoFormatado === '08:00 - 18:00' &&
      diaQuiReal?.previstoMinutos === 540 &&
      diaQuiReal?.previstoFormatado === '08:00 - 18:00' &&
      diaSexReal?.previstoMinutos === 480 &&
      diaSexReal?.previstoFormatado === '08:00 - 17:00' &&
      diaSabReal?.ehDiaFolga === true &&
      diaSabReal?.previstoMinutos === 0 &&
      diaSabReal?.previstoFormatado === 'Folga'

    // 2. Jornada "SABADO": Seg 10:00-18:00 (1h30 almoço = 6h30 = 390 min), Ter-Sab 09:00-18:00 (1h30 almoço = 7h30 = 450 min), Dom Folga
    const jornadaSabadoReal: Jornada = {
      id: 'j-sabado-empresa-real',
      nome: 'SABADO',
      hora_entrada: '10:00',
      hora_inicio_intervalo: '13:00',
      hora_retorno_intervalo: '14:30',
      hora_saida: '18:00',
      duracao_jornada_min: 440,
      dias_trabalho: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'],
      dias_folga: ['dom'],
      grade_semanal: {
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
      },
      created: '',
      updated: '',
    }

    const espelhoSabadoReal = construirEspelhoMensal({
      ano: 2026,
      mes: 9,
      jornadaAtual: jornadaSabadoReal,
      historicoJornadas: [],
      registrosMes: [],
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
    })

    const diaSegSabado = espelhoSabadoReal.dias.find((d) => d.data === '2026-09-07')
    const diaTerSabado = espelhoSabadoReal.dias.find((d) => d.data === '2026-09-08')
    const diaSabSabado = espelhoSabadoReal.dias.find((d) => d.data === '2026-09-12')
    const diaDomSabado = espelhoSabadoReal.dias.find((d) => d.data === '2026-09-13')

    const passouSabadoReal =
      diaSegSabado?.previstoMinutos === 390 && // 6h30
      diaTerSabado?.previstoMinutos === 450 && // 7h30
      diaSabSabado?.previstoMinutos === 450 && // 7h30 no sábado trabalhado
      diaSabSabado?.ehDiaFolga === false &&
      diaDomSabado?.ehDiaFolga === true &&
      diaDomSabado?.previstoMinutos === 0

    resultados.push({
      nome: 'Teste (g2): Jornadas reais da empresa MH MIXX ("Segunda a Sexta" 44h e "SABADO")',
      passou: Boolean(passouSegSexReal && passouSabadoReal),
      detalhe: `SegSex (Qui ${diaQuiReal?.previstoFormatado} / ${diaQuiReal?.previstoMinutos}m, Sex ${diaSexReal?.previstoFormatado} / ${diaSexReal?.previstoMinutos}m, Sáb ${diaSabReal?.previstoFormatado}); SABADO (Seg ${diaSegSabado?.previstoMinutos}m, Ter ${diaTerSabado?.previstoMinutos}m, Sáb ${diaSabSabado?.previstoMinutos}m, Dom Folga)`,
    })
  }

  // TESTE 8: Tolerância de 10 minutos na entrada (Regra 3)
  // Jornada padrão entra 08:00
  // Caso A: Entrou 08:08 (atraso de 8 min <= 10 min de tolerância) -> NÃO gera ocorrência de atraso
  // Caso B: Entrou 08:15 (atraso de 15 min > 10 min de tolerância) -> GERA ocorrência de atraso de 15 min
  {
    const espelho = construirEspelhoMensal({
      ano: 2026,
      mes: 9,
      jornadaAtual: jornadaPadrao,
      historicoJornadas: [],
      registrosMes: [
        // Dia 15 (terça): entrou 08:08 e saiu 17:00 (atraso 8 min, dentro da tolerância de 10 min)
        {
          id: 'tol1',
          funcionario: 'f1',
          data_utc: '2026-09-15',
          hora_utc: '08:08:00',
          timestamp_utc: '2026-09-15T11:08:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        {
          id: 'tol2',
          funcionario: 'f1',
          data_utc: '2026-09-15',
          hora_utc: '17:00:00',
          timestamp_utc: '2026-09-15T20:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        // Dia 16 (quarta): entrou 08:15 e saiu 17:00 (atraso 15 min, excede tolerância de 10 min)
        {
          id: 'atr1',
          funcionario: 'f1',
          data_utc: '2026-09-16',
          hora_utc: '08:15:00',
          timestamp_utc: '2026-09-16T11:15:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        {
          id: 'atr2',
          funcionario: 'f1',
          data_utc: '2026-09-16',
          hora_utc: '17:00:00',
          timestamp_utc: '2026-09-16T20:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
      ],
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
    })

    const dia15 = espelho.dias.find((d) => d.data === '2026-09-15')
    const dia16 = espelho.dias.find((d) => d.data === '2026-09-16')

    const temAtrasoDia15 = dia15?.ocorrencias.some((o) => o.tipo === 'atraso')
    const toleradoDia15 = dia15?.entradaTolerada === true
    const temAtrasoDia16 = dia16?.ocorrencias.some((o) => o.tipo === 'atraso')
    const atrasoMinDia16 = dia16?.atrasoMinutos === 15

    const passouTolerancia =
      !temAtrasoDia15 && toleradoDia15 && Boolean(temAtrasoDia16) && atrasoMinDia16

    resultados.push({
      nome: 'Teste (h): Tolerância de 10 min na entrada (08:08 sem atraso vs 08:15 com ocorrência de atraso)',
      passou: passouTolerancia,
      detalhe: `Dia 15 tolerado: ${toleradoDia15} (temAtraso: ${temAtrasoDia15}); Dia 16 atraso detectado: ${temAtrasoDia16} (${dia16?.atrasoMinutos}m)`,
    })
  }

  // TESTE 9: Banco de horas para batidas após a saída prevista (Regra 2)
  // Jornada padrão sai às 17:00 (ou às 18:00 na jornada "SÁBADO")
  // Colaborador trabalhou até as 19:30 -> 1h30 (90 min) de trabalho pós-saída prevista deve virar crédito de Banco de Horas
  {
    const espelho = construirEspelhoMensal({
      ano: 2026,
      mes: 9,
      jornadaAtual: jornadaPadrao, // saída prevista 17:00
      historicoJornadas: [],
      registrosMes: [
        // Dia 21 (segunda): entrou 08:00, saiu 19:30 (saída prevista 17:00 -> +150 min pós saída)
        {
          id: 'bh1',
          funcionario: 'f1',
          data_utc: '2026-09-21',
          hora_utc: '08:00:00',
          timestamp_utc: '2026-09-21T11:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        {
          id: 'bh2',
          funcionario: 'f1',
          data_utc: '2026-09-21',
          hora_utc: '19:30:00',
          timestamp_utc: '2026-09-21T22:30:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
      ],
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
    })

    const dia21 = espelho.dias.find((d) => d.data === '2026-09-21')
    // 17:00 (1020m) às 19:30 (1170m) = 150m pós-saída
    const passouBancoHoras =
      Boolean(dia21) &&
      dia21?.horasBancoCreditoMinutos === 150 &&
      dia21?.horasBancoCreditoFormatado === '+02:30' &&
      espelho.resumo.totalBancoCreditoMinutos >= 150

    resultados.push({
      nome: 'Teste (i): Horas após a saída prevista são contabilizadas como crédito no Banco de Horas (+150m)',
      passou: passouBancoHoras,
      detalhe: `Crédito apurado: ${dia21?.horasBancoCreditoMinutos}m (${dia21?.horasBancoCreditoFormatado}), Resumo total: ${espelho.resumo.totalBancoCreditoMinutos}m`,
    })
  }

  // TESTE 10: Deduplicação e normalização de marcações repetidas/anuladas no dia de folga (Problema 1)
  // Caso similar ao dia 26/09: sábado de folga com 3 batidas "10:40" (duplicatas), uma 10:51 e uma 22:11
  // As duas batidas 10:40 excedentes são anuladas (ou por tratamento_ponto ou dinamicamente <90s)
  // Resta 10:40 (válida) e 22:11 (válida) -> batida ímpar (3 batidas válidas: 10:40, 10:51, 22:11 se 10:51 não for anulada;
  // se o admin anular 10:51 ou se for anulação de marcação errada, restam apenas as válidas sem +00:11 indevido).
  {
    const regsSabado26: RegistroHorario[] = [
      {
        id: 'r_1040_1',
        funcionario: 'f1',
        data_utc: '2026-09-26',
        hora_utc: '13:40:06',
        timestamp_utc: '2026-09-26T13:40:06.800Z', // 10:40:06 SP
        origem: 'terminal',
        created: '2026-09-26T13:40:06.800Z',
        updated: '',
      },
      {
        id: 'r_1040_2',
        funcionario: 'f1',
        data_utc: '2026-09-26',
        hora_utc: '13:40:39',
        timestamp_utc: '2026-09-26T13:40:39.062Z', // 10:40:39 SP (32s depois -> duplicata)
        origem: 'terminal',
        created: '2026-09-26T13:40:39.062Z',
        updated: '',
      },
      {
        id: 'r_1040_3',
        funcionario: 'f1',
        data_utc: '2026-09-26',
        hora_utc: '13:40:58',
        timestamp_utc: '2026-09-26T13:40:58.021Z', // 10:40:58 SP (51s depois -> duplicata)
        origem: 'terminal',
        created: '2026-09-26T13:40:58.021Z',
        updated: '',
      },
      {
        id: 'r_1051',
        funcionario: 'f1',
        data_utc: '2026-09-26',
        hora_utc: '13:51:42',
        timestamp_utc: '2026-09-26T13:51:42.859Z', // 10:51:42 SP
        origem: 'terminal',
        created: '2026-09-26T13:51:42.859Z',
        updated: '',
      },
      {
        id: 'r_2211',
        funcionario: 'f1',
        data_utc: '2026-09-27',
        hora_utc: '01:11:56',
        timestamp_utc: '2026-09-27T01:11:56.745Z', // 22:11:56 SP do dia 26/09
        origem: 'terminal',
        created: '2026-09-27T01:11:56.745Z',
        updated: '',
      },
    ]

    // Tratamentos de anulação para as 2 batidas excedentes
    const tratamentosAnulacao: TratamentoPonto[] = [
      {
        id: 't_anula_2',
        funcionario: 'f1',
        registro: 'r_1040_2',
        tipo: 'anulacao',
        justificativa: 'Normalização retroativa',
        data_tratamento: '2026-09-27T00:00:00Z',
        data_registro: '2026-09-26',
        hora_registro: '13:40',
        origem_ajuste: 'anulacao_marcacao_duplicada',
        created: '',
        updated: '',
      },
      {
        id: 't_anula_3',
        funcionario: 'f1',
        registro: 'r_1040_3',
        tipo: 'anulacao',
        justificativa: 'Normalização retroativa',
        data_tratamento: '2026-09-27T00:00:00Z',
        data_registro: '2026-09-26',
        hora_registro: '13:40',
        origem_ajuste: 'anulacao_marcacao_duplicada',
        created: '',
        updated: '',
      },
    ]

    const espelho = construirEspelhoMensal({
      ano: 2026,
      mes: 9,
      jornadaAtual: jornadaPadrao, // sábado é folga
      historicoJornadas: [],
      registrosMes: regsSabado26,
      tratamentosMes: tratamentosAnulacao,
      ausenciasMes: [],
      feriasMes: [],
    })

    const dia26 = espelho.dias.find((d) => d.data === '2026-09-26')
    const marcacoesValidas = dia26?.todasMarcacoes.filter((m) => !m.anulado) || []
    const marcacoesAnuladas = dia26?.todasMarcacoes.filter((m) => m.anulado) || []

    // Deve ter exatamente 2 anuladas (as duas duplicatas de 10:40) e 3 válidas (10:40, 10:51, 22:11)
    const passouAnulacao =
      Boolean(dia26) &&
      marcacoesAnuladas.length === 2 &&
      marcacoesValidas.length === 3 &&
      marcacoesValidas[0].horario === '10:40' &&
      marcacoesValidas[1].horario === '10:51' &&
      marcacoesValidas[2].horario === '22:11'

    resultados.push({
      nome: 'Teste (j): Normalização retroativa de batidas duplicadas desconsidera anuladas nos cálculos do espelho',
      passou: passouAnulacao,
      detalhe: `Válidas: ${marcacoesValidas.length} (horários: ${marcacoesValidas.map((m) => m.horario).join(', ')}), Anuladas: ${marcacoesAnuladas.length}`,
    })
  }

  // TESTE 11: Correção de horário de batida do terminal (exemplo da Rosineida que chegou 07:45 mas bateu 08:30 por problema no computador)
  // Original do terminal: 08:30 (entrada com atraso aparente) e 17:00 (saída)
  // Jornada padrão: 08:00 às 17:00 com almoço 12:00 às 13:00 (8h líquidas)
  // Com a correção: batida de 08:30 anulada via tratamento + nova batida de 07:45 incluída via tratamento vinculado
  // Resultado líquido: entrada 07:45, almoço auto 12:00–13:00, saída 17:00 -> 8h15 trabalhadas (495 min), sem atraso!
  {
    const regTerminalEntrada: RegistroHorario = {
      id: 'reg_rosi_ent',
      funcionario: 'func_rosi',
      data_utc: '2026-09-08',
      hora_utc: '08:30:00',
      timestamp_utc: '2026-09-08T11:30:00.000Z', // 08:30 SP
      origem: 'terminal',
      created: '',
      updated: '',
    }
    const regTerminalSaida: RegistroHorario = {
      id: 'reg_rosi_sai',
      funcionario: 'func_rosi',
      data_utc: '2026-09-08',
      hora_utc: '17:00:00',
      timestamp_utc: '2026-09-08T20:00:00.000Z', // 17:00 SP
      origem: 'terminal',
      created: '',
      updated: '',
    }

    // Tratamentos complementares vinculados da correção:
    // 1. Anulação do original de 08:30
    // 2. Inclusão da batida corrigida às 07:45 vinculada ao registro
    const tratamentosCorrecao: TratamentoPonto[] = [
      {
        id: 'trat_anula_0830',
        funcionario: 'func_rosi',
        registro: 'reg_rosi_ent',
        tipo: 'anulacao',
        origem_ajuste: 'anulacao_por_correcao',
        data_registro: '2026-09-08',
        hora_registro: '08:30',
        justificativa: 'Problemas no computador na chegada às 07:45',
        informacao_corrigida: 'Marcação original anulada por motivo de correção para 07:45',
        data_tratamento: '2026-09-08T12:00:00Z',
        created: '',
        updated: '',
      },
      {
        id: 'trat_corrige_0745',
        funcionario: 'func_rosi',
        registro: 'reg_rosi_ent',
        tipo: 'correcao',
        tipo_marcacao: 'entrada',
        origem_ajuste: 'correcao_horario_batida',
        data_registro: '2026-09-08',
        hora_registro: '07:45',
        justificativa: 'Problemas no computador na chegada às 07:45',
        informacao_corrigida: 'Horário corrigido de 08:30 para 07:45 (entrada)',
        data_tratamento: '2026-09-08T12:00:00Z',
        created: '',
        updated: '',
      },
    ]

    const espelho = construirEspelhoMensal({
      ano: 2026,
      mes: 9,
      jornadaAtual: jornadaPadrao, // 08:00 às 17:00 (almoço 12:00-13:00)
      historicoJornadas: [],
      registrosMes: [regTerminalEntrada, regTerminalSaida],
      tratamentosMes: tratamentosCorrecao,
      ausenciasMes: [],
      feriasMes: [],
    })

    const dia8 = espelho.dias.find((d) => d.data === '2026-09-08')
    const batidaAnulada = dia8?.todasMarcacoes.find((m) => m.id === 'reg_rosi_ent' && m.anulado)
    const batidaCorrigida = dia8?.todasMarcacoes.find(
      (m) => m.id === 'trat_corrige_0745' && !m.anulado,
    )

    // Intervalo auto: 12:00 a 13:00 (60 min)
    // Manhã: 07:45 às 12:00 = 255 min
    // Tarde: 13:00 às 17:00 = 240 min
    // Total trabalhado esperado = 495 min (8h15)
    // Previsto = 480 min (8h00)
    // Diferença = +15 min
    // Atraso = 0 min
    const passouFluxoCorrecao =
      Boolean(dia8) &&
      Boolean(batidaAnulada) &&
      batidaAnulada?.horario === '08:30' &&
      Boolean(batidaCorrigida) &&
      batidaCorrigida?.horario === '07:45' &&
      batidaCorrigida?.corrigida === true &&
      batidaCorrigida?.horarioOriginal === '08:30' &&
      dia8?.realizadoMinutos === 495 &&
      dia8?.diferencaMinutos === 15 &&
      dia8?.atrasoMinutos === 0

    resultados.push({
      nome: 'Teste (k): Correção de horário de batida do terminal anula original, inclui corrigido e calcula com o novo horário',
      passou: passouFluxoCorrecao,
      detalhe: `Trabalhado: ${dia8?.realizadoMinutos}m (esperado 495m), Dif: ${dia8?.diferencaMinutos}m, Atraso: ${dia8?.atrasoMinutos}m, Corrigida: ${batidaCorrigida?.corrigida}, Horário Orig: ${batidaCorrigida?.horarioOriginal}`,
    })
  }

  // TESTE 8: Feriado sem nenhuma batida executada (ex: 12/10 Nossa Senhora Aparecida)
  // Requisito: Não gera falta, previsto vira "Feriado — <nome>", minutos previstos = 0, sem ocorrência de falta/alerta
  {
    const feriadoAparecida = {
      id: 'fer-1210',
      data: '2026-10-12',
      nome: 'Nossa Senhora Aparecida',
      tipo: 'nacional' as const,
      recorrente: true,
      ativo: true,
      created: '',
      updated: '',
    }

    const espelho = construirEspelhoMensal({
      ano: 2026,
      mes: 10,
      jornadaAtual: jornadaPadrao,
      historicoJornadas: [],
      registrosMes: [], // Ninguém bateu ponto no mês/dia
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
      feriados: [feriadoAparecida],
    })

    const dia12 = espelho.dias.find((d) => d.data === '2026-10-12')
    const passouFeriadoSemBatida =
      Boolean(dia12) &&
      dia12?.ehFeriado === true &&
      dia12?.previstoMinutos === 0 &&
      dia12?.previstoFormatado === 'Feriado — Nossa Senhora Aparecida' &&
      dia12?.realizadoMinutos === 0 &&
      dia12?.diferencaMinutos === 0 &&
      dia12?.horasBancoDebitoMinutos === 0 &&
      dia12?.ocorrencias.length === 0

    resultados.push({
      nome: 'Teste (l): Feriado sem batida não gera falta, zera previsto e exibe "Feriado — <nome>"',
      passou: passouFeriadoSemBatida,
      detalhe: `ehFeriado: ${dia12?.ehFeriado}, previsto: ${dia12?.previstoFormatado}, diferenca: ${dia12?.diferencaMinutos}m, debitoBH: ${dia12?.horasBancoDebitoMinutos}m, ocorrencias: ${dia12?.ocorrencias.length}`,
    })
  }

  // TESTE 9: Feriado com batida de ponto executada (trabalho em dia de feriado)
  // Requisito: Todas as horas trabalhadas do dia são creditadas integralmente como Banco de Horas
  {
    const feriadoTrabalho = {
      id: 'fer-0105',
      data: '2026-05-01',
      nome: 'Dia do Trabalho',
      tipo: 'nacional' as const,
      recorrente: true,
      ativo: true,
      created: '',
      updated: '',
    }

    const regsFeriado: RegistroHorario[] = [
      {
        id: 'rf1',
        funcionario: 'f1',
        data_utc: '2026-05-01',
        hora_utc: '08:00:00',
        timestamp_utc: '2026-05-01T11:00:00.000Z',
        origem: 'terminal',
        created: '',
        updated: '',
      },
      {
        id: 'rf2',
        funcionario: 'f1',
        data_utc: '2026-05-01',
        hora_utc: '14:00:00',
        timestamp_utc: '2026-05-01T17:00:00.000Z',
        origem: 'terminal',
        created: '',
        updated: '',
      },
    ]

    const espelho = construirEspelhoMensal({
      ano: 2026,
      mes: 5,
      jornadaAtual: jornadaPadrao,
      historicoJornadas: [],
      registrosMes: regsFeriado, // Bateu 08:00 às 14:00 (6h = 360 min)
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
      feriados: [feriadoTrabalho],
    })

    const dia1 = espelho.dias.find((d) => d.data === '2026-05-01')
    const passouFeriadoComBatida =
      Boolean(dia1) &&
      dia1?.ehFeriado === true &&
      dia1?.realizadoMinutos === 360 &&
      dia1?.horasBancoCreditoMinutos === 360 && // Crédito integral em banco de horas
      dia1?.diferencaMinutos === 360 &&
      dia1?.ocorrencias.some((o) => o.tipo === 'folga_trabalhada')

    resultados.push({
      nome: 'Teste (m): Feriado trabalhado credita 100% das horas no Banco de Horas',
      passou: Boolean(passouFeriadoComBatida),
      detalhe: `ehFeriado: ${dia1?.ehFeriado}, realizado: ${dia1?.realizadoMinutos}m, creditoBH: ${dia1?.horasBancoCreditoMinutos}m`,
    })
  }

  // TESTE 10: Feriado recorrente aplicado em múltiplos anos (ex: 2026 e 2027)
  // Requisito: Um feriado cadastrado como recorrente em 2026-10-12 é reconhecido no espelho de 2027
  {
    const feriadoRecorrente = {
      id: 'fer-recorrente-1',
      data: '2026-10-12',
      nome: 'Nossa Senhora Aparecida',
      tipo: 'nacional' as const,
      recorrente: true,
      ativo: true,
      created: '',
      updated: '',
    }

    const espelho2027 = construirEspelhoMensal({
      ano: 2027,
      mes: 10,
      jornadaAtual: jornadaPadrao,
      historicoJornadas: [],
      registrosMes: [],
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
      feriados: [feriadoRecorrente],
    })

    const dia12Out2027 = espelho2027.dias.find((d) => d.data === '2027-10-12')
    const passouRecorrenciaMultiplosAnos =
      Boolean(dia12Out2027) &&
      dia12Out2027?.ehFeriado === true &&
      dia12Out2027?.previstoMinutos === 0 &&
      dia12Out2027?.previstoFormatado === 'Feriado — Nossa Senhora Aparecida'

    resultados.push({
      nome: 'Teste (n): Feriado recorrente se propaga corretamente para outros anos (ex: 2027)',
      passou: Boolean(passouRecorrenciaMultiplosAnos),
      detalhe: `2027-10-12 ehFeriado: ${dia12Out2027?.ehFeriado}, previsto: ${dia12Out2027?.previstoFormatado}`,
    })
  }

  const todosPassaram = resultados.every((r) => r.passou)
  return { todosPassaram, resultados }
}
