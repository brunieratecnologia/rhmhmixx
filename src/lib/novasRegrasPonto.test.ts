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
})
