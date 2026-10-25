import { describe, it, expect } from 'vitest'
import { calcularHorasRealizadas, construirEspelhoMensal } from './calculoHoras'
import { executarTestesIntervaloAutomatico } from './calculoHoras.test'
import type { Jornada, RegistroHorario, TratamentoPonto } from '@/types/rh'

describe('Fluxo de Correção de Horário de Batida', () => {
  const jornadaCLT: Jornada = {
    id: 'j-clt',
    nome: 'Comercial 44h',
    dias_trabalho: ['seg', 'ter', 'qua', 'qui', 'sex'],
    hora_entrada: '08:00',
    hora_inicio_intervalo: '12:00',
    hora_retorno_intervalo: '13:00',
    hora_saida: '17:00',
    duracao_jornada_min: 480,
    dias_folga: ['sab', 'dom'],
    created: '',
    updated: '',
  }

  it('deve aprovar todos os testes internos da suíte de cálculo e intervalo automático', () => {
    const res = executarTestesIntervaloAutomatico()
    expect(res.todosPassaram).toBe(true)
  })

  it('caso Rosineida: colaboradora chegou 07:45 mas registrou 08:30 no terminal por problema técnico', () => {
    // 1. Batidas originais do terminal: entrada com atraso aparente às 08:30 e saída às 17:00
    const regEntrada: RegistroHorario = {
      id: 'reg_rosi_01',
      funcionario: 'func_rosi',
      data_utc: '2026-09-08',
      hora_utc: '08:30:00',
      timestamp_utc: '2026-09-08T11:30:00.000Z', // 08:30 no fuso de SP
      origem: 'terminal',
      created: '',
      updated: '',
    }
    const regSaida: RegistroHorario = {
      id: 'reg_rosi_02',
      funcionario: 'func_rosi',
      data_utc: '2026-09-08',
      hora_utc: '17:00:00',
      timestamp_utc: '2026-09-08T20:00:00.000Z', // 17:00 no fuso de SP
      origem: 'terminal',
      created: '',
      updated: '',
    }

    // Sem correção prévia, a entrada às 08:30 geraria 30 minutos de atraso (acima da tolerância de 10m)
    const espelhoSemCorrecao = construirEspelhoMensal({
      ano: 2026,
      mes: 9,
      jornadaAtual: jornadaCLT,
      historicoJornadas: [],
      registrosMes: [regEntrada, regSaida],
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
    })
    const diaSemCorrecao = espelhoSemCorrecao.dias.find((d) => d.data === '2026-09-08')
    expect(diaSemCorrecao?.realizadoMinutos).toBe(450) // 7h30 (8h30 às 17h com 1h de almoço)
    expect(diaSemCorrecao?.atrasoMinutos).toBe(30)
    expect(diaSemCorrecao?.ocorrencias.some((o) => o.tipo === 'atraso')).toBe(true)

    // 2. Com a operação atômica de correção (anulação do original + batida corrigida às 07:45):
    const tratamentosCorrecao: TratamentoPonto[] = [
      {
        id: 'trat_anulacao_rosi',
        funcionario: 'func_rosi',
        registro: 'reg_rosi_01',
        tipo: 'anulacao',
        origem_ajuste: 'anulacao_por_correcao',
        data_registro: '2026-09-08',
        hora_registro: '08:30',
        justificativa: 'Problemas no computador na chegada às 07:45',
        informacao_corrigida:
          'Marcação original das 08:30 anulada por motivo de correção para 07:45. Motivo: Problemas no computador',
        data_tratamento: '2026-09-08T12:00:00.000Z',
        created: '',
        updated: '',
      },
      {
        id: 'trat_inclusao_rosi',
        funcionario: 'func_rosi',
        registro: 'reg_rosi_01',
        tipo: 'correcao',
        tipo_marcacao: 'entrada',
        origem_ajuste: 'correcao_horario_batida',
        data_registro: '2026-09-08',
        hora_registro: '07:45',
        justificativa: 'Problemas no computador na chegada às 07:45',
        informacao_corrigida:
          'Horário corrigido de 08:30 para 07:45 (entrada). Motivo: Problemas no computador',
        data_tratamento: '2026-09-08T12:00:00.000Z',
        created: '',
        updated: '',
      },
    ]

    const espelhoComCorrecao = construirEspelhoMensal({
      ano: 2026,
      mes: 9,
      jornadaAtual: jornadaCLT,
      historicoJornadas: [],
      registrosMes: [regEntrada, regSaida],
      tratamentosMes: tratamentosCorrecao,
      ausenciasMes: [],
      feriasMes: [],
    })

    const diaComCorrecao = espelhoComCorrecao.dias.find((d) => d.data === '2026-09-08')
    expect(diaComCorrecao).toBeDefined()

    // O original permanece intacto, mas marcado como anulado (riscado / badge ANULADA)
    const marcacaoOriginalAnulada = diaComCorrecao?.todasMarcacoes.find(
      (m) => m.id === 'reg_rosi_01' && m.anulado,
    )
    expect(marcacaoOriginalAnulada).toBeDefined()
    expect(marcacaoOriginalAnulada?.horario).toBe('08:30')
    expect(marcacaoOriginalAnulada?.motivoAnulacao).toBe(
      'Problemas no computador na chegada às 07:45',
    )

    // A marcação corrigida aparece ativa com metadados de correção
    const marcacaoCorrigida = diaComCorrecao?.todasMarcacoes.find(
      (m) => m.id === 'trat_inclusao_rosi' && !m.anulado,
    )
    expect(marcacaoCorrigida).toBeDefined()
    expect(marcacaoCorrigida?.horario).toBe('07:45')
    expect(marcacaoCorrigida?.corrigida).toBe(true)
    expect(marcacaoCorrigida?.horarioOriginal).toBe('08:30')
    expect(marcacaoCorrigida?.motivoCorrecao).toBe('Problemas no computador na chegada às 07:45')

    // O cálculo de horas utiliza o horário corrigido (07:45 às 17:00 com 1h de almoço = 8h15 = 495 min)
    expect(diaComCorrecao?.realizadoMinutos).toBe(495)
    expect(diaComCorrecao?.diferencaMinutos).toBe(15) // +15m de crédito
    expect(diaComCorrecao?.atrasoMinutos).toBe(0) // Zerou qualquer atraso
    expect(diaComCorrecao?.ocorrencias.some((o) => o.tipo === 'atraso')).toBe(false)
  })

  it('deve calcular corretamente com função calcularHorasRealizadas diretamente', () => {
    const regsOrig: RegistroHorario[] = [
      {
        id: 'r_ent',
        funcionario: 'f1',
        data_utc: '2026-09-08',
        hora_utc: '08:20:00',
        timestamp_utc: '2026-09-08T11:20:00.000Z',
        origem: 'terminal',
        created: '',
        updated: '',
      },
      {
        id: 'r_sai',
        funcionario: 'f1',
        data_utc: '2026-09-08',
        hora_utc: '17:00:00',
        timestamp_utc: '2026-09-08T20:00:00.000Z',
        origem: 'terminal',
        created: '',
        updated: '',
      },
    ]

    const tratamentos: TratamentoPonto[] = [
      {
        id: 't_anula',
        funcionario: 'f1',
        registro: 'r_ent',
        tipo: 'anulacao',
        origem_ajuste: 'anulacao_por_correcao',
        data_registro: '2026-09-08',
        hora_registro: '08:20',
        justificativa: 'Horário ajustado conforme liberação do gestor',
        data_tratamento: '2026-09-08T10:00:00Z',
        created: '',
        updated: '',
      },
      {
        id: 't_corrige',
        funcionario: 'f1',
        registro: 'r_ent',
        tipo: 'correcao',
        tipo_marcacao: 'entrada',
        origem_ajuste: 'correcao_horario_batida',
        data_registro: '2026-09-08',
        hora_registro: '08:00',
        justificativa: 'Horário ajustado conforme liberação do gestor',
        data_tratamento: '2026-09-08T10:00:00Z',
        created: '',
        updated: '',
      },
    ]

    const resultado = calcularHorasRealizadas(regsOrig, tratamentos, jornadaCLT, {
      ehDiaFolga: false,
    })

    expect(resultado.minutosTrabalhados).toBe(480)
    expect(resultado.isIncompleto).toBe(false)
    expect(resultado.intervaloAutomaticoAplicado).toBe(true)

    const validas = resultado.todasMarcacoes.filter((m) => !m.anulado)
    const anuladas = resultado.todasMarcacoes.filter((m) => m.anulado)

    expect(anuladas.length).toBe(1)
    expect(anuladas[0].horario).toBe('08:20')

    expect(validas.length).toBe(4) // Entrada (08:00), Auto Início (12:00), Auto Retorno (13:00), Saída (17:00)
    expect(validas[0].horario).toBe('08:00')
    expect(validas[0].corrigida).toBe(true)
    expect(validas[0].horarioOriginal).toBe('08:20')
  })
})
