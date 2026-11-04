import {
  construirEspelhoMensal,
  DiaEspelhoCalculado,
  timeStringToMinutes,
  minutesToTimeString,
  minutesToSignedString,
  minutesToHoursText,
} from '@/lib/calculoHoras'
import {
  construirExtratoFuncionario,
  ExtratoItemBancoHoras,
  adicionarMesesISOData,
  hojeISOBrasil,
} from './bancoHorasRelatorioService'
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

/**
 * Constantes da CLT / Acordo Individual MH MIXX:
 * - Jornada semanal padrão: 44h semanais -> Divisor CLT = 220 ou 200 conforme escala (adotado 200 no teste)
 * - Adicional mínimo de hora extra CLT: 50% (fator 1.5)
 */
export const DIVISOR_CLT = 200
export const ADICIONAL_HE = 1.5

export interface ItemLancamentoHoraExtra {
  id: string
  data: string // YYYY-MM-DD
  origem:
    | 'trabalho_pos_saida'
    | 'antecipacao_entrada'
    | 'dia_folga'
    | 'credito_expirado'
    | 'ajuste_manual'
  origemLabel: string
  descricao: string
  minutos: number
  horasFormatadas: string
  vencido?: boolean
  dataLimiteCompensacao?: string
  dataGeracao?: string
  valorHora?: number
  valorEstimado?: number
}

export interface FuncionarioHorasExtras {
  funcionario: Funcionario
  matricula: string
  nome: string
  departamentoNome: string
  cargoNome: string
  jornadaNome: string
  situacao: string
  // Total apurado de HE da competência
  horasExtrasPeriodoMinutos: number
  horasExtrasPeriodoFormatado: string
  // Créditos de banco de horas vencidos (passados dos 6 meses sem compensação) a pagar como HE +50%
  creditoVencidoMinutos: number
  creditoVencidoFormatado: string
  // Valores monetários (visíveis exclusivamente para admin com salario_contratual preenchido)
  salarioContratual?: number
  valorHora?: number
  valorEstimadoPagar?: number // (creditoVencidoMinutos / 60) * valorHora * 1.5
  // Extrato completo ordenado por data
  extrato: ItemLancamentoHoraExtra[]
}

export interface RelatorioHorasExtras {
  ano: number
  mes: number // 1 a 12
  isAdmin: boolean
  funcionarios: FuncionarioHorasExtras[]
  totalHorasExtrasMinutos: number
  totalHorasExtrasFormatado: string
  totalCreditoVencidoMinutos: number
  totalCreditoVencidoFormatado: string
  valorTotalEstimadoPagar?: number
  totalFuncionariosAtivos: number
  totalFuncionariosComHE: number
}

/**
 * Constrói os lançamentos de horas extras diretamente a partir dos dias do espelho de ponto,
 * garantindo total coerência com o motor de cálculo.
 */
export function construirLancamentosHorasExtras(params: {
  ano: number
  mes: number
  diasEspelho: DiaEspelhoCalculado[]
}): ItemLancamentoHoraExtra[] {
  const { diasEspelho } = params
  const itens: ItemLancamentoHoraExtra[] = []

  for (const dia of diasEspelho) {
    if (dia.horasBancoCreditoMinutos <= 0) continue

    const ehFolga = dia.ehDiaFolga || dia.ehFeriado
    const temPosSaida = (dia.horasBancoCreditoPosSaidaMinutos || 0) > 0
    const temAntecipacao = (dia.horasBancoCreditoAntecipacaoMinutos || 0) > 0

    if (ehFolga) {
      itens.push({
        id: `he-folga-${dia.data}`,
        data: dia.data,
        origem: 'dia_folga',
        origemLabel: dia.ehFeriado ? 'Feriado trabalhado' : 'Dia de folga / DSR',
        descricao: dia.ehFeriado
          ? `Trabalho em feriado (${dia.feriadoDescricao || 'Feriado'}) - hora extra integral`
          : `Trabalho integral em dia de folga (${minutesToHoursText(dia.horasBancoCreditoMinutos)})`,
        minutos: dia.horasBancoCreditoMinutos,
        horasFormatadas: minutesToTimeString(dia.horasBancoCreditoMinutos),
      })
    } else if (temPosSaida && temAntecipacao) {
      itens.push({
        id: `he-ant-${dia.data}`,
        data: dia.data,
        origem: 'antecipacao_entrada',
        origemLabel: 'Antecipação de entrada',
        descricao: `Chegada com antecedência ≥30m antes do previsto (${dia.horarioPrevistoFormatado})`,
        minutos: dia.horasBancoCreditoAntecipacaoMinutos!,
        horasFormatadas: minutesToTimeString(dia.horasBancoCreditoAntecipacaoMinutos!),
      })
      itens.push({
        id: `he-pos-${dia.data}`,
        data: dia.data,
        origem: 'trabalho_pos_saida',
        origemLabel: 'Saída além do previsto',
        descricao: `Permanência após saída prevista (${dia.horarioPrevistoFormatado})`,
        minutos: dia.horasBancoCreditoPosSaidaMinutos!,
        horasFormatadas: minutesToTimeString(dia.horasBancoCreditoPosSaidaMinutos!),
      })
    } else if (temAntecipacao) {
      itens.push({
        id: `he-ant-${dia.data}`,
        data: dia.data,
        origem: 'antecipacao_entrada',
        origemLabel: 'Antecipação de entrada',
        descricao: `Chegada com antecedência ≥30m antes do previsto (${dia.horarioPrevistoFormatado})`,
        minutos: dia.horasBancoCreditoMinutos,
        horasFormatadas: minutesToTimeString(dia.horasBancoCreditoMinutos),
      })
    } else {
      itens.push({
        id: `he-pos-${dia.data}`,
        data: dia.data,
        origem: 'trabalho_pos_saida',
        origemLabel: 'Saída além do previsto',
        descricao: `Permanência além do previsto (${dia.horarioPrevistoFormatado})`,
        minutos: dia.horasBancoCreditoMinutos,
        horasFormatadas: minutesToTimeString(dia.horasBancoCreditoMinutos),
      })
    }
  }

  itens.sort((a, b) => a.data.localeCompare(b.data))
  return itens
}

/**
 * Apura os créditos expirados (que ultrapassaram a data-limite de compensação de 6 meses)
 * a partir do extrato de banco de horas, aplicando FIFO: os débitos abatem primeiro
 * os créditos mais antigos. Aqueles que permanecerem com saldo positivo e dataLimite < hoje
 * tornam-se horas extras vencidas a pagar com acréscimo de +50%.
 */
export function construirItensCreditoExpirado(
  extratoBancoHoras: ExtratoItemBancoHoras[],
  hojeISO?: string,
): ItemLancamentoHoraExtra[] {
  const hoje = hojeISO || hojeISOBrasil()

  // Ordena cronologicamente para garantir aplicação rigorosa do FIFO
  const cronologicos = [...extratoBancoHoras].sort((a, b) => {
    if (a.data !== b.data) return a.data.localeCompare(b.data)
    return a.id.localeCompare(b.id)
  })

  const filaCreditos: {
    id: string
    dataGeracao: string
    dataLimite: string
    origemLabel: string
    descricao: string
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
        descricao: item.descricao,
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

  const expirados: ItemLancamentoHoraExtra[] = []

  for (const cred of filaCreditos) {
    if (cred.restante <= 0) continue
    if (cred.dataLimite < hoje) {
      expirados.push({
        id: `he-expirado-${cred.id}`,
        data: cred.dataLimite,
        dataGeracao: cred.dataGeracao,
        dataLimiteCompensacao: cred.dataLimite,
        origem: 'credito_expirado',
        origemLabel: 'Crédito BH Vencido (6 meses)',
        descricao: `Crédito de ${minutesToHoursText(cred.gerados)} gerado em ${cred.dataGeracao} não compensado até ${cred.dataLimite} (saldo restante: ${minutesToHoursText(cred.restante)})`,
        minutos: cred.restante,
        horasFormatadas: minutesToTimeString(cred.restante),
        vencido: true,
      })
    }
  }

  expirados.sort((a, b) => a.data.localeCompare(b.data))
  return expirados
}

/**
 * Calcula o resumo consolidado de um funcionário para a competência indicada.
 */
export function calcularResumoHorasExtras(params: {
  ano: number
  mes: number
  diasEspelho: DiaEspelhoCalculado[]
  extratoBancoHoras: ExtratoItemBancoHoras[]
  salarioContratual?: number
  isAdmin: boolean
  hojeISO?: string
}): {
  horasExtrasPeriodoMinutos: number
  horasExtrasPeriodoFormatado: string
  creditoVencidoMinutos: number
  creditoVencidoFormatado: string
  valorHora?: number
  valorEstimadoPagar?: number
  lancamentosCompletos: ItemLancamentoHoraExtra[]
} {
  const { ano, mes, diasEspelho, extratoBancoHoras, salarioContratual, isAdmin, hojeISO } = params

  const lancamentosPeriodo = construirLancamentosHorasExtras({ ano, mes, diasEspelho })
  const itensExpirados = construirItensCreditoExpirado(extratoBancoHoras, hojeISO)

  const heMinutos = lancamentosPeriodo.reduce((s, i) => s + i.minutos, 0)
  const vencidoMinutos = itensExpirados.reduce((s, i) => s + i.minutos, 0)

  let valorHora: number | undefined
  let valorEstimadoPagar: number | undefined

  if (isAdmin && salarioContratual && salarioContratual > 0) {
    valorHora = salarioContratual / DIVISOR_CLT
    const horasPagar = vencidoMinutos / 60
    valorEstimadoPagar = horasPagar * valorHora * ADICIONAL_HE
  }

  // Preenche valores nos itens expirados se for admin
  const expiradosComValores = itensExpirados.map((item) => {
    if (isAdmin && valorHora) {
      const val = (item.minutos / 60) * valorHora * ADICIONAL_HE
      return {
        ...item,
        valorHora,
        valorEstimado: Math.round(val * 100) / 100,
      }
    }
    return item
  })

  const todosLancamentos = [...lancamentosPeriodo, ...expiradosComValores].sort((a, b) =>
    a.data.localeCompare(b.data),
  )

  return {
    horasExtrasPeriodoMinutos: heMinutos,
    horasExtrasPeriodoFormatado: minutesToTimeString(heMinutos),
    creditoVencidoMinutos: vencidoMinutos,
    creditoVencidoFormatado: minutesToTimeString(vencidoMinutos),
    valorHora,
    valorEstimadoPagar:
      valorEstimadoPagar !== undefined ? Math.round(valorEstimadoPagar * 100) / 100 : undefined,
    lancamentosCompletos: todosLancamentos,
  }
}

/**
 * Carrega do PocketBase os dados completos de Horas Extras e Banco de Horas consolidado.
 */
export async function carregarDadosRelatorioHorasExtras(
  ano: number,
  mes: number,
  isAdmin: boolean,
  hojeISO?: string,
): Promise<RelatorioHorasExtras> {
  const padMes = String(mes).padStart(2, '0')
  const startStr = `${ano}-${padMes}-01`
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const endStr = `${ano}-${padMes}-${String(ultimoDia).padStart(2, '0')}`

  // 1. Carrega todos os funcionários
  const todosFuncionarios = await pb.collection('funcionarios').getFullList<Funcionario>({
    sort: 'matricula,nome',
    expand: 'cargo,departamento,jornada_atual',
  })

  // 2. Registros com margem de fuso
  const prevDate = new Date(ano, mes - 1, 0).toISOString().split('T')[0]
  const nextDate = new Date(ano, mes, 2).toISOString().split('T')[0]

  const todosRegistros = await pb.collection('registros_horario').getFullList<RegistroHorario>({
    filter: `(data_utc >= "${startStr}" && data_utc <= "${endStr}") || (timestamp_utc >= "${prevDate} 00:00:00" && timestamp_utc <= "${nextDate} 23:59:59")`,
    sort: 'timestamp_utc,hora_utc',
  })

  // 3. Tratamentos
  const todosTratamentos = await pb.collection('tratamentos_ponto').getFullList<TratamentoPonto>({
    filter: `data_registro >= "${startStr}" && data_registro <= "${endStr}"`,
    sort: 'data_registro,hora_registro',
    expand: 'usuario_responsavel',
  })

  // 4. Ausências
  const todasAusencias = await pb.collection('ausencias').getFullList<Ausencia>({
    filter: `data_fim >= "${startStr}" && data_inicio <= "${endStr}"`,
  })

  // 5. Férias
  const todasFerias = await pb.collection('ferias').getFullList<Ferias>({
    filter: `status != "cancelada" && status != "rejeitada" && data_fim >= "${startStr}" && data_inicio <= "${endStr}"`,
  })

  // 6. Feriados
  let feriados: Feriado[] = []
  try {
    feriados = await feriadosService.listByAno(ano)
  } catch (err) {
    console.warn('Não foi possível carregar feriados:', err)
  }

  // 7. Histórico de jornadas
  const todosHistoricos = await pb.collection('historico_jornadas').getFullList<HistoricoJornada>({
    sort: '-data_inicio',
    expand: 'jornada',
  })

  // Indexação em maps para performance O(N)
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
  for (const h of todosHistoricos) {
    if (!histJornadasPorFunc.has(h.funcionario)) histJornadasPorFunc.set(h.funcionario, [])
    histJornadasPorFunc.get(h.funcionario)!.push({
      data_inicio: h.data_inicio,
      data_fim: h.data_fim,
      jornada: (h.expand?.jornada || null) as Jornada,
    })
  }

  // 8. Lançamentos manuais de banco_horas (todo o histórico para FIFO correto de créditos expirados)
  const todosLancamentosManuais = await pb
    .collection('banco_horas')
    .getFullList<BancoHorasLancamento>({
      sort: 'data_referencia,created',
      expand: 'usuario_registro',
    })

  const lancamentosManuaisPorFunc = new Map<string, BancoHorasLancamento[]>()
  for (const bh of todosLancamentosManuais) {
    if (!lancamentosManuaisPorFunc.has(bh.funcionario)) {
      lancamentosManuaisPorFunc.set(bh.funcionario, [])
    }
    lancamentosManuaisPorFunc.get(bh.funcionario)!.push(bh)
  }

  const listaFuncionarios: FuncionarioHorasExtras[] = []
  let totalHEGeral = 0
  let totalVencidoGeral = 0
  let valorTotalGeral = 0
  let countComHE = 0

  for (const func of todosFuncionarios) {
    const regFunc = registrosPorFunc.get(func.id) || []
    const tratFunc = tratamentosPorFunc.get(func.id) || []
    const ausFunc = ausenciasPorFunc.get(func.id) || []
    const ferFunc = feriasPorFunc.get(func.id) || []
    const histFunc = histJornadasPorFunc.get(func.id) || []
    const manuaisFunc = lancamentosManuaisPorFunc.get(func.id) || []

    const espelho = construirEspelhoMensal({
      ano,
      mes,
      jornadaAtual: func.expand?.jornada_atual || null,
      historicoJornadas: histFunc,
      registrosMes: regFunc,
      tratamentosMes: tratFunc,
      ausenciasMes: ausFunc,
      feriasMes: ferFunc,
      feriados,
    })

    const extratoBH = construirExtratoFuncionario({
      ano,
      mes,
      diasEspelho: espelho.dias,
      lancamentosManuais: manuaisFunc,
    })

    const resumo = calcularResumoHorasExtras({
      ano,
      mes,
      diasEspelho: espelho.dias,
      extratoBancoHoras: extratoBH,
      salarioContratual: func.salario_contratual,
      isAdmin,
      hojeISO,
    })

    if (func.situacao !== 'desligado') {
      totalHEGeral += resumo.horasExtrasPeriodoMinutos
      totalVencidoGeral += resumo.creditoVencidoMinutos
      if (resumo.valorEstimadoPagar) {
        valorTotalGeral += resumo.valorEstimadoPagar
      }
      if (resumo.horasExtrasPeriodoMinutos > 0 || resumo.creditoVencidoMinutos > 0) {
        countComHE++
      }
    }

    listaFuncionarios.push({
      funcionario: func,
      matricula: func.matricula || '---',
      nome: func.nome,
      departamentoNome: func.expand?.departamento?.nome || 'Não definido',
      cargoNome: func.expand?.cargo?.nome || 'Não definido',
      jornadaNome: func.expand?.jornada_atual?.nome || 'Padrão CLT',
      situacao: func.situacao || 'ativo',
      horasExtrasPeriodoMinutos: resumo.horasExtrasPeriodoMinutos,
      horasExtrasPeriodoFormatado: resumo.horasExtrasPeriodoFormatado,
      creditoVencidoMinutos: resumo.creditoVencidoMinutos,
      creditoVencidoFormatado: resumo.creditoVencidoFormatado,
      salarioContratual: isAdmin ? func.salario_contratual : undefined,
      valorHora: resumo.valorHora,
      valorEstimadoPagar: resumo.valorEstimadoPagar,
      extrato: resumo.lancamentosCompletos,
    })
  }

  const totalAtivos = todosFuncionarios.filter((f) => f.situacao !== 'desligado').length

  return {
    ano,
    mes,
    isAdmin,
    funcionarios: listaFuncionarios,
    totalHorasExtrasMinutos: totalHEGeral,
    totalHorasExtrasFormatado: minutesToHoursText(totalHEGeral),
    totalCreditoVencidoMinutos: totalVencidoGeral,
    totalCreditoVencidoFormatado: minutesToHoursText(totalVencidoGeral),
    valorTotalEstimadoPagar: isAdmin ? Math.round(valorTotalGeral * 100) / 100 : undefined,
    totalFuncionariosAtivos: totalAtivos,
    totalFuncionariosComHE: countComHE,
  }
}

/**
 * Exporta o relatório consolidado de Horas Extras em formato CSV pt-BR (separador ';', BOM UTF-8).
 */
export function gerarCsvHorasExtras(
  relatorio: RelatorioHorasExtras,
  funcionarios: FuncionarioHorasExtras[],
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

  const isAdmin = relatorio.isAdmin

  const linhas: string[][] = [
    ['MH MIXX — AÇAÍ E FRUTAS CONGELADAS'],
    ['RELATÓRIO DE HORAS EXTRAS - CONSOLIDADO'],
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
    ['Total de Horas Extras do Período:', relatorio.totalHorasExtrasFormatado],
    ['Total de Créditos Vencidos (a pagar HE +50%):', relatorio.totalCreditoVencidoFormatado],
    ['Funcionários com Horas Extras:', String(relatorio.totalFuncionariosComHE)],
    ['Total de Funcionários Ativos:', String(relatorio.totalFuncionariosAtivos)],
  ]

  if (isAdmin && relatorio.valorTotalEstimadoPagar !== undefined) {
    linhas.push([
      'Total Estimado a Pagar (R$):',
      relatorio.valorTotalEstimadoPagar.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
    ])
  }

  linhas.push([])

  // Cabeçalho das colunas
  const cabecalho = [
    'Matrícula',
    'Colaborador',
    'Departamento',
    'Cargo',
    'Jornada',
    'Situação',
    'Horas Extras do Período',
    'Crédito Vencido a Pagar HE +50%',
  ]

  if (isAdmin) {
    cabecalho.push('Salário Contratual (R$)', 'Valor-Hora (R$)', 'Valor Estimado a Pagar (R$)')
  }

  linhas.push(cabecalho)

  for (const f of funcionarios) {
    const sitLabel =
      f.situacao === 'ativo'
        ? 'Ativo'
        : f.situacao === 'em_ferias'
          ? 'Em Férias'
          : f.situacao === 'afastado'
            ? 'Afastado'
            : 'Desligado'

    const linha = [
      f.matricula,
      f.nome,
      f.departamentoNome,
      f.cargoNome,
      f.jornadaNome,
      sitLabel,
      f.horasExtrasPeriodoFormatado,
      f.creditoVencidoFormatado,
    ]

    if (isAdmin) {
      linha.push(
        f.salarioContratual !== undefined
          ? f.salarioContratual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
          : '---',
        f.valorHora !== undefined
          ? f.valorHora.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
          : '---',
        f.valorEstimadoPagar !== undefined
          ? f.valorEstimadoPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
          : '0,00',
      )
    }

    linhas.push(linha)
  }

  return (
    '\uFEFF' +
    linhas
      .map((row) => row.map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n')
  )
}

/**
 * Exporta o extrato individual de Horas Extras de um funcionário em formato CSV pt-BR.
 */
export function gerarCsvExtratoIndividual(
  funcionario: FuncionarioHorasExtras,
  ano: number,
  mes: number,
  isAdmin: boolean,
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
    ['EXTRATO INDIVIDUAL DE HORAS EXTRAS'],
    ['Colaborador:', `${funcionario.nome} (Matrícula: ${funcionario.matricula})`],
    ['Departamento:', funcionario.departamentoNome],
    ['Cargo:', funcionario.cargoNome],
    ['Competência:', `${MESES[mes - 1]}/${ano}`],
    [
      'Data de Emissão:',
      new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(new Date()),
    ],
    [],
    ['RESUMO DO COLABORADOR'],
    ['Horas Extras do Período:', funcionario.horasExtrasPeriodoFormatado],
    ['Créditos Vencidos (a pagar HE +50%):', funcionario.creditoVencidoFormatado],
  ]

  if (isAdmin && funcionario.valorEstimadoPagar !== undefined) {
    linhas.push([
      'Valor Estimado a Pagar (R$):',
      funcionario.valorEstimadoPagar.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
    ])
  }

  linhas.push([])

  const cabecalho = [
    'Data (DD/MM/AAAA)',
    'Origem',
    'Descrição',
    'Horas',
    'Status',
    'Data-Limite Compensação',
  ]

  if (isAdmin) {
    cabecalho.push('Valor Estimado (R$)')
  }

  linhas.push(cabecalho)

  for (const item of funcionario.extrato) {
    const dataPartes = item.data.split('-')
    const dataBR =
      dataPartes.length === 3 ? `${dataPartes[2]}/${dataPartes[1]}/${dataPartes[0]}` : item.data

    const dataLimiteBR = item.dataLimiteCompensacao
      ? (() => {
          const p = item.dataLimiteCompensacao.split('-')
          return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : item.dataLimiteCompensacao
        })()
      : '---'

    const linha = [
      dataBR,
      item.origemLabel,
      item.descricao,
      item.horasFormatadas,
      item.vencido ? 'Vencido (HE +50%)' : 'No Período',
      dataLimiteBR,
    ]

    if (isAdmin) {
      linha.push(
        item.valorEstimado !== undefined
          ? item.valorEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
          : '---',
      )
    }

    linhas.push(linha)
  }

  return (
    '\uFEFF' +
    linhas
      .map((row) => row.map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n')
  )
}
