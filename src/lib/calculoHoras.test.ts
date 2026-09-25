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

  const todosPassaram = resultados.every((r) => r.passou)
  return { todosPassaram, resultados }
}
