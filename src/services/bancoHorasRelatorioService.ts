import {
  construirEspelhoMensal,
  DiaEspelhoCalculado,
  timeStringToMinutes,
  minutesToTimeString,
  minutesToSignedString,
  minutesToHoursText,
} from '@/lib/calculoHoras'
import type {
  Funcionario,
  HistoricoJornada,
  RegistroHorario,
  TratamentoPonto,
  Ausencia,
  Ferias,
  Jornada,
  BancoHorasLancamento,
  Feriado,
} from '@/types/rh'
import { feriadosService } from './rh'
import pb from '@/lib/pocketbase/client'

export interface ExtratoItemBancoHoras {
  id: string
  data: string // YYYY-MM-DD
  tipo: 'credito' | 'debito'
  minutos: number
  horasFormatadas: string
  origem:
    | 'trabalho_pos_saida'
    | 'antecipacao_entrada'
    | 'dia_folga'
    | 'ajuste_admin'
    | 'atraso_tolerancia'
    | 'variacoes_marcacoes'
    | 'falta_injustificada'
  origemLabel: string
  descricao: string
  saldoAcumuladoMinutos?: number
  saldoAcumuladoFormatado?: string
  responsavelNome?: string
  atrasoOcorrencia?: string
  dataLimiteCompensacao?: string // Cláusula 8: data-limite de compensação do crédito (geração + 6 meses)
}

export interface FuncionarioBancoHorasResumo {
  funcionario: Funcionario
  matricula: string
  nome: string
  departamentoNome: string
  cargoNome: string
  jornadaNome: string
  situacao: string
  // Período selecionado
  creditosPeriodoMinutos: number
  creditosPeriodoFormatado: string
  debitosPeriodoMinutos: number
  debitosPeriodoFormatado: string
  saldoPeriodoMinutos: number
  saldoPeriodoFormatado: string
  // Saldo geral histórico / total
  saldoTotalMinutos: number
  saldoTotalFormatado: string
  // Quantidade de ocorrências de atraso no período
  totalAtrasosPeriodo: number
  // Extrato completo ordenado por data
  extrato: ExtratoItemBancoHoras[]
}

export interface RelatorioBancoHorasGeral {
  ano: number
  mes: number // 1 a 12
  funcionarios: FuncionarioBancoHorasResumo[]
  totalCreditosMinutos: number
  totalCreditosFormatado: string
  totalDebitosMinutos: number
  totalDebitosFormatado: string
  saldoGeralEmpresaMinutos: number
  saldoGeralEmpresaFormatado: string
  funcionariosSaldoNegativoCount: number
  totalFuncionariosAtivos: number
}

/**
 * Carrega e calcula o relatório de banco de horas consolidado para a competência indicada.
 * Utiliza estritamente os dados reais do banco PocketBase e o motor do espelho de ponto.
 */
export async function carregarDadosRelatorioBancoHoras(
  ano: number,
  mes: number,
): Promise<RelatorioBancoHorasGeral> {
  const padMes = String(mes).padStart(2, '0')
  const startStr = `${ano}-${padMes}-01`
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const endStr = `${ano}-${padMes}-${String(ultimoDia).padStart(2, '0')}`

  // 1. Carrega todos os funcionários com relacionamentos
  const todosFuncionarios = await pb.collection('funcionarios').getFullList<Funcionario>({
    sort: 'matricula,nome',
    expand: 'cargo,departamento,jornada_atual',
  })

  // 2. Carrega todos os registros de horário com margem de fuso horário
  const prevDate = new Date(ano, mes - 1, 0).toISOString().split('T')[0]
  const nextDate = new Date(ano, mes, 2).toISOString().split('T')[0]

  const todosRegistros = await pb.collection('registros_horario').getFullList<RegistroHorario>({
    filter: `(data_utc >= "${startStr}" && data_utc <= "${endStr}") || (timestamp_utc >= "${prevDate} 00:00:00" && timestamp_utc <= "${nextDate} 23:59:59")`,
    sort: 'timestamp_utc,hora_utc',
  })

  // 3. Tratamentos do mês
  const todosTratamentos = await pb.collection('tratamentos_ponto').getFullList<TratamentoPonto>({
    filter: `data_registro >= "${startStr}" && data_registro <= "${endStr}"`,
    sort: 'data_registro,hora_registro',
    expand: 'usuario_responsavel',
  })

  // 4. Ausências do mês
  const todasAusencias = await pb.collection('ausencias').getFullList<Ausencia>({
    filter: `data_inicio <= "${endStr}" && (data_fim >= "${startStr}" || data_fim = "" || data_fim = null)`,
    expand: 'documentos',
  })

  // 5. Férias do mês
  const todasFerias = await pb.collection('ferias').getFullList<Ferias>({
    filter: `status != "cancelada" && data_inicio <= "${endStr}" && data_fim >= "${startStr}"`,
  })

  // 6. Histórico de jornadas
  const todosHistoricosJornadas = await pb
    .collection('historico_jornadas')
    .getFullList<HistoricoJornada>({
      sort: '-data_inicio',
      expand: 'jornada',
    })

  // 7. Lançamentos manuais/registrados na coleção banco_horas
  const todosLancamentosManuais = await pb
    .collection('banco_horas')
    .getFullList<BancoHorasLancamento>({
      sort: '-data_referencia,-created',
      expand: 'usuario_responsavel',
    })

  // 8. Feriados aplicáveis (recorrentes + ano específico)
  let feriadosAplicaveis: Feriado[] = []
  try {
    feriadosAplicaveis = await feriadosService.listByAno(ano, true)
  } catch (err) {
    console.warn('Erro ao carregar feriados para o relatório de banco de horas:', err)
  }

  // Agrupar coleções por ID de funcionário para performance O(N)
  const registrosPorFunc = new Map<string, RegistroHorario[]>()
  for (const reg of todosRegistros) {
    if (!registrosPorFunc.has(reg.funcionario)) registrosPorFunc.set(reg.funcionario, [])
    registrosPorFunc.get(reg.funcionario)!.push(reg)
  }

  const tratamentosPorFunc = new Map<string, TratamentoPonto[]>()
  for (const trat of todosTratamentos) {
    if (!tratamentosPorFunc.has(trat.funcionario)) tratamentosPorFunc.set(trat.funcionario, [])
    tratamentosPorFunc.get(trat.funcionario)!.push(trat)
  }

  const ausenciasPorFunc = new Map<string, Ausencia[]>()
  for (const aus of todasAusencias) {
    if (!ausenciasPorFunc.has(aus.funcionario)) ausenciasPorFunc.set(aus.funcionario, [])
    ausenciasPorFunc.get(aus.funcionario)!.push(aus)
  }

  const feriasPorFunc = new Map<string, Ferias[]>()
  for (const fer of todasFerias) {
    if (!feriasPorFunc.has(fer.funcionario)) feriasPorFunc.set(fer.funcionario, [])
    feriasPorFunc.get(fer.funcionario)!.push(fer)
  }

  const histJornadasPorFunc = new Map<
    string,
    { data_inicio: string; data_fim?: string; jornada: Jornada }[]
  >()
  for (const h of todosHistoricosJornadas) {
    if (!histJornadasPorFunc.has(h.funcionario)) histJornadasPorFunc.set(h.funcionario, [])
    histJornadasPorFunc.get(h.funcionario)!.push({
      data_inicio: h.data_inicio,
      data_fim: h.data_fim,
      jornada: (h.expand?.jornada || null) as Jornada,
    })
  }

  const lancamentosManuaisPorFunc = new Map<string, BancoHorasLancamento[]>()
  for (const bh of todosLancamentosManuais) {
    if (!lancamentosManuaisPorFunc.has(bh.funcionario)) {
      lancamentosManuaisPorFunc.set(bh.funcionario, [])
    }
    lancamentosManuaisPorFunc.get(bh.funcionario)!.push(bh)
  }

  // Processar cada funcionário usando o motor de cálculo do espelho de ponto
  const listaFuncionariosResumo: FuncionarioBancoHorasResumo[] = []

  let totalCreditosMinutosGeral = 0
  let totalDebitosMinutosGeral = 0
  let funcionariosNegativos = 0

  for (const func of todosFuncionarios) {
    const regsMes = registrosPorFunc.get(func.id) || []
    const tratMes = tratamentosPorFunc.get(func.id) || []
    const ausMes = ausenciasPorFunc.get(func.id) || []
    const ferMes = feriasPorFunc.get(func.id) || []
    const histJornadas = histJornadasPorFunc.get(func.id) || []
    const lancamentosManuais = lancamentosManuaisPorFunc.get(func.id) || []

    const espelho = construirEspelhoMensal({
      ano,
      mes,
      jornadaAtual: func.expand?.jornada_atual || null,
      historicoJornadas: histJornadas,
      registrosMes: regsMes,
      tratamentosMes: tratMes,
      ausenciasMes: ausMes,
      feriasMes: ferMes,
      feriados: feriadosAplicaveis,
    })

    const extratoItens = construirExtratoFuncionario({
      ano,
      mes,
      diasEspelho: espelho.dias,
      lancamentosManuais,
    })

    // Calcular créditos e débitos do período a partir dos itens do extrato do período
    let creditosPeriodo = 0
    let debitosPeriodo = 0
    let atrasosCount = 0

    for (const item of extratoItens) {
      if (item.data >= startStr && item.data <= endStr) {
        if (item.tipo === 'credito') {
          creditosPeriodo += item.minutos
        } else if (item.tipo === 'debito') {
          debitosPeriodo += item.minutos
        }
        if (item.origem === 'atraso_tolerancia') {
          atrasosCount++
        }
      }
    }

    // Saldo acumulado histórico total (considerando todos os lançamentos)
    let saldoHistoricoTotal = 0
    for (const item of extratoItens) {
      if (item.tipo === 'credito') {
        saldoHistoricoTotal += item.minutos
      } else if (item.tipo === 'debito') {
        saldoHistoricoTotal -= item.minutos
      }
    }

    const saldoPeriodo = creditosPeriodo - debitosPeriodo

    if (func.situacao !== 'desligado') {
      totalCreditosMinutosGeral += creditosPeriodo
      totalDebitosMinutosGeral += debitosPeriodo
      if (saldoHistoricoTotal < 0) {
        funcionariosNegativos++
      }
    }

    listaFuncionariosResumo.push({
      funcionario: func,
      matricula: func.matricula || '---',
      nome: func.nome,
      departamentoNome: func.expand?.departamento?.nome || 'Não definido',
      cargoNome: func.expand?.cargo?.nome || 'Não definido',
      jornadaNome: func.expand?.jornada_atual?.nome || 'Padrão CLT',
      situacao: func.situacao || 'ativo',
      creditosPeriodoMinutos: creditosPeriodo,
      creditosPeriodoFormatado: `+${minutesToTimeString(creditosPeriodo)}`,
      debitosPeriodoMinutos: debitosPeriodo,
      debitosPeriodoFormatado: `-${minutesToTimeString(debitosPeriodo)}`,
      saldoPeriodoMinutos: saldoPeriodo,
      saldoPeriodoFormatado: minutesToSignedString(saldoPeriodo),
      saldoTotalMinutos: saldoHistoricoTotal,
      saldoTotalFormatado: minutesToSignedString(saldoHistoricoTotal),
      totalAtrasosPeriodo: atrasosCount,
      extrato: extratoItens,
    })
  }

  const saldoGeralEmpresa = totalCreditosMinutosGeral - totalDebitosMinutosGeral
  const totalAtivos = todosFuncionarios.filter((f) => f.situacao !== 'desligado').length

  return {
    ano,
    mes,
    funcionarios: listaFuncionariosResumo,
    totalCreditosMinutos: totalCreditosMinutosGeral,
    totalCreditosFormatado: `+${minutesToHoursText(totalCreditosMinutosGeral)}`,
    totalDebitosMinutos: totalDebitosMinutosGeral,
    totalDebitosFormatado: `-${minutesToHoursText(totalDebitosMinutosGeral)}`,
    saldoGeralEmpresaMinutos: saldoGeralEmpresa,
    saldoGeralEmpresaFormatado: minutesToSignedString(saldoGeralEmpresa),
    funcionariosSaldoNegativoCount: funcionariosNegativos,
    totalFuncionariosAtivos: totalAtivos,
  }
}

/**
 * Constrói a lista detalhada lançamento a lançamento do banco de horas de um colaborador,
 * unificando:
 * 1. Crédito por trabalho pós-saída prevista da jornada
 * 2. Crédito por trabalho integral em dia de folga / DSR
 * 3. Ocorrências de atraso acima da tolerância de 10 min (débito/ocorrência)
 * 4. Faltas de marcação integral em dia útil de trabalho previsto
 * 5. Lançamentos manuais auditados registrados pelo RH/admin na tabela `banco_horas`
 *
 * Calcula o saldo corrente acumulado cronológico.
 */
export function construirExtratoFuncionario(params: {
  ano: number
  mes: number
  diasEspelho: DiaEspelhoCalculado[]
  lancamentosManuais: BancoHorasLancamento[]
}): ExtratoItemBancoHoras[] {
  const { diasEspelho, lancamentosManuais } = params
  const itens: ExtratoItemBancoHoras[] = []

  // 1. Processa os dias do espelho de ponto da competência
  for (const dia of diasEspelho) {
    // Crédito pós-saída, antecipação >= 30min ou dia de folga
    if (dia.horasBancoCreditoMinutos > 0) {
      const ehFolga = dia.ehDiaFolga || dia.ehFeriado
      const temPosSaida = (dia.horasBancoCreditoPosSaidaMinutos || 0) > 0
      const temAntecipacao = (dia.horasBancoCreditoAntecipacaoMinutos || 0) > 0

      if (ehFolga) {
        itens.push({
          id: `espelho-cred-folga-${dia.data}`,
          data: dia.data,
          tipo: 'credito',
          minutos: dia.horasBancoCreditoMinutos,
          horasFormatadas: `+${minutesToTimeString(dia.horasBancoCreditoMinutos)}`,
          origem: 'dia_folga',
          origemLabel: dia.ehFeriado ? 'Feriado trabalhado' : 'Dia de folga / DSR',
          descricao: dia.ehFeriado
            ? `Trabalho em feriado (${dia.feriadoDescricao || 'Feriado'}) - crédito integral`
            : `Trabalho integral em dia de folga (${minutesToHoursText(dia.horasBancoCreditoMinutos)})`,
        })
      } else if (temPosSaida && temAntecipacao) {
        // Se houve ambos no mesmo dia, decompõe em 2 lançamentos auditáveis ou detalha com clareza
        itens.push({
          id: `espelho-cred-ant-${dia.data}`,
          data: dia.data,
          tipo: 'credito',
          minutos: dia.horasBancoCreditoAntecipacaoMinutos!,
          horasFormatadas: `+${minutesToTimeString(dia.horasBancoCreditoAntecipacaoMinutos!)}`,
          origem: 'antecipacao_entrada',
          origemLabel: 'antecipação ≥30min',
          descricao: `Crédito por chegada com antecedência ≥30m antes do previsto (${dia.horarioPrevistoFormatado})`,
        })
        itens.push({
          id: `espelho-cred-pos-${dia.data}`,
          data: dia.data,
          tipo: 'credito',
          minutos: dia.horasBancoCreditoPosSaidaMinutos!,
          horasFormatadas: `+${minutesToTimeString(dia.horasBancoCreditoPosSaidaMinutos!)}`,
          origem: 'trabalho_pos_saida',
          origemLabel: 'Trabalho após saída prevista',
          descricao: `Crédito por horas trabalhadas após o horário previsto (${dia.horarioPrevistoFormatado})`,
        })
      } else if (temAntecipacao) {
        itens.push({
          id: `espelho-cred-ant-${dia.data}`,
          data: dia.data,
          tipo: 'credito',
          minutos: dia.horasBancoCreditoMinutos,
          horasFormatadas: `+${minutesToTimeString(dia.horasBancoCreditoMinutos)}`,
          origem: 'antecipacao_entrada',
          origemLabel: 'antecipação ≥30min',
          descricao: `Crédito por chegada com antecedência ≥30m antes do previsto (${dia.horarioPrevistoFormatado})`,
        })
      } else {
        itens.push({
          id: `espelho-cred-${dia.data}`,
          data: dia.data,
          tipo: 'credito',
          minutos: dia.horasBancoCreditoMinutos,
          horasFormatadas: `+${minutesToTimeString(dia.horasBancoCreditoMinutos)}`,
          origem: 'trabalho_pos_saida',
          origemLabel: 'Trabalho após saída prevista',
          descricao: `Crédito por horas trabalhadas após o horário previsto (${dia.horarioPrevistoFormatado})`,
        })
      }
    }

    // Débitos ou atrasos
    if (dia.horasBancoDebitoMinutos > 0) {
      const ehAtraso = dia.atrasoMinutos > 0
      const temVariacaoMarcacao = dia.ocorrencias.some((o) => o.tipo === 'variacao_marcacao')
      const descrAtraso = dia.ocorrencias.find((o) => o.tipo === 'atraso')?.descricao
      const descrVariacao = dia.ocorrencias.find((o) => o.tipo === 'variacao_marcacao')?.descricao
      const descrAusencia = dia.ocorrencias.find((o) => o.tipo === 'ausencia')?.descricao

      itens.push({
        id: `espelho-deb-${dia.data}`,
        data: dia.data,
        tipo: 'debito',
        minutos: dia.horasBancoDebitoMinutos,
        horasFormatadas: `-${minutesToTimeString(dia.horasBancoDebitoMinutos)}`,
        origem: ehAtraso
          ? 'atraso_tolerancia'
          : temVariacaoMarcacao
            ? 'variacoes_marcacoes'
            : 'falta_injustificada',
        origemLabel: ehAtraso
          ? 'Atraso excedente (>10m)'
          : temVariacaoMarcacao
            ? 'Variação de marcação (art. 58 §1º)'
            : 'Ausência sem marcação',
        descricao:
          descrAtraso ||
          descrVariacao ||
          descrAusencia ||
          (ehAtraso ? `Atraso na entrada excedendo a tolerância` : `Ausência no dia de trabalho`),
        atrasoOcorrencia: ehAtraso
          ? descrAtraso || `Atraso de ${dia.atrasoMinutos} minutos registrado no ponto`
          : undefined,
      })
    }
  }

  // 2. Lançamentos manuais registrados no PocketBase
  for (const manual of lancamentosManuais) {
    const dataRefStr = manual.data_referencia ? manual.data_referencia.slice(0, 10) : ''
    const tipo = manual.tipo === 'debito' ? 'debito' : 'credito'
    const resp =
      manual.expand?.usuario_responsavel?.nome ||
      manual.expand?.usuario_responsavel?.name ||
      'RH / Admin'

    itens.push({
      id: manual.id,
      data: dataRefStr,
      tipo,
      minutos: manual.minutos,
      horasFormatadas:
        tipo === 'debito'
          ? `-${minutesToTimeString(manual.minutos)}`
          : `+${minutesToTimeString(manual.minutos)}`,
      origem: 'ajuste_admin',
      origemLabel: manual.tipo === 'ajuste_manual' ? 'Ajuste manual RH' : 'Lançamento manual',
      descricao: manual.motivo || 'Lançamento manual efetuado pelo administrador',
      responsavelNome: resp,
    })
  }

  // Cláusula 8: todo crédito recebe a data-limite de compensação (geração + 6 meses)
  for (const item of itens) {
    if (item.tipo === 'credito' && item.data) {
      item.dataLimiteCompensacao = adicionarMesesISOData(item.data, 6)
    }
  }

  // Ordena cronologicamente crescente para calcular saldo acumulado corrente
  itens.sort((a, b) => {
    if (a.data !== b.data) return a.data.localeCompare(b.data)
    return a.id.localeCompare(b.id)
  })

  let acumulado = 0
  for (const item of itens) {
    if (item.tipo === 'credito') {
      acumulado += item.minutos
    } else {
      acumulado -= item.minutos
    }
    item.saldoAcumuladoMinutos = acumulado
    item.saldoAcumuladoFormatado = minutesToSignedString(acumulado)
  }

  // Inverte para exibição no extrato do mais recente para o mais antigo
  return itens.reverse()
}

/**
 * Gera conteúdo CSV no padrão pt-BR com BOM para Excel (separador ";")
 */
export function gerarCsvBancoHoras(
  relatorio: RelatorioBancoHorasGeral,
  funcionarios: FuncionarioBancoHorasResumo[],
): string {
  const MESES = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ]
  const linhas: string[][] = [
    ['MH MIXX — AÇAÍ E FRUTAS CONGELADAS'],
    ['RELATÓRIO DE BANCO DE HORAS - CONSOLIDADO'],
    ['Competência:', `${MESES[relatorio.mes - 1]}/${relatorio.ano}`],
    [
      'Data de Emissão:',
      new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(new Date()),
    ],
    [],
    ['RESUMO GERAL DA EMPRESA'],
    ['Total de Créditos do Período:', relatorio.totalCreditosFormatado],
    ['Total de Débitos do Período:', relatorio.totalDebitosFormatado],
    ['Saldo Geral da Empresa:', relatorio.saldoGeralEmpresaFormatado],
    ['Funcionários com Saldo Negativo:', String(relatorio.funcionariosSaldoNegativoCount)],
    ['Total de Funcionários Ativos:', String(relatorio.totalFuncionariosAtivos)],
    [],
    [
      'Matrícula',
      'Colaborador',
      'Departamento',
      'Cargo',
      'Jornada',
      'Situação',
      'Créditos do Período',
      'Débitos do Período',
      'Saldo do Período',
      'Saldo Total Atual',
      'Atrasos (>10m)',
    ],
  ]

  for (const f of funcionarios) {
    linhas.push([
      f.matricula,
      f.nome,
      f.departamentoNome,
      f.cargoNome,
      f.jornadaNome,
      f.situacao === 'ativo'
        ? 'Ativo'
        : f.situacao === 'em_ferias'
          ? 'Em Férias'
          : f.situacao === 'afastado'
            ? 'Afastado'
            : 'Desligado',
      f.creditosPeriodoFormatado,
      f.debitosPeriodoFormatado,
      f.saldoPeriodoFormatado,
      f.saldoTotalFormatado,
      String(f.totalAtrasosPeriodo),
    ])
  }

  // BOM UTF-8 + separador ';'
  const csvContent =
    '\uFEFF' +
    linhas
      .map((row) => row.map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n')

  return csvContent
}

/**
 * Cláusula 8: acrescenta meses a uma data ISO (YYYY-MM-DD), ajustando ao último dia do mês destino.
 * Usada para calcular a data-limite de compensação de cada crédito (geração + 6 meses).
 */
export function adicionarMesesISOData(dataISO: string, meses: number): string {
  const base = dataISO.slice(0, 10)
  const partes = base.split('-')
  const ano = parseInt(partes[0], 10)
  const mes = parseInt(partes[1], 10)
  const dia = parseInt(partes[2], 10)
  if (isNaN(ano) || isNaN(mes) || isNaN(dia)) return base

  const totalMeses = mes - 1 + meses
  const anoDestino = ano + Math.floor(totalMeses / 12)
  const mesDestino = (totalMeses % 12) + 1
  const ultimoDiaDestino = new Date(Date.UTC(anoDestino, mesDestino, 0)).getUTCDate()
  const diaDestino = Math.min(dia, ultimoDiaDestino)

  return `${anoDestino}-${String(mesDestino).padStart(2, '0')}-${String(diaDestino).padStart(2, '0')}`
}

/** Data de hoje (YYYY-MM-DD) no fuso de São Paulo */
export function hojeISOBrasil(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Diferença em dias entre duas datas ISO (YYYY-MM-DD): fim - início */
export function diasEntreISO(inicioISO: string, fimISO: string): number {
  const p1 = inicioISO.split('-')
  const p2 = fimISO.split('-')
  const a1 = parseInt(p1[0], 10)
  const m1 = parseInt(p1[1], 10)
  const d1 = parseInt(p1[2], 10)
  const a2 = parseInt(p2[0], 10)
  const m2 = parseInt(p2[1], 10)
  const d2 = parseInt(p2[2], 10)
  if ([a1, m1, d1, a2, m2, d2].some((v) => isNaN(v))) return 0
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000)
}

export interface CreditoAbertoBancoHoras {
  id: string
  dataGeracao: string
  dataLimite: string
  origemLabel: string
  minutosGerados: number
  minutosCompensados: number
  minutosAbertos: number
  vencido: boolean
  diasRestantes: number // negativo quando vencido
}

export interface ResumoCreditosAbertos {
  creditos: CreditoAbertoBancoHoras[]
  minutosAbertosNoPrazo: number
  minutosAbertosVencidos: number
  proximoVencimentoDias?: number
}

/**
 * Cláusula 8: apura os créditos ainda em aberto aplicando FIFO —
 * cada débito (compensação) consome primeiro os créditos mais antigos.
 * Créditos cuja data-limite (geração + 6 meses) já passou ficam marcados como vencidos
 * (a pagar como hora extra com adicional mínimo de 50%).
 */
export function calcularCreditosAbertosBancoHoras(
  itens: ExtratoItemBancoHoras[],
  hojeISO?: string,
): ResumoCreditosAbertos {
  const hoje = hojeISO || hojeISOBrasil()

  const cronologicos = [...itens].sort((a, b) => {
    if (a.data !== b.data) return a.data.localeCompare(b.data)
    return a.id.localeCompare(b.id)
  })

  const filaCreditos: {
    id: string
    dataGeracao: string
    dataLimite: string
    origemLabel: string
    gerados: number
    restante: number
  }[] = []

  for (const item of cronologicos) {
    if (item.tipo === 'credito' && item.minutos > 0) {
      filaCreditos.push({
        id: item.id,
        dataGeracao: item.data,
        dataLimite: item.dataLimiteCompensacao || adicionarMesesISOData(item.data, 6),
        origemLabel: item.origemLabel,
        gerados: item.minutos,
        restante: item.minutos,
      })
    } else if (item.tipo === 'debito' && item.minutos > 0) {
      let restanteDebito = item.minutos
      for (const credito of filaCreditos) {
        if (restanteDebito <= 0) break
        if (credito.restante <= 0) continue
        const consumido = Math.min(credito.restante, restanteDebito)
        credito.restante -= consumido
        restanteDebito -= consumido
      }
    }
  }

  const creditos: CreditoAbertoBancoHoras[] = []
  let minutosNoPrazo = 0
  let minutosVencidos = 0
  let proximoVencimentoDias: number | undefined

  for (const credito of filaCreditos) {
    if (credito.restante <= 0) continue
    const vencido = credito.dataLimite < hoje
    const diasRestantes = diasEntreISO(hoje, credito.dataLimite)

    creditos.push({
      id: credito.id,
      dataGeracao: credito.dataGeracao,
      dataLimite: credito.dataLimite,
      origemLabel: credito.origemLabel,
      minutosGerados: credito.gerados,
      minutosCompensados: credito.gerados - credito.restante,
      minutosAbertos: credito.restante,
      vencido,
      diasRestantes,
    })

    if (vencido) {
      minutosVencidos += credito.restante
    } else {
      minutosNoPrazo += credito.restante
      if (proximoVencimentoDias === undefined || diasRestantes < proximoVencimentoDias) {
        proximoVencimentoDias = diasRestantes
      }
    }
  }

  creditos.sort((a, b) => a.dataGeracao.localeCompare(b.dataGeracao))

  return {
    creditos,
    minutosAbertosNoPrazo: minutosNoPrazo,
    minutosAbertosVencidos: minutosVencidos,
    proximoVencimentoDias,
  }
}
