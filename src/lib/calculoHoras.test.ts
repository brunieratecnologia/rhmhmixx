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

  const todosPassaram = resultados.every((r) => r.passou)
  return { todosPassaram, resultados }
}
