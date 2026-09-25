import { describe, it, expect } from 'vitest'
import { executarTestesIntervaloAutomatico } from './calculoHoras.test'
import {
  timeStringToMinutes,
  minutesToTimeString,
  minutesToSignedString,
  calcularHorasRealizadas,
} from './calculoHoras'
import type { Jornada, RegistroHorario } from '@/types/rh'

describe('Homologação de Cálculo de Horas e Intervalos', () => {
  it('deve passar em todos os testes de intervalo automático de almoço', () => {
    const res = executarTestesIntervaloAutomatico()
    for (const r of res.resultados) {
      expect(r.passou, `${r.nome}: ${r.detalhe}`).toBe(true)
    }
    expect(res.todosPassaram).toBe(true)
  })

  it('deve converter horas e minutos corretamente com sinal', () => {
    expect(timeStringToMinutes('08:30')).toBe(510)
    expect(minutesToTimeString(510)).toBe('08:30')
    expect(minutesToSignedString(60)).toBe('+01:00')
    expect(minutesToSignedString(-90)).toBe('-01:30')
    expect(minutesToSignedString(0)).toBe('00:00')
  })

  it('deve calcular corretamente jornada atravessando meia-noite', () => {
    const jornadaNoturna: Jornada = {
      id: 'jornada-noturna',
      nome: 'Noturno 22h às 06h',
      dias_trabalho: ['seg', 'ter', 'qua', 'qui', 'sex'],
      dias_folga: ['sab', 'dom'],
      hora_entrada: '22:00',
      hora_saida: '06:00',
      duracao_jornada_min: 420, // 7h
      intervalo_minutos: 60,
      atravessa_meia_noite: true,
      tipo_escala: 'semanal_fixa',
    } as unknown as Jornada

    const regEntrada = {
      id: 'r1',
      funcionario: 'f1',
      data_utc: '2025-03-10',
      hora_utc: '01:00:00',
      timestamp_utc: '2025-03-10T01:00:00Z', // 22:00 SP
      origem: 'terminal',
      created: '2025-03-10T01:00:00Z',
      updated: '2025-03-10T01:00:00Z',
    } as unknown as RegistroHorario

    const regSaida = {
      id: 'r2',
      funcionario: 'f1',
      data_utc: '2025-03-10',
      hora_utc: '09:00:00',
      timestamp_utc: '2025-03-10T09:00:00Z', // 06:00 SP (dia seguinte)
      origem: 'terminal',
      created: '2025-03-10T09:00:00Z',
      updated: '2025-03-10T09:00:00Z',
    } as unknown as RegistroHorario

    const resultado = calcularHorasRealizadas([regEntrada, regSaida], [], jornadaNoturna)
    expect(resultado.minutosTrabalhados).toBeGreaterThan(0)
  })
})
