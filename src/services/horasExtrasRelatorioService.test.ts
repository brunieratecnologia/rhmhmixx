import { describe, it, expect } from 'vitest'
import { construirEspelhoMensal } from '@/lib/calculoHoras'
import { construirExtratoFuncionario } from './bancoHorasRelatorioService'
import {
  construirLancamentosHorasExtras,
  construirItensCreditoExpirado,
  gerarCsvHorasExtras,
  DIVISOR_CLT,
  ADICIONAL_HE,
  type FuncionarioHorasExtras,
  type RelatorioHorasExtras,
} from './horasExtrasRelatorioService'
import type { Jornada, RegistroHorario, BancoHorasLancamento } from '@/types/rh'

/**
 * Bateria de testes do Relatório de Horas Extras MH MIXX (execução anterior pendente).
 * Valida: tolerância de entrada 10 min (atraso integral acima), 5 min/marcação com
 * teto 10 min/dia sem suprimir a HE da saída, ciclo de 6 meses com vencidos como
 * HE +50% (FIFO), coerência espelho × banco de horas × horas extras e CSV pt-BR (";").
 */

const jornadaSegSex: Jornada = {
  id: 'jornada-mhmixx-1',
  nome: 'Segunda a Sexta (08h às 18h)',
  dias_trabalho: ['seg', 'ter', 'qua', 'qui', 'sex'],
  dias_folga: ['sab', 'dom'],
  hora_entrada: '08:00',
  hora_inicio_intervalo: '12:00',
  hora_retorno_intervalo: '13:00',
  hora_saida: '18:00',
  duracao_jornada_min: 540,
  atravessa_meia_noite: false,
  created: '',
  updated: '',
}

function reg(id: string, data: string, hora: string, func = 'f1'): RegistroHorario {
  const [y, m, d] = data.split('-').map(Number)
  const [hh, mm] = hora.split(':').map(Number)
  // horário local (America/Sao_Paulo) = UTC-3
  const ts = new Date(Date.UTC(y, m - 1, d, hh + 3, mm))
  return {
    id,
    funcionario: func,
    data_utc: data,
    hora_utc: hora + ':00',
    timestamp_utc: ts.toISOString().replace('T', ' ').replace('Z', ''),
    origem: 'terminal',
    created: '',
    updated: '',
  }
}

function espelho(mes: number, registros: RegistroHorario[]) {
  return construirEspelhoMensal({
    ano: 2026,
    mes,
    jornadaAtual: jornadaSegSex,
    historicoJornadas: [],
    registrosMes: registros,
    tratamentosMes: [],
    ausenciasMes: [],
    feriasMes: [],
  })
}

describe('(a) Tolerância de entrada — 10 min, atraso integral acima', () => {
  it('previsto 08:00, batida 08:13 → atraso integral de 13 min como débito de banco de horas', () => {
    // 2026-10-05 é segunda-feira (dia de trabalho)
    const e = espelho(10, [
      reg('r1', '2026-10-05', '08:13'),
      reg('r2', '2026-10-05', '18:00'),
    ])
    const dia = e.dias.find((d) => d.data === '2026-10-05')!
    expect(dia.entradaTolerada).toBe(false)
    expect(dia.atrasoMinutos).toBe(13)
    expect(dia.horasBancoDebitoMinutos).toBe(13)
    // Atraso não gera lançamento de hora extra
    const lanc = construirLancamentosHorasExtras({ ano: 2026, mes: 10, diasEspelho: e.dias })
    expect(lanc.find((i) => i.data === '2026-10-05')).toBeUndefined()
  })

  it('batida 08:08 → dentro da tolerância de 10 min, sem atraso, sem débito, sem HE', () => {
    const e = espelho(10, [
      reg('r1', '2026-10-06', '08:08'),
      reg('r2', '2026-10-06', '18:00'),
    ])
    const dia = e.dias.find((d) => d.data === '2026-10-06')!
    expect(dia.entradaTolerada).toBe(true)
    expect(dia.atrasoMinutos).toBe(0)
    expect(dia.horasBancoDebitoMinutos).toBe(0)
    expect(construirLancamentosHorasExtras({ ano: 2026, mes: 10, diasEspelho: e.dias })).toHaveLength(
      0,
    )
  })
})

describe('(b) Teto de variações 10 min/dia × saída além do previsto sempre computável', () => {
  it('variação de 5 min/marcação no almoço (teto 10/dia) é tolerada e NÃO suprime a HE da saída', () => {
    // 2026-10-07 (quarta): entrada 08:00, almoço 12:05→13:05 (5 min/marcação = teto diário),
    // saída 19:30 → +90 min além do previsto
    const e = espelho(10, [
      reg('r1', '2026-10-07', '08:00'),
      reg('r2', '2026-10-07', '12:05'),
      reg('r3', '2026-10-07', '13:05'),
      reg('r4', '2026-10-07', '19:30'),
    ])
    const dia = e.dias.find((d) => d.data === '2026-10-07')!
    expect(dia.variacoesDebitoMinutos ?? 0).toBe(0)
    expect(dia.variacoesToleradasMinutos ?? 0).toBeLessThanOrEqual(10)
    expect(dia.horasBancoCreditoPosSaidaMinutos).toBe(90)

    const lanc = construirLancamentosHorasExtras({ ano: 2026, mes: 10, diasEspelho: e.dias })
    const item = lanc.find((i) => i.origem === 'trabalho_pos_saida')
    expect(item).toBeDefined()
    expect(item!.minutos).toBe(90)
    expect(item!.horasFormatadas).toBe('01:30')
    expect(item!.origemLabel).toBe('Saída além do previsto')
  })

  it('variação acima de 5 min/marcação apura o tempo INTEGRALMENTE e mantém a HE da saída', () => {
    // Retorno do almoço 13:16 (16 min após o previsto 13:00) → acima dos 5 min/marcação
    // → débito integral de 16 min; a saída 19:30 (+90 min) permanece computável
    const e = espelho(10, [
      reg('r1', '2026-10-08', '08:00'),
      reg('r2', '2026-10-08', '12:16'),
      reg('r3', '2026-10-08', '13:16'),
      reg('r4', '2026-10-08', '19:30'),
    ])
    const dia = e.dias.find((d) => d.data === '2026-10-08')!
    expect(dia.variacoesDebitoMinutos ?? 0).toBe(16)
    // A saída além do previsto permanece integralmente computável
    expect(dia.horasBancoCreditoPosSaidaMinutos).toBe(90)
    const lanc = construirLancamentosHorasExtras({ ano: 2026, mes: 10, diasEspelho: e.dias })
    expect(lanc.find((i) => i.origem === 'trabalho_pos_saida')?.minutos).toBe(90)
  })
})

describe('(c) Ciclo de 6 meses — vencidos como HE +50% com FIFO', () => {
  it('dataLimiteCompensacao = geração + 6 meses; após o limite o crédito abre vira HE +50%', () => {
    const e = espelho(10, [
      reg('r1', '2026-10-01', '08:00'),
      reg('r2', '2026-10-01', '19:30'), // +90 min
    ])
    const extrato = construirExtratoFuncionario({
      ano: 2026,
      mes: 10,
      diasEspelho: e.dias,
      lancamentosManuais: [],
    })
    const credito = extrato.find((i) => i.tipo === 'credito' && i.data === '2026-10-01')!
    expect(credito).toBeDefined()
    expect(credito.minutos).toBe(90)
    expect(credito.dataLimiteCompensacao).toBe('2027-04-01')

    // Antes do vencimento: nada a pagar
    const antes = construirItensCreditoExpirado(extrato, '2027-03-01')
    expect(antes).toHaveLength(0)

    // Depois do vencimento: crédito em aberto vira HE +50%
    const expirados = construirItensCreditoExpirado(extrato, '2027-05-01')
    expect(expirados).toHaveLength(1)
    expect(expirados[0].minutos).toBe(90)
    expect(expirados[0].origem).toBe('credito_expirado')
    expect(expirados[0].vencido).toBe(true)
    expect(expirados[0].dataLimiteCompensacao).toBe('2027-04-01')
  })

  it('FIFO: compensação consome primeiro o crédito mais antigo; o mais recente permanece em aberto', () => {
    // Dois créditos: 01/10 (+90) e 02/10 (+60). Compensação manual de 100 min em 05/10
    // consome 90 do crédito de 01/10 e 10 do crédito de 02/10 (FIFO).
    const e = espelho(10, [
      reg('r1', '2026-10-01', '08:00'),
      reg('r2', '2026-10-01', '19:30'),
      reg('r3', '2026-10-02', '08:00'),
      reg('r4', '2026-10-02', '19:00'),
      reg('r5', '2026-10-05', '08:00'),
      reg('r6', '2026-10-05', '19:00'), // 09:00-08:00 trabalho = 600m - 540 = +60 (não usado)
    ])
    // Sobrepor: o dia 05/10 tem saldo próprio; a compensação é via lançamento manual (débito)
    const compensacao: BancoHorasLancamento = {
      id: 'bh-comp-1',
      funcionario: 'f1',
      data_referencia: '2026-10-20',
      tipo: 'debito',
      minutos: 100,
      motivo: 'Compensação de banco de horas (acordo)',
      created: '2026-10-20T12:00:00.000Z',
      updated: '',
    }
    const extrato = construirExtratoFuncionario({
      ano: 2026,
      mes: 10,
      diasEspelho: e.dias,
      lancamentosManuais: [compensacao],
    })

    // Crédito de 01/10 deve estar totalmente consumido; o de 02/10 com 50 min em aberto
    const abertos = construirItensCreditoExpirado(extrato, '2027-05-01')
    const cred02 = abertos.find((c) => c.id === 'he-expirado-' + extrato.find((i) => i.data === '2026-10-02' && i.tipo === 'credito')!.id)
    expect(cred02).toBeDefined()
    expect(cred02!.minutos).toBe(50)
    // Nenhum lançamento expirado vindo do crédito de 01/10 (consumido pelo FIFO)
    expect(abertos.find((c) => c.dataGeracao === undefined)).toBeUndefined()
    // Total em aberto vencido = 50 (não 150)
    expect(abertos.reduce((s, c) => s + c.minutos, 0)).toBe(50)
  })

  it('lançamento manual de crédito (banco_horas) também vence em 6 meses e vira HE +50%', () => {
    const manual: BancoHorasLancamento = {
      id: 'bh-manual-1',
      funcionario: 'f1',
      data_referencia: '2026-10-15',
      tipo: 'credito',
      minutos: 120,
      motivo: 'Crédito manual concedido pela gerência',
      created: '2026-10-15T12:00:00.000Z',
      updated: '',
    }
    const extrato = construirExtratoFuncionario({
      ano: 2026,
      mes: 10,
      diasEspelho: [],
      lancamentosManuais: [manual],
    })
    const expirados = construirItensCreditoExpirado(extrato, '2027-05-01')
    expect(expirados).toHaveLength(1)
    expect(expirados[0].minutos).toBe(120)
    expect(expirados[0].dataLimiteCompensacao).toBe('2027-04-15')
  })
})

describe('(d) Coerência espelho × banco de horas × horas extras no mesmo dia', () => {
  it('HE do relatório == crédito de banco do espelho no dia; extrato usa o mesmo motor', () => {
    // 2026-10-12: saída 19:30 → HE 90; 2026-10-13 (folga? não — terça): saída 20:00 → HE 120
    const e = espelho(10, [
      reg('r1', '2026-10-12', '08:00'),
      reg('r2', '2026-10-12', '19:30'),
      reg('r3', '2026-10-13', '08:00'),
      reg('r4', '2026-10-13', '20:00'),
    ])
    const extratoBH = construirExtratoFuncionario({
      ano: 2026,
      mes: 10,
      diasEspelho: e.dias,
      lancamentosManuais: [],
    })
    const lancHE = construirLancamentosHorasExtras({ ano: 2026, mes: 10, diasEspelho: e.dias })

    // Mesmo total: crédito do banco do espelho == horas extras apuradas do relatório
    const totalEspelho = e.dias.reduce((s, d) => s + (d.horasBancoCreditoMinutos || 0), 0)
    const totalRelatorioHE = lancHE
      .filter((i) => i.origem !== 'credito_expirado')
      .reduce((s, i) => s + i.minutos, 0)
    expect(totalRelatorioHE).toBe(totalEspelho)
    expect(totalRelatorioHE).toBe(210) // 90 + 120

    // Extrato de banco: mesmos minutos nas mesmas datas
    const creditoBH12 = extratoBH.find((i) => i.data === '2026-10-12' && i.tipo === 'credito')!
    expect(creditoBH12.minutos).toBe(90)
    const he12 = lancHE.find((i) => i.data === '2026-10-12')!
    expect(he12.minutos).toBe(creditoBH12.minutos)

    // Resumo completo com valor estimado (admin)
    const resumo = calcularResumoHorasExtras({
      ano: 2026,
      mes: 10,
      diasEspelho: e.dias,
      extratoBancoHoras: extratoBH,
      salarioContratual: 2000,
      isAdmin: true,
      hojeISO: '2026-11-01',
    })
    expect(resumo.horasExtrasPeriodoMinutos).toBe(210)
    expect(resumo.horasExtrasPeriodoFormatado).toBe('03:30')
    // Sem crédito vencido nesta competência (hoje 2026-11-01 < limite 2027)
    expect(resumo.creditoVencidoMinutos).toBe(0)
    // Valor-hora = salário ÷ 200; valor estimado só existe com crédito vencido > 0
    expect(DIVISOR_CLT).toBe(200)
    expect(ADICIONAL_HE).toBe(1.5)
    expect(resumo.valorHora).toBeCloseTo(10, 5)
    expect(resumo.valorEstimadoPagar ?? 0).toBe(0)

    // RH não-admin nunca recebe valores monetários
    const resumoRH = calcularResumoHorasExtras({
      ano: 2026,
      mes: 10,
      diasEspelho: e.dias,
      extratoBancoHoras: extratoBH,
      salarioContratual: 2000,
      isAdmin: false,
      hojeISO: '2026-11-01',
    })
    expect(resumoRH.valorHora).toBeUndefined()
    expect(resumoRH.valorEstimadoPagar).toBeUndefined()
  })
})

describe('CSV pt-BR (separador ";")', () => {
  it('gera CSV com BOM UTF-8, separador ";" e colunas monetárias apenas para admin', () => {
    const funcionario: FuncionarioHorasExtras = {
      funcionario: {
        id: 'f1',
        nome: 'Maria Souza',
        matricula: '007',
        cpf: '12345678901',
        situacao: 'ativo',
        created: '',
        updated: '',
      } as any,
      matricula: '007',
      nome: 'Maria Souza',
      departamentoNome: 'Produção',
      cargoNome: 'Operadora',
      jornadaNome: 'Seg a Sex',
      situacao: 'ativo',
      horasExtrasPeriodoMinutos: 210,
      horasExtrasPeriodoFormatado: '03:30',
      creditoVencidoMinutos: 90,
      creditoVencidoFormatado: '01:30',
      valorHora: 10,
      valorEstimadoPagar: 22.5,
      extrato: [],
    }
    const relatorio: RelatorioHorasExtras = {
      ano: 2026,
      mes: 10,
      isAdmin: true,
      funcionarios: [funcionario],
      totalHorasExtrasMinutos: 210,
      totalHorasExtrasFormatado: '03:30',
      totalCreditoVencidoMinutos: 90,
      totalCreditoVencidoFormatado: '01:30',
      valorTotalEstimadoPagar: 22.5,
      totalFuncionariosAtivos: 1,
    }

    const csv = gerarCsvHorasExtras(relatorio, [funcionario])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('MH MIXX — AÇAÍ E FRUTAS CONGELADAS')
    expect(csv).toContain('RELATÓRIO DE HORAS EXTRAS')
    expect(csv).toContain('Outubro/2026')
    expect(csv).toContain('Maria Souza')
    expect(csv).toContain(';03:30;')
    expect(csv).toContain('Crédito Vencido a Pagar HE +50%')
    // Coluna monetária presente para admin
    expect(csv).toContain('Valor Estimado a Pagar (R$)')

    // Versão RH (não-admin): sem colunas monetárias
    const csvRH = gerarCsvHorasExtras({ ...relatorio, isAdmin: false, valorTotalEstimadoPagar: undefined }, [funcionario])
    expect(csvRH).not.toContain('Valor Estimado a Pagar')
  })
})
