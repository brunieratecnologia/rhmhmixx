import { describe, it, expect } from 'vitest'
import {
  construirExtratoFuncionario,
  gerarCsvBancoHoras,
  FuncionarioBancoHorasResumo,
  RelatorioBancoHorasGeral,
} from './bancoHorasRelatorioService'
import { construirEspelhoMensal } from '@/lib/calculoHoras'
import type { Jornada, BancoHorasLancamento } from '@/types/rh'

describe('Relatório e Extrato de Banco de Horas MH MIXX', () => {
  const jornadaSegSex: Jornada = {
    id: 'jornada-mhmixx-1',
    nome: 'Segunda a Sexta (08h às 18h)',
    dias_trabalho: ['seg', 'ter', 'qua', 'qui', 'sex'],
    dias_folga: ['sab', 'dom'],
    hora_entrada: '08:00',
    hora_inicio_intervalo: '12:00',
    hora_retorno_intervalo: '13:00',
    hora_saida: '18:00',
    duracao_jornada_min: 540, // 9h
    atravessa_meia_noite: false,
    created: '',
    updated: '',
  }

  it('1. Deve computar créditos de banco de horas por trabalho após a saída e dia de folga no extrato', () => {
    // 2026-10-01 (Quinta-feira): trabalho de 08:00 até 19:30 (saída prevista 18:00 -> +90 min crédito)
    // 2026-10-04 (Domingo): trabalho em dia de folga das 10:00 às 14:00 (+240 min crédito)
    const espelho = construirEspelhoMensal({
      ano: 2026,
      mes: 10,
      jornadaAtual: jornadaSegSex,
      historicoJornadas: [],
      registrosMes: [
        {
          id: 'r1',
          funcionario: 'f1',
          data_utc: '2026-10-01',
          hora_utc: '08:00:00',
          timestamp_utc: '2026-10-01T11:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        {
          id: 'r2',
          funcionario: 'f1',
          data_utc: '2026-10-01',
          hora_utc: '19:30:00',
          timestamp_utc: '2026-10-01T22:30:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        {
          id: 'r3',
          funcionario: 'f1',
          data_utc: '2026-10-04',
          hora_utc: '10:00:00',
          timestamp_utc: '2026-10-04T13:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        {
          id: 'r4',
          funcionario: 'f1',
          data_utc: '2026-10-04',
          hora_utc: '14:00:00',
          timestamp_utc: '2026-10-04T17:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
      ],
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
    })

    const extrato = construirExtratoFuncionario({
      ano: 2026,
      mes: 10,
      diasEspelho: espelho.dias,
      lancamentosManuais: [],
    })

    // Deve ter gerado 2 créditos
    const itemSaida = extrato.find((i) => i.origem === 'trabalho_pos_saida')
    expect(itemSaida).toBeDefined()
    expect(itemSaida?.minutos).toBe(90)
    expect(itemSaida?.horasFormatadas).toBe('+01:30')

    const itemFolga = extrato.find((i) => i.origem === 'dia_folga')
    expect(itemFolga).toBeDefined()
    expect(itemFolga?.minutos).toBe(240)
    expect(itemFolga?.horasFormatadas).toBe('+04:00')
  })

  it('1b. Deve rotular com clareza crédito decorrente de antecipação na entrada >= 30min', () => {
    // 2026-10-05: entrada às 07:15 (45 min antes do previsto de 08:00) e saída às 18:00
    const espelho = construirEspelhoMensal({
      ano: 2026,
      mes: 10,
      jornadaAtual: jornadaSegSex, // 08:00 às 18:00
      historicoJornadas: [],
      registrosMes: [
        {
          id: 'rant1',
          funcionario: 'f1',
          data_utc: '2026-10-05',
          hora_utc: '07:15:00',
          timestamp_utc: '2026-10-05T10:15:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        {
          id: 'rant2',
          funcionario: 'f1',
          data_utc: '2026-10-05',
          hora_utc: '18:00:00',
          timestamp_utc: '2026-10-05T21:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
      ],
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
    })

    const extrato = construirExtratoFuncionario({
      ano: 2026,
      mes: 10,
      diasEspelho: espelho.dias,
      lancamentosManuais: [],
    })

    const itemAntecipacao = extrato.find((i) => i.origem === 'antecipacao_entrada')
    expect(itemAntecipacao).toBeDefined()
    expect(itemAntecipacao?.minutos).toBe(45)
    expect(itemAntecipacao?.horasFormatadas).toBe('+00:45')
    expect(itemAntecipacao?.origemLabel).toBe('antecipação ≥30min')
  })

  it('2. Deve registrar ocorrência de atraso quando entrada excede 10 minutos de tolerância', () => {
    // 2026-10-02: entrada às 08:25 (atraso de 25 minutos na jornada de 08:00)
    const espelho = construirEspelhoMensal({
      ano: 2026,
      mes: 10,
      jornadaAtual: jornadaSegSex,
      historicoJornadas: [],
      registrosMes: [
        {
          id: 'r1',
          funcionario: 'f1',
          data_utc: '2026-10-02',
          hora_utc: '08:25:00',
          timestamp_utc: '2026-10-02T11:25:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
        {
          id: 'r2',
          funcionario: 'f1',
          data_utc: '2026-10-02',
          hora_utc: '18:00:00',
          timestamp_utc: '2026-10-02T21:00:00.000Z',
          origem: 'terminal',
          created: '',
          updated: '',
        },
      ],
      tratamentosMes: [],
      ausenciasMes: [],
      feriasMes: [],
    })

    const extrato = construirExtratoFuncionario({
      ano: 2026,
      mes: 10,
      diasEspelho: espelho.dias,
      lancamentosManuais: [],
    })

    const itemAtraso = extrato.find((i) => i.origem === 'atraso_tolerancia')
    expect(itemAtraso).toBeDefined()
    expect(itemAtraso?.minutos).toBe(25)
    expect(itemAtraso?.tipo).toBe('debito')
    expect(itemAtraso?.atrasoOcorrencia).toBeDefined()
    expect(itemAtraso?.atrasoOcorrencia).toContain('25')
  })

  it('3. Deve integrar lançamentos manuais de banco_horas e calcular o saldo corrente acumulado cronológico', () => {
    const lancamentoManual: BancoHorasLancamento = {
      id: 'bh-manual-1',
      funcionario: 'f1',
      data_referencia: '2026-10-15',
      tipo: 'ajuste_manual',
      minutos: 60,
      motivo: 'Ajuste manual concedido pela gerência',
      created: '2026-10-15T10:00:00.000Z',
      updated: '',
      expand: {
        usuario_responsavel: {
          id: 'u1',
          name: 'Gerente Admin',
          nome: 'Gerente Admin',
          email: 'admin@mhmixx.com.br',
          role: 'admin',
          ativo: true,
          created: '',
          updated: '',
        },
      },
    }

    const extrato = construirExtratoFuncionario({
      ano: 2026,
      mes: 10,
      diasEspelho: [],
      lancamentosManuais: [lancamentoManual],
    })

    expect(extrato.length).toBe(1)
    expect(extrato[0].origem).toBe('ajuste_admin')
    expect(extrato[0].minutos).toBe(60)
    expect(extrato[0].saldoAcumuladoFormatado).toBe('+01:00')
    expect(extrato[0].responsavelNome).toBe('Gerente Admin')
  })

  it('4. Deve gerar CSV formatado com BOM UTF-8 e delimitador ponto-e-vírgula para Excel pt-BR', () => {
    const funcionarioMock: FuncionarioBancoHorasResumo = {
      funcionario: {
        id: 'func-1',
        nome: 'Carlos Silva',
        matricula: '001',
        cpf: '12345678901',
        email: 'carlos@mhmixx.com.br',
        data_admissao: '2026-01-15',
        situacao: 'ativo',
        created: '',
        updated: '',
      },
      matricula: '001',
      nome: 'Carlos Silva',
      departamentoNome: 'Produção',
      cargoNome: 'Operador de Máquinas',
      jornadaNome: 'Segunda a Sexta',
      situacao: 'ativo',
      creditosPeriodoMinutos: 120,
      creditosPeriodoFormatado: '+02:00',
      debitosPeriodoMinutos: 30,
      debitosPeriodoFormatado: '-00:30',
      saldoPeriodoMinutos: 90,
      saldoPeriodoFormatado: '+01:30',
      saldoTotalMinutos: 90,
      saldoTotalFormatado: '+01:30',
      totalAtrasosPeriodo: 1,
      extrato: [],
    }

    const relatorioMock: RelatorioBancoHorasGeral = {
      ano: 2026,
      mes: 10,
      funcionarios: [funcionarioMock],
      totalCreditosMinutos: 120,
      totalCreditosFormatado: '+2h',
      totalDebitosMinutos: 30,
      totalDebitosFormatado: '-30m',
      saldoGeralEmpresaMinutos: 90,
      saldoGeralEmpresaFormatado: '+01:30',
      funcionariosSaldoNegativoCount: 0,
      totalFuncionariosAtivos: 1,
    }

    const csv = gerarCsvBancoHoras(relatorioMock, [funcionarioMock])
    expect(csv.startsWith('\uFEFF')).toBe(true) // BOM
    expect(csv).toContain('MH MIXX — AÇAÍ E FRUTAS CONGELADAS')
    expect(csv).toContain('RELATÓRIO DE BANCO DE HORAS - CONSOLIDADO')
    expect(csv).toContain('Outubro/2026')
    expect(csv).toContain('Carlos Silva')
    expect(csv).toContain(';+01:30;')
    expect(csv).toContain('Produção')
  })
})
