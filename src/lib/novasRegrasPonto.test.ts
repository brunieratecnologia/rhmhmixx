import { describe, it, expect } from 'vitest'
import {
  calcularPrevistoJornada,
  calcularHorasRealizadas,
  construirEspelhoMensal,
  timeStringToMinutes,
  minutesToTimeString,
} from './calculoHoras'
import type { Jornada, RegistroHorario, TratamentoPonto } from '@/types/rh'

describe('Novas Regras de Ponto (Deduplicação, Tolerância 10m e Banco de Horas pós-saída)', () => {
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

  it('1. Tolerância de até 10 minutos na entrada não gera ocorrência de atraso nem débito', () => {
    // Entrada às 08:08 (8 minutos após o previsto de 08:00 -> tolerado)
    const espelho = construirEspelhoMensal({
      ano: 2026,
      mes: 9,
      jornadaAtual: jornadaPadrao,
      historicoJornadas: [],
      registrosMes: [
        {
          id: 'r1',
          funcionario: 'func-teste',
          data_utc: '2026-09-01',
          hora_utc: '08:08:00',
          timestamp_utc: '2026-09-01T11:08:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        {
          id: 'r2',
          funcionario: 'func-teste',
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
    expect(dia1).toBeDefined()
    expect(dia1?.entradaTolerada).toBe(true)
    expect(dia1?.atrasoMinutos).toBe(0)
    expect(dia1?.ocorrencias.some((o) => o.tipo === 'atraso')).toBe(false)
  })

  it('2. Atraso superior a 10 minutos na entrada gera ocorrência e débito de banco de horas', () => {
    // Entrada às 08:18 (18 minutos após o previsto de 08:00 -> excede 10m de tolerância)
    const espelho = construirEspelhoMensal({
      ano: 2026,
      mes: 9,
      jornadaAtual: jornadaPadrao,
      historicoJornadas: [],
      registrosMes: [
        {
          id: 'r1',
          funcionario: 'func-teste',
          data_utc: '2026-09-02',
          hora_utc: '08:18:00',
          timestamp_utc: '2026-09-02T11:18:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        {
          id: 'r2',
          funcionario: 'func-teste',
          data_utc: '2026-09-02',
          hora_utc: '17:00:00',
          timestamp_utc: '2026-09-02T20:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
      ],
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
    })

    const dia2 = espelho.dias.find((d) => d.data === '2026-09-02')
    expect(dia2).toBeDefined()
    expect(dia2?.entradaTolerada).toBe(false)
    expect(dia2?.atrasoMinutos).toBe(18)
    expect(dia2?.ocorrencias.some((o) => o.tipo === 'atraso')).toBe(true)
    expect(dia2?.horasBancoDebitoMinutos).toBe(18)
  })

  it('3. Trabalho após a saída prevista alimenta o crédito no Banco de Horas', () => {
    // Saída prevista 17:00. Colaborador saiu às 19:15 -> +135 min além da saída
    const espelho = construirEspelhoMensal({
      ano: 2026,
      mes: 9,
      jornadaAtual: jornadaPadrao,
      historicoJornadas: [],
      registrosMes: [
        {
          id: 'r1',
          funcionario: 'func-teste',
          data_utc: '2026-09-03',
          hora_utc: '08:00:00',
          timestamp_utc: '2026-09-03T11:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        {
          id: 'r2',
          funcionario: 'func-teste',
          data_utc: '2026-09-03',
          hora_utc: '19:15:00',
          timestamp_utc: '2026-09-03T22:15:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
      ],
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
    })

    const dia3 = espelho.dias.find((d) => d.data === '2026-09-03')
    expect(dia3).toBeDefined()
    // 17:00 (1020m) até 19:15 (1155m) = 135 minutos
    expect(dia3?.horasBancoCreditoMinutos).toBe(135)
    expect(dia3?.horasBancoCreditoFormatado).toBe('+02:15')
    expect(espelho.resumo.totalBancoCreditoMinutos).toBeGreaterThanOrEqual(135)
  })

  it('4. Trabalho em dia de folga é integralmente computado como crédito de Banco de Horas', () => {
    // 2026-09-06 é Domingo (dia de folga na jornada padrão)
    const espelho = construirEspelhoMensal({
      ano: 2026,
      mes: 9,
      jornadaAtual: jornadaPadrao,
      historicoJornadas: [],
      registrosMes: [
        {
          id: 'r1',
          funcionario: 'func-teste',
          data_utc: '2026-09-06',
          hora_utc: '09:00:00',
          timestamp_utc: '2026-09-06T12:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        {
          id: 'r2',
          funcionario: 'func-teste',
          data_utc: '2026-09-06',
          hora_utc: '13:00:00',
          timestamp_utc: '2026-09-06T16:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
      ],
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
    })

    const dia6 = espelho.dias.find((d) => d.data === '2026-09-06')
    expect(dia6).toBeDefined()
    expect(dia6?.ehDiaFolga).toBe(true)
    expect(dia6?.realizadoMinutos).toBe(240) // 4h
    expect(dia6?.horasBancoCreditoMinutos).toBe(240)
    expect(dia6?.ocorrencias.some((o) => o.tipo === 'folga_trabalhada')).toBe(true)
  })

  it('5. Almoço automático de 1h não sofre duplo desconto quando há batidas reais', () => {
    const batidas4: RegistroHorario[] = [
      {
        id: 'b1',
        funcionario: 'f1',
        data_utc: '2026-09-10',
        hora_utc: '08:00:00',
        timestamp_utc: '2026-09-10T11:00:00.000Z',
        origem: 'terminal',
        created: '',
        updated: '',
      },
      {
        id: 'b2',
        funcionario: 'f1',
        data_utc: '2026-09-10',
        hora_utc: '12:00:00',
        timestamp_utc: '2026-09-10T15:00:00.000Z',
        origem: 'terminal',
        created: '',
        updated: '',
      },
      {
        id: 'b3',
        funcionario: 'f1',
        data_utc: '2026-09-10',
        hora_utc: '13:00:00',
        timestamp_utc: '2026-09-10T16:00:00.000Z',
        origem: 'terminal',
        created: '',
        updated: '',
      },
      {
        id: 'b4',
        funcionario: 'f1',
        data_utc: '2026-09-10',
        hora_utc: '17:00:00',
        timestamp_utc: '2026-09-10T20:00:00.000Z',
        origem: 'terminal',
        created: '',
        updated: '',
      },
    ]

    const resultado = calcularHorasRealizadas(batidas4, [], jornadaPadrao)
    expect(resultado.minutosTrabalhados).toBe(480)
    expect(resultado.intervaloAutomaticoAplicado).toBe(false)
    expect(resultado.todasMarcacoes.length).toBe(4)
  })

  it('6. Casos exatos da nova regra de Antecedência na Entrada para Banco de Horas', () => {
    // (a) entrada 15 min antes (07:45 vs previsto 08:00) -> SEM crédito
    const espelhoA = construirEspelhoMensal({
      ano: 2026,
      mes: 9,
      jornadaAtual: jornadaPadrao,
      historicoJornadas: [],
      registrosMes: [
        {
          id: 'ra1',
          funcionario: 'f1',
          data_utc: '2026-09-01',
          hora_utc: '07:45:00',
          timestamp_utc: '2026-09-01T10:45:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        {
          id: 'ra2',
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
    const diaA = espelhoA.dias.find((d) => d.data === '2026-09-01')
    expect(diaA?.horasBancoCreditoMinutos).toBe(0)
    expect(diaA?.horasBancoCreditoAntecipacaoMinutos).toBeUndefined()

    // (b) entrada 30 min antes (07:30 vs previsto 08:00) -> CRÉDITO de 30 min
    const espelhoB = construirEspelhoMensal({
      ano: 2026,
      mes: 9,
      jornadaAtual: jornadaPadrao,
      historicoJornadas: [],
      registrosMes: [
        {
          id: 'rb1',
          funcionario: 'f1',
          data_utc: '2026-09-02',
          hora_utc: '07:30:00',
          timestamp_utc: '2026-09-02T10:30:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        {
          id: 'rb2',
          funcionario: 'f1',
          data_utc: '2026-09-02',
          hora_utc: '17:00:00',
          timestamp_utc: '2026-09-02T20:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
      ],
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
    })
    const diaB = espelhoB.dias.find((d) => d.data === '2026-09-02')
    expect(diaB?.horasBancoCreditoMinutos).toBe(30)
    expect(diaB?.horasBancoCreditoAntecipacaoMinutos).toBe(30)
    expect(diaB?.horasBancoCreditoFormatado).toBe('+00:30')
    expect(diaB?.ocorrencias.some((o) => o.descricao.includes('antecipação ≥30min'))).toBe(true)

    // (c) entrada 45 min antes (07:15 vs previsto 08:00) -> CRÉDITO de 45 min
    const espelhoC = construirEspelhoMensal({
      ano: 2026,
      mes: 9,
      jornadaAtual: jornadaPadrao,
      historicoJornadas: [],
      registrosMes: [
        {
          id: 'rc1',
          funcionario: 'f1',
          data_utc: '2026-09-03',
          hora_utc: '07:15:00',
          timestamp_utc: '2026-09-03T10:15:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        {
          id: 'rc2',
          funcionario: 'f1',
          data_utc: '2026-09-03',
          hora_utc: '17:00:00',
          timestamp_utc: '2026-09-03T20:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
      ],
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
    })
    const diaC = espelhoC.dias.find((d) => d.data === '2026-09-03')
    expect(diaC?.horasBancoCreditoMinutos).toBe(45)
    expect(diaC?.horasBancoCreditoAntecipacaoMinutos).toBe(45)
    expect(diaC?.horasBancoCreditoFormatado).toBe('+00:45')

    // (d) saída após previsto -> crédito normal continua
    const espelhoD = construirEspelhoMensal({
      ano: 2026,
      mes: 9,
      jornadaAtual: jornadaPadrao,
      historicoJornadas: [],
      registrosMes: [
        {
          id: 'rd1',
          funcionario: 'f1',
          data_utc: '2026-09-04',
          hora_utc: '08:00:00',
          timestamp_utc: '2026-09-04T11:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        {
          id: 'rd2',
          funcionario: 'f1',
          data_utc: '2026-09-04',
          hora_utc: '18:15:00',
          timestamp_utc: '2026-09-04T21:15:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
      ],
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
    })
    const diaD = espelhoD.dias.find((d) => d.data === '2026-09-04')
    // Previsto saída 17:00, saiu 18:15 -> +75 min pós-saída
    expect(diaD?.horasBancoCreditoPosSaidaMinutos).toBe(75)
    expect(diaD?.horasBancoCreditoMinutos).toBe(75)
    expect(diaD?.horasBancoCreditoFormatado).toBe('+01:15')

    // (e) dia de folga -> integral continua
    const espelhoE = construirEspelhoMensal({
      ano: 2026,
      mes: 9,
      jornadaAtual: jornadaPadrao,
      historicoJornadas: [],
      registrosMes: [
        {
          id: 're1',
          funcionario: 'f1',
          data_utc: '2026-09-06', // Domingo
          hora_utc: '10:00:00',
          timestamp_utc: '2026-09-06T13:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        {
          id: 're2',
          funcionario: 'f1',
          data_utc: '2026-09-06',
          hora_utc: '14:00:00',
          timestamp_utc: '2026-09-06T17:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
      ],
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
    })
    const diaE = espelhoE.dias.find((d) => d.data === '2026-09-06')
    expect(diaE?.ehDiaFolga).toBe(true)
    expect(diaE?.horasBancoCreditoMinutos).toBe(240) // 4h

    // (f) feriado -> integral continua
    const feriadoIndependencia = {
      id: 'fer-0709',
      data: '2026-09-07',
      nome: 'Independência do Brasil',
      tipo: 'nacional' as const,
      recorrente: true,
      ativo: true,
      created: '',
      updated: '',
    }
    const espelhoF = construirEspelhoMensal({
      ano: 2026,
      mes: 9,
      jornadaAtual: jornadaPadrao,
      historicoJornadas: [],
      registrosMes: [
        {
          id: 'rf1',
          funcionario: 'f1',
          data_utc: '2026-09-07',
          hora_utc: '08:00:00',
          timestamp_utc: '2026-09-07T11:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        {
          id: 'rf2',
          funcionario: 'f1',
          data_utc: '2026-09-07',
          hora_utc: '13:00:00',
          timestamp_utc: '2026-09-07T16:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
      ],
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
      feriados: [feriadoIndependencia],
    })
    const diaF = espelhoF.dias.find((d) => d.data === '2026-09-07')
    expect(diaF?.ehFeriado).toBe(true)
    expect(diaF?.horasBancoCreditoMinutos).toBe(300) // 5h

    // (g) tolerância de atraso de 10 min não é afetada
    const espelhoG = construirEspelhoMensal({
      ano: 2026,
      mes: 9,
      jornadaAtual: jornadaPadrao,
      historicoJornadas: [],
      registrosMes: [
        {
          id: 'rg1',
          funcionario: 'f1',
          data_utc: '2026-09-08',
          hora_utc: '08:09:00', // 9 min de atraso -> tolerado
          timestamp_utc: '2026-09-08T11:09:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        {
          id: 'rg2',
          funcionario: 'f1',
          data_utc: '2026-09-08',
          hora_utc: '17:00:00',
          timestamp_utc: '2026-09-08T20:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
      ],
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
    })
    const diaG = espelhoG.dias.find((d) => d.data === '2026-09-08')
    expect(diaG?.entradaTolerada).toBe(true)
    expect(diaG?.atrasoMinutos).toBe(0)
    expect(diaG?.horasBancoDebitoMinutos).toBe(0)
  })
})
