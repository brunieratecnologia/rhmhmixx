import { describe, it, expect } from 'vitest'
import { executarTestesIntervaloAutomatico } from './calculoHoras.test'
import {
  timeStringToMinutes,
  minutesToTimeString,
  minutesToSignedString,
  calcularHorasRealizadas,
  construirEspelhoMensal,
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

  it('deve exibir horário previsto "08:00 - 18:00" em dia de quinta da jornada Segunda a Sexta e "Folga" em dia de folga', () => {
    const jornadaSegSex: Jornada = {
      id: 'j-seg-sex',
      nome: 'Segunda a Sexta',
      hora_entrada: '08:00',
      hora_inicio_intervalo: '12:00',
      hora_retorno_intervalo: '13:00',
      hora_saida: '18:00',
      duracao_jornada_min: 528,
      dias_trabalho: ['seg', 'ter', 'qua', 'qui', 'sex'],
      dias_folga: ['sab', 'dom'],
      grade_semanal: {
        seg: { ativo: true, hora_entrada: '08:00', hora_saida: '18:00', duracao_min: 540 },
        ter: { ativo: true, hora_entrada: '08:00', hora_saida: '18:00', duracao_min: 540 },
        qua: { ativo: true, hora_entrada: '08:00', hora_saida: '18:00', duracao_min: 540 },
        qui: { ativo: true, hora_entrada: '08:00', hora_saida: '18:00', duracao_min: 540 },
        sex: { ativo: true, hora_entrada: '08:00', hora_saida: '17:00', duracao_min: 480 },
        sab: { ativo: false, hora_entrada: '', hora_saida: '', duracao_min: 0 },
        dom: { ativo: false, hora_entrada: '', hora_saida: '', duracao_min: 0 },
      },
      created: '',
      updated: '',
    }

    const espelho = construirEspelhoMensal({
      ano: 2026,
      mes: 10,
      jornadaAtual: jornadaSegSex,
      historicoJornadas: [],
      registrosMes: [],
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
    })

    // 01/10/2026 é Quinta-feira
    const dia01Qui = espelho.dias.find((d: any) => d.data === '2026-10-01')
    expect(dia01Qui).toBeDefined()
    expect(dia01Qui?.diaSemana).toBe('qui')
    expect(dia01Qui?.previstoFormatado).toBe('08:00 - 18:00')
    expect(dia01Qui?.horarioPrevistoFormatado).toBe('08:00 - 18:00')
    expect(dia01Qui?.cargaPrevistaFormatada).toBe('carga 9h')
    expect(dia01Qui?.previstoMinutos).toBe(540)
    expect(dia01Qui?.ehDiaFolga).toBe(false)

    // 02/10/2026 é Sexta-feira (saída 17:00, carga 8h)
    const dia02Sex = espelho.dias.find((d: any) => d.data === '2026-10-02')
    expect(dia02Sex?.previstoFormatado).toBe('08:00 - 17:00')
    expect(dia02Sex?.cargaPrevistaFormatada).toBe('carga 8h')
    expect(dia02Sex?.previstoMinutos).toBe(480)

    // 03/10/2026 é Sábado (Folga)
    const dia03Sab = espelho.dias.find((d: any) => d.data === '2026-10-03')
    expect(dia03Sab?.previstoFormatado).toBe('Folga')
    expect(dia03Sab?.ehDiaFolga).toBe(true)
    expect(dia03Sab?.previstoMinutos).toBe(0)

    // 04/10/2026 é Domingo (Folga)
    const dia04Dom = espelho.dias.find((d: any) => d.data === '2026-10-04')
    expect(dia04Dom?.previstoFormatado).toBe('Folga')
    expect(dia04Dom?.ehDiaFolga).toBe(true)
    expect(dia04Dom?.previstoMinutos).toBe(0)
  })
})
