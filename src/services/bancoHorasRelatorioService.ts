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
  BancoHorasLancamento,
  RegistroHorario,
  TratamentoPonto,
  Ausencia,
  Ferias,
  HistoricoJornada,
  Jornada,
} from '@/types/rh'
import pb from '@/lib/pocketbase/client'

export interface ExtratoItemBancoHoras {
  id: string
  data: string // YYYY-MM-DD
  tipo: 'credito' | 'debito'
  minutos: number
  horasFormatadas: string
  origem:
    | 'trabalho_pos_saida'
    | 'dia_folga'
    | 'ajuste_admin'
    | 'atraso_tolerancia'
    | 'falta_injustificada'
  origemLabel: string
  descricao: string
  saldoAcumuladoMinutos?: number
  saldoAcumuladoFormatado?: string
  responsavelNome?: string
  atrasoOcorrencia?: string
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
    // Crédito pós-saída ou dia de folga
    if (dia.horasBancoCreditoMinutos > 0) {
      const ehFolga = dia.ehDiaFolga
      itens.push({
        id: `espelho-cred-${dia.data}`,
        data: dia.data,
        tipo: 'credito',
        minutos: dia.horasBancoCreditoMinutos,
        horasFormatadas: `+${minutesToTimeString(dia.horasBancoCreditoMinutos)}`,
        origem: ehFolga ? 'dia_folga' : 'trabalho_pos_saida',
        origemLabel: ehFolga ? 'Dia de folga / DSR' : 'Trabalho após saída prevista',
        descricao: ehFolga
          ? `Trabalho integral em dia de folga (${minutesToHoursText(dia.horasBancoCreditoMinutos)})`
          : `Crédito por horas trabalhadas após o horário previsto (${dia.horarioPrevistoFormatado})`,
      })
    }

    // Débitos ou atrasos
    if (dia.horasBancoDebitoMinutos > 0) {
      const ehAtraso = dia.atrasoMinutos > 0
      const descrAtraso = dia.ocorrencias.find((o) => o.tipo === 'atraso')?.descricao
      const descrAusencia = dia.ocorrencias.find((o) => o.tipo === 'ausencia')?.descricao

      itens.push({
        id: `espelho-deb-${dia.data}`,
        data: dia.data,
        tipo: 'debito',
        minutos: dia.horasBancoDebitoMinutos,
        horasFormatadas: `-${minutesToTimeString(dia.horasBancoDebitoMinutos)}`,
        origem: ehAtraso ? 'atraso_tolerancia' : 'falta_injustificada',
        origemLabel: ehAtraso ? 'Atraso excedente (>10m)' : 'Ausência sem marcação',
        descricao:
          descrAtraso ||
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
