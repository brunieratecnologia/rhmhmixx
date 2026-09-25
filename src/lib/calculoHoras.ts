import type {
  Jornada,
  RegistroHorario,
  TratamentoPonto,
  Ausencia,
  Ferias,
  DiaSemanaSigla,
  HorarioDiaSemana,
} from '@/types/rh'

export interface MarcacaoInterpreta {
  id?: string
  horario: string // HH:MM
  tipo: 'entrada' | 'inicio_intervalo' | 'retorno_intervalo' | 'saida' | 'avulsa'
  origem: 'terminal' | 'tratamento_fechamento' | 'admin' | 'intervalo_automatico'
  registroOriginal?: RegistroHorario
  tratamento?: TratamentoPonto
  automatico?: boolean
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
  intervaloAutomaticoAplicado: boolean
  intervaloInfo?: {
    inicio: string
    retorno: string
    duracaoMinutos: number
  }
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
export function getDiaSemanaSigla(dateStr: string): DiaSemanaSigla {
  // Use noon to avoid timezone border shifts
  const d = new Date(dateStr + 'T12:00:00Z')
  const day = d.getUTCDay()
  const map: DiaSemanaSigla[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
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
 * Retorna a configuração de horário específica para um dia da semana na jornada.
 * Retrocompatibilidade total: se grade_semanal não existir ou o dia não constar nela,
 * cai para a configuração global existente (hora_entrada, hora_saida, dias_trabalho, dias_folga).
 */
export function getHorarioDiaJornada(
  jornada: Jornada | null,
  diaSigla: DiaSemanaSigla,
): HorarioDiaSemana | null {
  if (!jornada) return null

  // 1. Prioriza grade_semanal se presente
  if (jornada.grade_semanal && jornada.grade_semanal[diaSigla]) {
    const diaConfig = jornada.grade_semanal[diaSigla]
    if (!diaConfig.ativo) {
      return {
        ativo: false,
        hora_entrada: '',
        hora_saida: '',
        duracao_min: 0,
        atravessa_meia_noite: false,
      }
    }

    let duracao = diaConfig.duracao_min
    if (!duracao || duracao <= 0) {
      const ent = timeStringToMinutes(diaConfig.hora_entrada)
      let sai = timeStringToMinutes(diaConfig.hora_saida)
      const atravessa = Boolean(
        diaConfig.atravessa_meia_noite ||
        (diaConfig.hora_entrada && diaConfig.hora_saida && sai < ent),
      )
      if (sai < ent || atravessa) {
        sai += 24 * 60
      }
      let tot = sai - ent
      if (diaConfig.hora_inicio_intervalo && diaConfig.hora_retorno_intervalo) {
        const intIni = timeStringToMinutes(diaConfig.hora_inicio_intervalo)
        let intFim = timeStringToMinutes(diaConfig.hora_retorno_intervalo)
        if (intFim < intIni || (atravessa && intFim < intIni)) {
          intFim += 24 * 60
        }
        const diffInt = intFim - intIni
        if (diffInt > 0) tot -= diffInt
      }
      duracao = Math.max(0, tot)
    }

    return {
      ativo: true,
      hora_entrada: diaConfig.hora_entrada || '',
      hora_inicio_intervalo: diaConfig.hora_inicio_intervalo || '',
      hora_retorno_intervalo: diaConfig.hora_retorno_intervalo || '',
      hora_saida: diaConfig.hora_saida || '',
      duracao_min: duracao,
      atravessa_meia_noite: Boolean(
        diaConfig.atravessa_meia_noite ||
        (diaConfig.hora_entrada &&
          diaConfig.hora_saida &&
          timeStringToMinutes(diaConfig.hora_saida) < timeStringToMinutes(diaConfig.hora_entrada)),
      ),
    }
  }

  // 2. Fallback retrocompatível: configuração global
  const ehFolga = jornada.dias_folga?.includes(diaSigla)
  const ehTrabalho = jornada.dias_trabalho?.includes(diaSigla)
  if (ehFolga || !ehTrabalho) {
    return {
      ativo: false,
      hora_entrada: '',
      hora_saida: '',
      duracao_min: 0,
      atravessa_meia_noite: false,
    }
  }

  let duracao = jornada.duracao_jornada_min
  if (!duracao || duracao <= 0) {
    const ent = timeStringToMinutes(jornada.hora_entrada)
    let sai = timeStringToMinutes(jornada.hora_saida)
    const atravessa = Boolean(
      jornada.atravessa_meia_noite || (jornada.hora_entrada && jornada.hora_saida && sai < ent),
    )
    if (sai < ent || atravessa) {
      sai += 24 * 60
    }
    let tot = sai - ent
    if (jornada.hora_inicio_intervalo && jornada.hora_retorno_intervalo) {
      const intIni = timeStringToMinutes(jornada.hora_inicio_intervalo)
      let intFim = timeStringToMinutes(jornada.hora_retorno_intervalo)
      if (intFim < intIni || (atravessa && intFim < intIni)) {
        intFim += 24 * 60
      }
      const diffInt = intFim - intIni
      if (diffInt > 0) tot -= diffInt
    }
    duracao = Math.max(0, tot)
  }

  return {
    ativo: true,
    hora_entrada: jornada.hora_entrada || '',
    hora_inicio_intervalo: jornada.hora_inicio_intervalo || '',
    hora_retorno_intervalo: jornada.hora_retorno_intervalo || '',
    hora_saida: jornada.hora_saida || '',
    duracao_min: Math.max(0, duracao || 0),
    atravessa_meia_noite: Boolean(
      jornada.atravessa_meia_noite ||
      (jornada.hora_entrada &&
        jornada.hora_saida &&
        timeStringToMinutes(jornada.hora_saida) < timeStringToMinutes(jornada.hora_entrada)),
    ),
  }
}

/**
 * Calcula a duração prevista da jornada diária em minutos.
 * Suporta grade semanal por dia e jornadas que ultrapassam a meia-noite.
 */
export function calcularPrevistoJornada(jornada: Jornada | null, diaSigla: string): number {
  if (!jornada) return 0
  const horarioDia = getHorarioDiaJornada(jornada, diaSigla as DiaSemanaSigla)
  if (!horarioDia || !horarioDia.ativo) return 0
  return horarioDia.duracao_min
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
  opcoes?: {
    ehDiaFolga?: boolean
    diaSigla?: DiaSemanaSigla
  },
): {
  minutosTrabalhados: number
  todasMarcacoes: MarcacaoInterpreta[]
  isIncompleto: boolean
  intervaloAutomaticoAplicado: boolean
  intervaloInfo?: {
    inicio: string
    retorno: string
    duracaoMinutos: number
  }
} {
  const listaFisica: MarcacaoInterpreta[] = []

  // 1. Marcações originais batidas no terminal
  for (const reg of marcacoesOriginais) {
    const horario = reg.timestamp_utc
      ? getSPTimeFromUtc(reg.timestamp_utc)
      : reg.hora_utc.slice(0, 5)
    listaFisica.push({
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
      listaFisica.push({
        id: trat.id,
        horario: trat.hora_registro.slice(0, 5),
        tipo: (trat.tipo_marcacao as any) || 'avulsa',
        origem: 'tratamento_fechamento',
        tratamento: trat,
      })
    }
  }

  // Ordena cronologicamente por horário
  listaFisica.sort((a, b) => {
    return timeStringToMinutes(a.horario) - timeStringToMinutes(b.horario)
  })

  const totalBatidasReais = listaFisica.length

  // Casos sem batidas:
  if (totalBatidasReais === 0) {
    return {
      minutosTrabalhados: 0,
      todasMarcacoes: [],
      isIncompleto: false,
      intervaloAutomaticoAplicado: false,
    }
  }

  // Resolve horários do dia específico da semana (suporta grade_semanal por dia)
  const diaConfig = opcoes?.diaSigla ? getHorarioDiaJornada(jornada, opcoes.diaSigla) : null
  const horaEntradaRef = diaConfig ? diaConfig.hora_entrada : jornada?.hora_entrada || ''
  const horaIniIntRef = diaConfig
    ? diaConfig.hora_inicio_intervalo || ''
    : jornada?.hora_inicio_intervalo || ''
  const horaRetIntRef = diaConfig
    ? diaConfig.hora_retorno_intervalo || ''
    : jornada?.hora_retorno_intervalo || ''
  const ehNoturno = diaConfig
    ? Boolean(diaConfig.atravessa_meia_noite)
    : Boolean(jornada?.atravessa_meia_noite)
  const ehDiaFolga =
    opcoes?.ehDiaFolga !== undefined ? opcoes.ehDiaFolga : diaConfig ? !diaConfig.ativo : false

  // Verifica se o dia possui intervalo previsto configurado
  const temIntervaloConfigurado = Boolean(
    horaIniIntRef && horaRetIntRef && horaIniIntRef.trim() !== '' && horaRetIntRef.trim() !== '',
  )

  let intIniMin = 0
  let intFimMin = 0
  let duracaoIntervaloMin = 0

  if (temIntervaloConfigurado) {
    intIniMin = timeStringToMinutes(horaIniIntRef)
    intFimMin = timeStringToMinutes(horaRetIntRef)
    if (intFimMin < intIniMin || (ehNoturno && intFimMin < intIniMin)) {
      intFimMin += 24 * 60
    }
    duracaoIntervaloMin = Math.max(0, intFimMin - intIniMin)
  }

  // REGRA DE INTERVALO AUTOMÁTICO vs BATIDAS REAIS:
  // Se o funcionário tiver 4 ou mais marcações (ou se tiver registrado saídas/retornos de intervalo):
  // Usamos as batidas reais sem adicionar intervalo automático, evitando duplo desconto.
  //
  // Se o funcionário tiver exatamente 2 marcações (ex: 08:00 Entrada e 17:00 Saída sem batida de almoço)
  // e for um dia com jornada de trabalho e intervalo configurado:
  // Aplicamos o intervalo automático previsto da jornada vigente do funcionário.
  //
  // Casos de borda:
  // - O intervalo automático só se aplica se o período trabalhado (entrada -> saída) englobar
  //   ou sobrepor o período do intervalo previsto. Se o funcionário saiu antes do almoço
  //   (ex: 08:00 às 11:30 e o almoço é 12:00-13:00), não se desconta intervalo automático!
  // - Em dia de folga/DSR, não se aplica intervalo automático a menos que explicitamente solicitado.
  // - Se houver marcação incompleta (1 batida ou 3 batidas), o dia fica com pendência de marcação incompleta.

  let aplicarIntervaloAutomatico = false
  let intervaloInfo:
    | {
        inicio: string
        retorno: string
        duracaoMinutos: number
      }
    | undefined = undefined

  const listaFinal: MarcacaoInterpreta[] = []

  if (
    totalBatidasReais === 2 &&
    temIntervaloConfigurado &&
    duracaoIntervaloMin > 0 &&
    !ehDiaFolga
  ) {
    const entMin = timeStringToMinutes(listaFisica[0].horario)
    let saiMin = timeStringToMinutes(listaFisica[1].horario)

    if (saiMin < entMin || (ehNoturno && saiMin < entMin)) {
      saiMin += 24 * 60
    }

    // Normaliza horários de intervalo para a linha temporal da jornada
    let intIniAjustado = intIniMin
    let intFimAjustado = intFimMin

    if (ehNoturno) {
      // Se jornada noturna (ex: 22:00 às 06:00, almoço 02:00 às 03:00)
      const horaEntradaJornada = timeStringToMinutes(horaEntradaRef)
      if (intIniAjustado < horaEntradaJornada) {
        intIniAjustado += 24 * 60
        intFimAjustado += 24 * 60
      }
    }

    // Verifica se o intervalo cai dentro do período em que o funcionário esteve presente
    const periodoPresencaMin = saiMin - entMin
    const intervaloCaiDentroDaPresenca = entMin <= intIniAjustado && saiMin >= intFimAjustado

    // Se o colaborador trabalhou tempo suficiente e o intervalo cai dentro da sua permanência:
    if (intervaloCaiDentroDaPresenca && periodoPresencaMin > duracaoIntervaloMin) {
      aplicarIntervaloAutomatico = true
      intervaloInfo = {
        inicio: horaIniIntRef.slice(0, 5),
        retorno: horaRetIntRef.slice(0, 5),
        duracaoMinutos: duracaoIntervaloMin,
      }

      // Constrói a lista com as 4 marcações: Entrada, Início Int (Auto), Retorno Int (Auto), Saída
      listaFinal.push({
        ...listaFisica[0],
        tipo: 'entrada',
      })

      listaFinal.push({
        id: `auto-int-ini-${listaFisica[0].id || 'dia'}`,
        horario: horaIniIntRef.slice(0, 5),
        tipo: 'inicio_intervalo',
        origem: 'intervalo_automatico',
        automatico: true,
      })

      listaFinal.push({
        id: `auto-int-fim-${listaFisica[1].id || 'dia'}`,
        horario: horaRetIntRef.slice(0, 5),
        tipo: 'retorno_intervalo',
        origem: 'intervalo_automatico',
        automatico: true,
      })

      listaFinal.push({
        ...listaFisica[1],
        tipo: 'saida',
      })
    }
  }

  // Se não aplicou automático (por ter 4 batidas, ou ser dia sem intervalo, ou não englobar o intervalo):
  if (!aplicarIntervaloAutomatico) {
    const tiposOrdem: ('entrada' | 'inicio_intervalo' | 'retorno_intervalo' | 'saida')[] = [
      'entrada',
      'inicio_intervalo',
      'retorno_intervalo',
      'saida',
    ]

    listaFisica.forEach((item, idx) => {
      listaFinal.push({
        ...item,
        tipo: item.tipo === 'avulsa' ? tiposOrdem[idx % tiposOrdem.length] : item.tipo,
      })
    })
  }

  // Cálculo de minutos trabalhados por blocos de entrada/saída
  let minutosTrabalhados = 0

  if (aplicarIntervaloAutomatico) {
    // Bloco 1: Entrada até Início do Intervalo
    const ent1 = timeStringToMinutes(listaFinal[0].horario)
    let int1 = timeStringToMinutes(listaFinal[1].horario)
    if (int1 < ent1 || (ehNoturno && int1 < ent1)) {
      int1 += 24 * 60
    }
    const bloco1 = Math.max(0, int1 - ent1)

    // Bloco 2: Retorno do Intervalo até Saída
    let int2 = timeStringToMinutes(listaFinal[2].horario)
    let sai = timeStringToMinutes(listaFinal[3].horario)
    if (int2 < ent1 || (ehNoturno && int2 < ent1)) {
      int2 += 24 * 60
    }
    if (sai < int2 || (ehNoturno && sai < int2)) {
      sai += 24 * 60
    }
    const bloco2 = Math.max(0, sai - int2)

    minutosTrabalhados = bloco1 + bloco2
  } else {
    for (let i = 0; i < listaFinal.length - 1; i += 2) {
      const tInicio = timeStringToMinutes(listaFinal[i].horario)
      let tFim = timeStringToMinutes(listaFinal[i + 1].horario)

      if (tFim < tInicio || (ehNoturno && i === 0 && tFim < tInicio)) {
        tFim += 24 * 60
      }

      const diff = tFim - tInicio
      if (diff > 0) {
        minutosTrabalhados += diff
      }
    }
  }

  // É incompleto se o número de batidas REAIS (físicas/ajustes) for ímpar
  const isIncompleto = totalBatidasReais % 2 !== 0

  return {
    minutosTrabalhados,
    todasMarcacoes: listaFinal,
    isIncompleto,
    intervaloAutomaticoAplicado: aplicarIntervaloAutomatico,
    intervaloInfo,
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

    // Calcula realizado (considerando intervalo automático para a jornada individual vigente e dia da semana)
    const {
      minutosTrabalhados,
      todasMarcacoes,
      isIncompleto,
      intervaloAutomaticoAplicado,
      intervaloInfo,
    } = calcularHorasRealizadas(regsDoDia, tratamentosDoDia, jornadaVigente, {
      ehDiaFolga,
      diaSigla,
    })

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
      intervaloAutomaticoAplicado,
      intervaloInfo,
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
