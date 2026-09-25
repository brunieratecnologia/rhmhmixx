import type { Jornada, RegistroHorario, TratamentoPonto, Ausencia, Ferias } from '@/types/rh'

export interface MarcacaoInterpreta {
  id?: string
  horario: string // HH:MM
  tipo: 'entrada' | 'inicio_intervalo' | 'retorno_intervalo' | 'saida' | 'avulsa'
  origem: 'terminal' | 'tratamento_fechamento' | 'admin'
  registroOriginal?: RegistroHorario
  tratamento?: TratamentoPonto
}

export interface DiaEspelhoCalculado {
  data: string // YYYY-MM-DD
  diaSemana: string // seg, ter, etc.
  diaSemanaLabel: string // Seg, Ter, etc.
  diaNumero: number // 1 a 31
  jornadaPrevista: Jornada | null
  previstoMinutos: number
  previstoFormatado: string // Ex: "08:00" ou "Folga"
  ehDiaFolga: boolean
  ehFeriado: boolean
  feriadoDescricao?: string
  marcacoesOriginais: RegistroHorario[]
  tratamentosDoDia: TratamentoPonto[]
  todasMarcacoes: MarcacaoInterpreta[]
  realizadoMinutos: number
  realizadoFormatado: string // Ex: "08:12"
  diferencaMinutos: number // realizado - previsto
  diferencaFormatada: string // Ex: "+00:12" ou "-00:45" ou "00:00"
  ocorrencias: {
    tipo:
      | 'marcacao_incompleta'
      | 'ausencia'
      | 'atestado'
      | 'ferias'
      | 'atraso'
      | 'extra'
      | 'folga_trabalhada'
      | 'info'
    descricao: string
    severidade: 'baixo' | 'atencao' | 'alerta'
    justificado?: boolean
    atestadoId?: string
    atestadoNome?: string
    atestadoArquivo?: string
  }[]
  temAtestado: boolean
  temFerias: boolean
  temAusencia: boolean
}

export interface ResumoEspelhoMensal {
  totalDiasNoMes: number
  totalDiasTrabalhados: number
  totalDiasFolga: number
  previstoTotalMinutos: number
  realizadoTotalMinutos: number
  saldoTotalMinutos: number // realizado - previsto
  horasExtrasMinutos: number // soma das diferenças positivas dos dias de trabalho
  horasFaltasMinutos: number // soma das diferenças negativas dos dias de trabalho
  totalOcorrencias: number
  totalMarcacoesIncompletas: number
  totalAtestados: number
}

/**
 * Converte string de horário "HH:MM" ou "HH:MM:SS" em minutos a partir de 00:00
 */
export function timeStringToMinutes(timeStr?: string | null): number {
  if (!timeStr) return 0
  const clean = timeStr.trim().slice(0, 5)
  const [h, m] = clean.split(':').map((v) => parseInt(v, 10))
  if (isNaN(h) || isNaN(m)) return 0
  return h * 60 + m
}

/**
 * Converte minutos para string formatada "HH:MM"
 */
export function minutesToTimeString(minutes: number): string {
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const padH = String(h).padStart(2, '0')
  const padM = String(m).padStart(2, '0')
  return `${padH}:${padM}`
}

/**
 * Converte minutos com sinal para exibição (+HH:MM, -HH:MM, 00:00)
 */
export function minutesToSignedString(minutes: number): string {
  if (minutes === 0) return '00:00'
  const sign = minutes > 0 ? '+' : '-'
  return `${sign}${minutesToTimeString(minutes)}`
}

/**
 * Converte minutos em formato decimal ("8,5h" ou "8h 30m")
 */
export function minutesToHoursText(minutes: number): string {
  const sign = minutes < 0 ? '-' : ''
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  if (m === 0) return `${sign}${h}h`
  return `${sign}${h}h ${m}m`
}

/**
 * Retorna o dia da semana no formato de 3 letras utilizado pelo sistema ('seg', 'ter', etc.)
 */
export function getDiaSemanaSigla(
  dateStr: string,
): 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom' {
  // Use noon to avoid timezone border shifts
  const d = new Date(dateStr + 'T12:00:00Z')
  const day = d.getUTCDay()
  const map: ('dom' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab')[] = [
    'dom',
    'seg',
    'ter',
    'qua',
    'qui',
    'sex',
    'sab',
  ]
  return map[day]
}

export function getDiaSemanaLabel(sigla: string): string {
  const map: Record<string, string> = {
    seg: 'Segunda',
    ter: 'Terça',
    qua: 'Quarta',
    qui: 'Quinta',
    sex: 'Sexta',
    sab: 'Sábado',
    dom: 'Domingo',
  }
  return map[sigla] || sigla
}

/**
 * Calcula a duração prevista da jornada diária em minutos.
 * Suporta jornadas que ultrapassam a meia-noite (ex.: 22:00 às 06:00).
 */
export function calcularPrevistoJornada(jornada: Jornada | null, diaSigla: string): number {
  if (!jornada) return 0

  // Se o dia está na lista de folgas ou não está na lista de trabalho
  const ehFolga = jornada.dias_folga?.includes(diaSigla as any)
  const ehTrabalho = jornada.dias_trabalho?.includes(diaSigla as any)
  if (ehFolga || !ehTrabalho) return 0

  if (jornada.duracao_jornada_min && jornada.duracao_jornada_min > 0) {
    return jornada.duracao_jornada_min
  }

  const ent = timeStringToMinutes(jornada.hora_entrada)
  let sai = timeStringToMinutes(jornada.hora_saida)
  const intIni = timeStringToMinutes(jornada.hora_inicio_intervalo)
  let intFim = timeStringToMinutes(jornada.hora_retorno_intervalo)

  if (!jornada.hora_entrada || !jornada.hora_saida) return 0

  // Tratamento de jornada que atravessa a meia-noite
  if (sai < ent || jornada.atravessa_meia_noite) {
    sai += 24 * 60
  }

  let total = sai - ent

  // Desconta intervalo se configurado
  if (jornada.hora_inicio_intervalo && jornada.hora_retorno_intervalo) {
    if (intFim < intIni) {
      intFim += 24 * 60
    }
    const interv = intFim - intIni
    if (interv > 0) {
      total -= interv
    }
  }

  return Math.max(0, total)
}

/**
 * Extrai o horário no fuso America/Sao_Paulo (HH:MM) a partir de um ISO timestamp UTC
 */
export function getSPTimeFromUtc(utcIso: string): string {
  try {
    const d = new Date(utcIso)
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
  } catch {
    return utcIso.slice(11, 16)
  }
}

/**
 * Extrai a data no fuso America/Sao_Paulo (YYYY-MM-DD) a partir de um ISO timestamp UTC
 */
export function getSPDateFromUtc(utcIso: string): string {
  try {
    const d = new Date(utcIso)
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  } catch {
    return utcIso.slice(0, 10)
  }
}

/**
 * Combina marcações originais do terminal com os tratamentos complementares do fechamento
 * na ordem cronológica e interpreta a sequência:
 * [Entrada 1, Saída Intervalo, Retorno Intervalo, Saída Final, ...]
 *
 * Suporta marcações que passam da meia-noite quando a jornada for noturna.
 */
export function calcularHorasRealizadas(
  marcacoesOriginais: RegistroHorario[],
  tratamentosDoDia: TratamentoPonto[],
  jornada: Jornada | null,
): {
  minutosTrabalhados: number
  todasMarcacoes: MarcacaoInterpreta[]
  isIncompleto: boolean
} {
  const lista: MarcacaoInterpreta[] = []

  // 1. Marcações originais
  for (const reg of marcacoesOriginais) {
    const horario = reg.timestamp_utc
      ? getSPTimeFromUtc(reg.timestamp_utc)
      : reg.hora_utc.slice(0, 5)
    lista.push({
      id: reg.id,
      horario,
      tipo: 'avulsa',
      origem: 'terminal',
      registroOriginal: reg,
    })
  }

  // 2. Marcações adicionadas em tratamentos de fechamento
  for (const trat of tratamentosDoDia) {
    if (trat.hora_registro) {
      lista.push({
        id: trat.id,
        horario: trat.hora_registro.slice(0, 5),
        tipo: (trat.tipo_marcacao as any) || 'avulsa',
        origem: 'tratamento_fechamento',
        tratamento: trat,
      })
    }
  }

  // Ordena cronologicamente por horário
  lista.sort((a, b) => {
    return timeStringToMinutes(a.horario) - timeStringToMinutes(b.horario)
  })

  // Interpreta tipos sequencialmente se não tiverem tipo explícito do fechamento
  const tiposOrdem: ('entrada' | 'inicio_intervalo' | 'retorno_intervalo' | 'saida')[] = [
    'entrada',
    'inicio_intervalo',
    'retorno_intervalo',
    'saida',
  ]

  lista.forEach((item, idx) => {
    if (item.tipo === 'avulsa') {
      item.tipo = tiposOrdem[idx % tiposOrdem.length]
    }
  })

  // Cálculo de minutos trabalhados por pares de entrada/saída:
  // Par 1: lista[0] a lista[1] (ou saída do primeiro bloco)
  // Par 2: lista[2] a lista[3]
  // Se houver número ímpar, a última fica em aberto (marcação incompleta)
  let minutosTrabalhados = 0
  const ehNoturno = Boolean(jornada?.atravessa_meia_noite)

  for (let i = 0; i < lista.length - 1; i += 2) {
    const tInicio = timeStringToMinutes(lista[i].horario)
    let tFim = timeStringToMinutes(lista[i + 1].horario)

    if (tFim < tInicio || (ehNoturno && i === 0 && tFim < tInicio)) {
      tFim += 24 * 60
    }

    const diff = tFim - tInicio
    if (diff > 0) {
      minutosTrabalhados += diff
    }
  }

  const isIncompleto = lista.length % 2 !== 0

  return {
    minutosTrabalhados,
    todasMarcacoes: lista,
    isIncompleto,
  }
}

/**
 * Constrói o Espelho de Ponto completo de um funcionário para uma dada competência (ano/mês)
 */
export function construirEspelhoMensal(params: {
  ano: number
  mes: number // 1 a 12
  jornadaAtual: Jornada | null
  historicoJornadas: { data_inicio: string; data_fim?: string; jornada: Jornada }[]
  registrosMes: RegistroHorario[]
  tratamentosMes: TratamentoPonto[]
  ausenciasMes: Ausencia[]
  feriasMes: Ferias[]
}): {
  dias: DiaEspelhoCalculado[]
  resumo: ResumoEspelhoMensal
} {
  const {
    ano,
    mes,
    jornadaAtual,
    historicoJornadas,
    registrosMes,
    tratamentosMes,
    ausenciasMes,
    feriasMes,
  } = params

  // Determina número de dias no mês
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const dias: DiaEspelhoCalculado[] = []

  // Agrupa registros por data no Brasil (YYYY-MM-DD)
  const registrosPorDia = new Map<string, RegistroHorario[]>()
  for (const reg of registrosMes) {
    const dataKey = reg.timestamp_utc ? getSPDateFromUtc(reg.timestamp_utc) : reg.data_utc
    if (!registrosPorDia.has(dataKey)) {
      registrosPorDia.set(dataKey, [])
    }
    registrosPorDia.get(dataKey)!.push(reg)
  }

  // Agrupa tratamentos por data (YYYY-MM-DD)
  const tratamentosPorDia = new Map<string, TratamentoPonto[]>()
  for (const trat of tratamentosMes) {
    const dataKey = trat.data_registro || trat.data_tratamento?.slice(0, 10)
    if (dataKey) {
      if (!tratamentosPorDia.has(dataKey)) {
        tratamentosPorDia.set(dataKey, [])
      }
      tratamentosPorDia.get(dataKey)!.push(trat)
    }
  }

  let totalDiasTrabalhados = 0
  let totalDiasFolga = 0
  let previstoTotalMinutos = 0
  let realizadoTotalMinutos = 0
  let horasExtrasMinutos = 0
  let horasFaltasMinutos = 0
  let totalOcorrencias = 0
  let totalMarcacoesIncompletas = 0
  let totalAtestados = 0

  for (let dia = 1; dia <= ultimoDia; dia++) {
    const padDia = String(dia).padStart(2, '0')
    const padMes = String(mes).padStart(2, '0')
    const dataStr = `${ano}-${padMes}-${padDia}`
    const diaSigla = getDiaSemanaSigla(dataStr)
    const diaSemanaLabel = getDiaSemanaLabel(diaSigla)

    // Resolve qual jornada estava vigente nesta data específica
    let jornadaVigente: Jornada | null = jornadaAtual
    if (historicoJornadas && historicoJornadas.length > 0) {
      // Find history entry covering this date
      const match = historicoJornadas.find((h) => {
        const ini = h.data_inicio ? h.data_inicio.slice(0, 10) : ''
        const fim = h.data_fim ? h.data_fim.slice(0, 10) : '9999-12-31'
        return dataStr >= ini && dataStr <= fim
      })
      if (match && match.jornada) {
        jornadaVigente = match.jornada
      }
    }

    const previstoMin = calcularPrevistoJornada(jornadaVigente, diaSigla)
    const ehDiaFolga = previstoMin === 0

    if (ehDiaFolga) {
      totalDiasFolga++
    }

    // Registros e tratamentos do dia
    const regsDoDia = registrosPorDia.get(dataStr) || []
    const tratamentosDoDia = tratamentosPorDia.get(dataStr) || []

    // Calcula realizado
    const { minutosTrabalhados, todasMarcacoes, isIncompleto } = calcularHorasRealizadas(
      regsDoDia,
      tratamentosDoDia,
      jornadaVigente,
    )

    if (minutosTrabalhados > 0) {
      totalDiasTrabalhados++
    }

    const diferencaMinutos = minutosTrabalhados - previstoMin
    previstoTotalMinutos += previstoMin
    realizadoTotalMinutos += minutosTrabalhados

    if (diferencaMinutos > 0) {
      horasExtrasMinutos += diferencaMinutos
    } else if (diferencaMinutos < 0 && !ehDiaFolga) {
      horasFaltasMinutos += Math.abs(diferencaMinutos)
    }

    // Detectar Férias neste dia
    const feriasMatch = feriasMes.find((f) => {
      const ini = f.data_inicio ? f.data_inicio.slice(0, 10) : ''
      const fim = f.data_fim ? f.data_fim.slice(0, 10) : ''
      return dataStr >= ini && dataStr <= fim
    })

    // Detectar Ausências neste dia
    const ausenciaMatch = ausenciasMes.find((a) => {
      const ini = a.data_inicio ? a.data_inicio.slice(0, 10) : ''
      const fim = a.data_fim ? a.data_fim.slice(0, 10) : ini
      return dataStr >= ini && dataStr <= fim
    })

    const ocorrencias: DiaEspelhoCalculado['ocorrencias'] = []

    if (isIncompleto) {
      totalMarcacoesIncompletas++
      totalOcorrencias++
      ocorrencias.push({
        tipo: 'marcacao_incompleta',
        descricao: 'Marcação ímpar/incompleta (falta batida de saída ou retorno)',
        severidade: 'atencao',
      })
    }

    if (feriasMatch) {
      ocorrencias.push({
        tipo: 'ferias',
        descricao: 'Em período de férias',
        severidade: 'baixo',
        justificado: true,
      })
    }

    if (ausenciaMatch) {
      totalOcorrencias++
      const ehAtestado = ausenciaMatch.categoria === 'atestado'
      const ehAbonada = ausenciaMatch.situacao === 'abonada'
      const ehJustificada = ausenciaMatch.situacao === 'justificada' || ehAtestado
      if (ehAtestado) {
        totalAtestados++
      }

      const docExpand = (ausenciaMatch as any).expand?.documentos
      ocorrencias.push({
        tipo: ehAtestado ? 'atestado' : 'ausencia',
        descricao: `${ehAtestado ? 'Atestado médico' : `Ausência (${ausenciaMatch.categoria.replace('_', ' ')})`}: ${ausenciaMatch.justificativa || 'Registrada'}`,
        severidade: ehAbonada || ehAtestado ? 'baixo' : ehJustificada ? 'atencao' : 'alerta',
        justificado: ehJustificada || ehAbonada,
        atestadoId: docExpand?.id,
        atestadoNome: docExpand?.nome,
        atestadoArquivo: docExpand?.arquivo,
      })
    }

    // Se é dia de trabalho, sem ausência/férias e sem nenhuma batida:
    const hojeStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())

    const ehPassado = dataStr <= hojeStr

    if (!ehDiaFolga && todasMarcacoes.length === 0 && !feriasMatch && !ausenciaMatch && ehPassado) {
      totalOcorrencias++
      ocorrencias.push({
        tipo: 'ausencia',
        descricao: 'Sem marcações registradas no dia de trabalho previsto',
        severidade: 'alerta',
      })
    }

    if (ehDiaFolga && minutosTrabalhados > 0) {
      totalOcorrencias++
      ocorrencias.push({
        tipo: 'folga_trabalhada',
        descricao: 'Trabalho em dia de folga / descanso semanal remunerado',
        severidade: 'atencao',
      })
    }

    dias.push({
      data: dataStr,
      diaSemana: diaSigla,
      diaSemanaLabel,
      diaNumero: dia,
      jornadaPrevista: jornadaVigente,
      previstoMinutos: previstoMin,
      previstoFormatado: ehDiaFolga ? 'Folga' : minutesToTimeString(previstoMin),
      ehDiaFolga,
      ehFeriado: false,
      marcacoesOriginais: regsDoDia,
      tratamentosDoDia,
      todasMarcacoes,
      realizadoMinutos: minutosTrabalhados,
      realizadoFormatado: minutesToTimeString(minutosTrabalhados),
      diferencaMinutos,
      diferencaFormatada: minutesToSignedString(diferencaMinutos),
      ocorrencias,
      temAtestado: Boolean(ausenciaMatch && ausenciaMatch.categoria === 'atestado'),
      temFerias: Boolean(feriasMatch),
      temAusencia: Boolean(ausenciaMatch),
    })
  }

  const resumo: ResumoEspelhoMensal = {
    totalDiasNoMes: ultimoDia,
    totalDiasTrabalhados,
    totalDiasFolga,
    previstoTotalMinutos,
    realizadoTotalMinutos,
    saldoTotalMinutos: realizadoTotalMinutos - previstoTotalMinutos,
    horasExtrasMinutos,
    horasFaltasMinutos,
    totalOcorrencias,
    totalMarcacoesIncompletas,
    totalAtestados,
  }

  return { dias, resumo }
}
