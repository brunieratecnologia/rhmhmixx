import type { Ferias, Ausencia } from '@/types/rh'

export interface PeriodoAquisitivoCalculado {
  indice: number
  inicio: string // YYYY-MM-DD
  fim: string // YYYY-MM-DD
  limiteConcessivo: string // YYYY-MM-DD (fim do aquisitivo + 12 meses - 1 dia)
  diasDireitoBase: number // 30 por padrão CLT
  faltasInjustificadas: number // faltas registradas no período
  diasDireitoAposFaltas: number // conforme art. 130 CLT
  diasGozados: number // soma de dias em férias concluídas ou em gozo deste período
  diasAbono: number // dias vendidos
  diasProgramados: number // dias em férias programadas
  saldoRemanescente: number // diasDireitoAposFaltas - (diasGozados + diasAbono + diasProgramados)
  situacao: 'em_aquisicao' | 'aquisitivo_completo' | 'vencido' | 'quitado'
  diasParaVencerConcessivo: number // dias até limiteConcessivo
  alertaVencimento: 'normal' | 'alerta_60' | 'alerta_30' | 'urgente_15' | 'vencido'
}

/**
 * Tabela de proporcionalidade do art. 130 da CLT
 * Até 5 faltas injustificadas: 30 dias de férias
 * De 6 a 14 faltas: 24 dias de férias
 * De 15 a 23 faltas: 18 dias de férias
 * De 24 a 32 faltas: 12 dias de férias
 * Acima de 32 faltas: 0 dias
 */
export function calcularDiasDireitoCLT(faltasInjustificadas: number): number {
  if (faltasInjustificadas <= 5) return 30
  if (faltasInjustificadas <= 14) return 24
  if (faltasInjustificadas <= 23) return 18
  if (faltasInjustificadas <= 32) return 12
  return 0
}

/**
 * Adiciona anos a uma data no formato YYYY-MM-DD mantendo consistência de calendário
 */
function addYears(dateStr: string, years: number): Date {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
  const dt = new Date(Date.UTC(y + years, m - 1, d))
  return dt
}

function formatDateISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

function subtractDays(d: Date, days: number): Date {
  const copy = new Date(d.getTime())
  copy.setUTCDate(copy.getUTCDate() - days)
  return copy
}

/**
 * Calcula a diferença em dias corridos entre duas datas no formato YYYY-MM-DD (inclusive)
 */
export function calcularDiasEntreDatas(dataInicio: string, dataFim: string): number {
  if (!dataInicio || !dataFim) return 0
  const d1 = new Date(dataInicio.split('T')[0] + 'T00:00:00Z')
  const d2 = new Date(dataFim.split('T')[0] + 'T00:00:00Z')
  const diffTime = d2.getTime() - d1.getTime()
  if (diffTime < 0) return 0
  return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1
}

/**
 * Calcula todos os períodos aquisitivos e concessivos de um colaborador a partir da admissão
 */
export function calcularPeriodosColaborador(params: {
  dataAdmissao: string
  feriasCadastradas: Ferias[]
  ausencias: Ausencia[]
  dataReferencia?: string // defaults to today (America/Sao_Paulo)
}): {
  periodos: PeriodoAquisitivoCalculado[]
  saldoTotalDisponivel: number
  diasEmGozoHoje: number
  proximasFerias: Ferias | null
  temAlertaConcessivo: boolean
} {
  const { dataAdmissao, feriasCadastradas, ausencias } = params
  if (!dataAdmissao) {
    return {
      periodos: [],
      saldoTotalDisponivel: 0,
      diasEmGozoHoje: 0,
      proximasFerias: null,
      temAlertaConcessivo: false,
    }
  }

  const hojeStr =
    params.dataReferencia ||
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())

  const hoje = new Date(hojeStr + 'T00:00:00Z')
  const adm = new Date(dataAdmissao.split('T')[0] + 'T00:00:00Z')

  // Determina quantos ciclos de 12 meses já se iniciaram até hoje
  const periodos: PeriodoAquisitivoCalculado[] = []
  let indice = 1

  // Geramos ciclos até cobrir o período atual em aquisição (mais 1 ciclo além da data atual)
  while (true) {
    const inicioAquisitivoDate = addYears(dataAdmissao, indice - 1)
    const fimAquisitivoDate = subtractDays(addYears(dataAdmissao, indice), 1)
    const limiteConcessivoDate = subtractDays(addYears(dataAdmissao, indice + 1), 1)

    const inicioStr = formatDateISO(inicioAquisitivoDate)
    const fimStr = formatDateISO(fimAquisitivoDate)
    const limiteConcessivoStr = formatDateISO(limiteConcessivoDate)

    // Se o início do aquisitivo for no futuro distante (> hoje), paramos
    if (inicioAquisitivoDate.getTime() > hoje.getTime() && indice > 1) {
      break
    }

    // Calcula faltas injustificadas registradas durante este período aquisitivo
    const faltasNoPeriodo = ausencias.filter((a) => {
      const aData = a.data_inicio ? a.data_inicio.split('T')[0] : ''
      const ehFaltaInjustificada =
        (a.categoria === 'falta' && a.situacao === 'nao_justificada') ||
        (a.categoria === 'falta' && a.situacao === 'informada') ||
        Boolean(a.impacta_aquisitivo)
      return aData >= inicioStr && aData <= fimStr && ehFaltaInjustificada
    })

    // Quantidade de dias de falta somando o período de ausência
    let totalDiasFaltas = 0
    for (const f of faltasNoPeriodo) {
      const fFim = f.data_fim ? f.data_fim.split('T')[0] : f.data_inicio.split('T')[0]
      totalDiasFaltas += calcularDiasEntreDatas(f.data_inicio, fFim)
    }

    const diasDireitoAposFaltas = calcularDiasDireitoCLT(totalDiasFaltas)

    // Busca férias vinculadas especificamente a este período ou ordenadas
    const feriasDestePeriodo = feriasCadastradas.filter((f) => {
      if (f.status === 'cancelada') return false
      // Se tiver periodo_aquisitivo_inicio explicitamente informado
      if (f.periodo_aquisitivo_inicio) {
        return f.periodo_aquisitivo_inicio.split('T')[0] === inicioStr
      }
      // Ou se o início das férias recai durante ou após o fim aquisitivo
      const fInicio = f.data_inicio.split('T')[0]
      return fInicio >= fimStr && fInicio <= limiteConcessivoStr
    })

    let diasGozados = 0
    let diasAbono = 0
    let diasProgramados = 0

    for (const fer of feriasDestePeriodo) {
      const d = fer.dias || calcularDiasEntreDatas(fer.data_inicio, fer.data_fim)
      const abono = fer.dias_abono || 0
      diasAbono += abono

      if (fer.status === 'concluida' || fer.status === 'em_gozo') {
        diasGozados += d
      } else if (
        fer.status === 'programada' ||
        fer.status === 'aprovado' ||
        fer.status === 'solicitado'
      ) {
        diasProgramados += d
      }
    }

    const saldoRemanescente = Math.max(
      0,
      diasDireitoAposFaltas - (diasGozados + diasAbono + diasProgramados),
    )

    // Cálculo da proximidade do vencimento concessivo
    const diffMillisConcessivo = limiteConcessivoDate.getTime() - hoje.getTime()
    const diasParaVencerConcessivo = Math.ceil(diffMillisConcessivo / (1000 * 60 * 60 * 24))

    let situacao: PeriodoAquisitivoCalculado['situacao'] = 'aquisitivo_completo'
    if (hoje.getTime() < fimAquisitivoDate.getTime()) {
      situacao = 'em_aquisicao'
    } else if (saldoRemanescente === 0 && (diasGozados > 0 || diasAbono > 0)) {
      situacao = 'quitado'
    } else if (diasParaVencerConcessivo < 0) {
      situacao = 'vencido'
    }

    let alertaVencimento: PeriodoAquisitivoCalculado['alertaVencimento'] = 'normal'
    if (situacao !== 'em_aquisicao' && situacao !== 'quitado') {
      if (diasParaVencerConcessivo < 0) {
        alertaVencimento = 'vencido'
      } else if (diasParaVencerConcessivo <= 15) {
        alertaVencimento = 'urgente_15'
      } else if (diasParaVencerConcessivo <= 30) {
        alertaVencimento = 'alerta_30'
      } else if (diasParaVencerConcessivo <= 60) {
        alertaVencimento = 'alerta_60'
      }
    }

    periodos.push({
      indice,
      inicio: inicioStr,
      fim: fimStr,
      limiteConcessivo: limiteConcessivoStr,
      diasDireitoBase: 30,
      faltasInjustificadas: totalDiasFaltas,
      diasDireitoAposFaltas,
      diasGozados,
      diasAbono,
      diasProgramados,
      saldoRemanescente,
      situacao,
      diasParaVencerConcessivo,
      alertaVencimento,
    })

    // Se este já é o período em aquisição, podemos parar após calculá-lo
    if (situacao === 'em_aquisicao') {
      break
    }

    indice++
    // Salvaguarda contra loops infinitos
    if (indice > 50) break
  }

  // Soma saldos disponíveis de períodos já adquiridos
  const saldoTotalDisponivel = periodos
    .filter((p) => p.situacao !== 'em_aquisicao')
    .reduce((acc, p) => acc + p.saldoRemanescente, 0)

  // Verifica se está em gozo hoje
  const feriasEmGozo = feriasCadastradas.find((f) => {
    if (f.status === 'cancelada') return false
    const ini = f.data_inicio.split('T')[0]
    const fim = f.data_fim.split('T')[0]
    return hojeStr >= ini && hojeStr <= fim
  })

  // Próximas férias programadas
  const futuras = feriasCadastradas
    .filter((f) => {
      if (f.status === 'cancelada') return false
      const ini = f.data_inicio.split('T')[0]
      return ini >= hojeStr
    })
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))

  const temAlertaConcessivo = periodos.some(
    (p) =>
      p.alertaVencimento === 'urgente_15' ||
      p.alertaVencimento === 'alerta_30' ||
      p.alertaVencimento === 'alerta_60' ||
      p.alertaVencimento === 'vencido',
  )

  return {
    periodos,
    saldoTotalDisponivel,
    diasEmGozoHoje: feriasEmGozo ? feriasEmGozo.dias || 0 : 0,
    proximasFerias: futuras.length > 0 ? futuras[0] : null,
    temAlertaConcessivo,
  }
}

/**
 * Validação de Fracionamento e regras da Reforma Trabalhista (art. 134 CLT):
 * - Fracionamento em até 3 períodos
 * - Pelo menos um período não menor que 14 dias
 * - Demais períodos não menores que 5 dias cada
 * - Abono pecuniário no máximo 1/3 (10 dias)
 * - Retorna avisos/erros mas permite salvar com justificativa do RH
 */
export function validarRegrasFerias(params: {
  dataInicio: string
  dataFim: string
  diasAbono?: number
  saldoDisponivel: number
  feriasExistentesMesmoPeriodo: Ferias[]
  periodoAquisitivo?: PeriodoAquisitivoCalculado
}): {
  valido: boolean
  erros: string[]
  avisos: string[]
  diasCalculados: number
  permiteComJustificativa: boolean
} {
  const {
    dataInicio,
    dataFim,
    diasAbono = 0,
    saldoDisponivel,
    feriasExistentesMesmoPeriodo,
    periodoAquisitivo,
  } = params

  const erros: string[] = []
  const avisos: string[] = []

  if (!dataInicio || !dataFim) {
    erros.push('Datas de início e fim são obrigatórias.')
    return {
      valido: false,
      erros,
      avisos,
      diasCalculados: 0,
      permiteComJustificativa: false,
    }
  }

  const iniStr = dataInicio.split('T')[0]
  const fimStr = dataFim.split('T')[0]

  if (iniStr > fimStr) {
    erros.push('A data de início deve ser anterior ou igual à data de fim.')
    return {
      valido: false,
      erros,
      avisos,
      diasCalculados: 0,
      permiteComJustificativa: false,
    }
  }

  const diasCalculados = calcularDiasEntreDatas(iniStr, fimStr)

  if (diasCalculados <= 0) {
    erros.push('A quantidade de dias deve ser maior que zero.')
    return {
      valido: false,
      erros,
      avisos,
      diasCalculados,
      permiteComJustificativa: false,
    }
  }

  // 1. Verificação de sobreposição com outras férias cadastradas
  for (const f of feriasExistentesMesmoPeriodo) {
    if (f.status === 'cancelada') continue
    const fIni = f.data_inicio.split('T')[0]
    const fFim = f.data_fim.split('T')[0]
    // Sobreposição ocorre se ini <= fFim && fim >= fIni
    if (iniStr <= fFim && fimStr >= fIni) {
      erros.push(
        `Existe sobreposição com período já cadastrado (${fIni.split('-').reverse().join('/')} a ${fFim.split('-').reverse().join('/')}).`,
      )
    }
  }

  // 2. Abono pecuniário máximo de 10 dias (1/3 de 30 dias conforme CLT)
  if (diasAbono > 10) {
    erros.push(
      'O abono pecuniário máximo permitido por lei é de 10 dias (1/3 do direito de férias).',
    )
  }

  const totalDemandado = diasCalculados + diasAbono

  // 3. Saldo insuficiente
  if (totalDemandado > saldoDisponivel) {
    avisos.push(
      `O total demandado (${totalDemandado} dias: ${diasCalculados} de descanso + ${diasAbono} de abono) excede o saldo remanescente disponível (${saldoDisponivel} dias). Justificativa do RH é requerida.`,
    )
  }

  // 4. Regras da CLT sobre fracionamento (art. 134, §1º):
  // "Desde que haja concordância do empregado, as férias poderão ser usufruídas em até três períodos,
  // sendo que um deles não poderá ser inferior a 14 dias corridos e os demais não poderão ser inferiores a 5 dias corridos cada um."
  if (diasCalculados < 5) {
    avisos.push(
      'Atenção CLT: Nenhum período de férias fracionadas pode ser inferior a 5 dias corridos (art. 134, §1º CLT). Decisão do RH deve ser justificada.',
    )
  }

  // Se fracionadas, checar contagem de períodos no mesmo aquisitivo
  const periodosJaMarcados = feriasExistentesMesmoPeriodo.filter((f) => f.status !== 'cancelada')
  if (periodosJaMarcados.length >= 3) {
    avisos.push(
      'Atenção CLT: A legislação prevê fracionamento em no máximo 3 períodos para o mesmo período aquisitivo.',
    )
  }

  // Verificar se o período concessivo já está expirado ou se este gozo ultrapassará o concessivo
  if (periodoAquisitivo) {
    if (fimStr > periodoAquisitivo.limiteConcessivo) {
      avisos.push(
        `Atenção: O término destas férias (${fimStr.split('-').reverse().join('/')}) ultrapassa o limite concessivo legal (${periodoAquisitivo.limiteConcessivo.split('-').reverse().join('/')}).`,
      )
    }
  }

  const valido = erros.length === 0

  return {
    valido,
    erros,
    avisos,
    diasCalculados,
    permiteComJustificativa: erros.length === 0,
  }
}
