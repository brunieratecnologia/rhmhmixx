import React, { useState, useEffect, useRef, useCallback } from 'react'
import { terminalService, type TerminalInfo, type RegistroPontoResult } from '@/services/rh'
import pb from '@/lib/pocketbase/client'
import { getSPDateTimeParts } from '@/lib/formatters'
import {
  salvarCacheFuncionarios,
  carregarCacheFuncionarios,
  salvarCacheTerminalInfo,
  carregarCacheTerminalInfo,
  enfileirarBatidaOffline,
  carregarFilaOffline,
  obterTamanhoFilaOffline,
  validarPinOffline,
  sincronizarFilaOffline,
  type BatidaOfflineFila,
} from '@/lib/offlineQueue'
import {
  Clock,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  Delete,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  KeyRound,
  Maximize2,
  Minimize2,
  CloudUpload,
  Radio,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function TerminalPonto() {
  // Terminal Status & Company Info
  const [terminalInfo, setTerminalInfo] = useState<TerminalInfo | null>(() =>
    carregarCacheTerminalInfo(),
  )
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)
  const [checkingConnection, setCheckingConnection] = useState<boolean>(false)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)

  // Fila Offline & Sincronização
  const [tamanhoFila, setTamanhoFila] = useState<number>(() => obterTamanhoFilaOffline())
  const [syncNotice, setSyncNotice] = useState<string | null>(null)
  const [isSyncingNow, setIsSyncingNow] = useState<boolean>(false)

  // Clock offset in ms between server time (UTC) and client clock (Date.now())
  const serverOffsetRef = useRef<number>(0)

  // Clock
  const [currentTime, setCurrentTime] = useState<Date>(new Date())

  // Form Field: APENAS PIN do funcionário
  const [pin, setPin] = useState<string>('')

  // Status & Confirmation
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [confirmation, setConfirmation] = useState<
    (RegistroPontoResult & { offline_recorded?: boolean }) | null
  >(null)
  const [countdown, setCountdown] = useState<number>(4)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLocked, setIsLocked] = useState<boolean>(false)

  const pinInputRef = useRef<HTMLInputElement>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const syncNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 1. Digital Clock update every second using server offset
  useEffect(() => {
    const updateTick = () => {
      const nowMs = Date.now() + serverOffsetRef.current
      setCurrentTime(new Date(nowMs))
    }
    updateTick()
    const timer = setInterval(updateTick, 1000)
    return () => clearInterval(timer)
  }, [])

  // Atualizar contagem da fila local
  const atualizarContadorFila = useCallback(() => {
    setTamanhoFila(obterTamanhoFilaOffline())
  }, [])

  // Disparar sincronização com notificação amigável
  const dispararSincronizacao = useCallback(async () => {
    const qtdAntes = obterTamanhoFilaOffline()
    if (qtdAntes === 0) return

    setIsSyncingNow(true)
    try {
      const res = await sincronizarFilaOffline()
      atualizarContadorFila()

      const totalEnviadas = res.sucessos + res.duplicadasDescartadas
      if (totalEnviadas > 0) {
        const plural = totalEnviadas > 1 ? 'batidas enviadas' : 'batida enviada'
        const aviso = `Conexão restabelecida — ${totalEnviadas} ${plural} ao servidor com sucesso!`
        setSyncNotice(aviso)
        if (syncNoticeTimerRef.current) clearTimeout(syncNoticeTimerRef.current)
        syncNoticeTimerRef.current = setTimeout(() => {
          setSyncNotice(null)
        }, 6000)
      }
    } catch (err) {
      console.warn('Erro ao sincronizar fila offline:', err)
    } finally {
      setIsSyncingNow(false)
    }
  }, [atualizarContadorFila])

  // Na montagem inicial do terminal, se houver batidas pendentes e o navegador estiver online, dispara o sincronizador imediatamente
  useEffect(() => {
    if (obterTamanhoFilaOffline() > 0 && navigator.onLine) {
      dispararSincronizacao()
    }
  }, [dispararSincronizacao])

  // 2. Fetch Terminal Info & sync server time offset & check connection
  const checkStatus = useCallback(async () => {
    try {
      setCheckingConnection(true)
      const clientReqTime = Date.now()
      const info = await terminalService.getInfo()
      const clientResTime = Date.now()
      // SNTP Cristian's algorithm: estimated server time at response arrival
      const roundTripLatency = Math.max(0, (clientResTime - clientReqTime) / 2)

      let serverTimestampMs = 0
      if (typeof info.server_time_ms === 'number' && !isNaN(info.server_time_ms)) {
        serverTimestampMs = info.server_time_ms
      } else if (info.server_time_utc) {
        serverTimestampMs = new Date(info.server_time_utc).getTime()
      }

      if (serverTimestampMs > 0) {
        const nowAtArrival = Date.now()
        serverOffsetRef.current = serverTimestampMs + roundTripLatency - nowAtArrival
        setCurrentTime(new Date(Date.now() + serverOffsetRef.current))
      }

      // Persistir em cache local imediatamente
      salvarCacheTerminalInfo(info)
      if (info.funcionarios_offline && info.funcionarios_offline.length > 0) {
        salvarCacheFuncionarios(info.funcionarios_offline)
      }

      setTerminalInfo(info)
      setIsOnline(true)

      // Se há batidas na fila offline ao constatar conexão online, sincronizar automaticamente
      if (obterTamanhoFilaOffline() > 0) {
        dispararSincronizacao()
      }
    } catch {
      setIsOnline(false)
    } finally {
      setCheckingConnection(false)
    }
  }, [dispararSincronizacao])

  // Carga inicial e revalidação periódica de 15 segundos
  useEffect(() => {
    checkStatus()
    const interval = setInterval(() => {
      checkStatus()
    }, 15000)
    return () => clearInterval(interval)
  }, [checkStatus])

  // Ouvintes de rede do navegador (online/offline)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      checkStatus()
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [checkStatus])

  // 3. Clear Confirmation and Reset (opcionalmente aceita dígito inicial para o próximo PIN)
  const resetForm = useCallback((initialDigit?: string) => {
    setPin(initialDigit && /^\d$/.test(initialDigit) ? initialDigit : '')
    setConfirmation(null)
    setErrorMessage(null)
    setIsLocked(false)
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    setTimeout(() => {
      pinInputRef.current?.focus()
    }, 50)
  }, [])

  // 4. Handle Confirmation Countdown (4 segundos para leitura sem travar a fila)
  useEffect(() => {
    if (confirmation) {
      setCountdown(4)
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
            resetForm()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    }
  }, [confirmation, resetForm])

  // 4.1. Monitorar estado e suporte da Fullscreen API
  useEffect(() => {
    const checkFullscreenState = () => {
      const doc = document as any
      const isFs = Boolean(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement,
      )
      setIsFullscreen(isFs)
    }

    checkFullscreenState()

    const events = [
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange',
      'MSFullscreenChange',
    ]

    events.forEach((evt) => document.addEventListener(evt, checkFullscreenState))
    return () => {
      events.forEach((evt) => document.removeEventListener(evt, checkFullscreenState))
    }
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const doc = document as any
    const docEl = document.documentElement as any

    const isFs = Boolean(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement,
    )

    try {
      if (!isFs) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen()
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen()
        } else if (docEl.mozRequestFullScreen) {
          await docEl.mozRequestFullScreen()
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen()
        }
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen()
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen()
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen()
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen()
        }
      }
    } catch (err) {
      console.warn('Falha ao alternar tela cheia:', err)
    }
  }, [])

  // 5. Interceptação global de teclado durante a tela de confirmação
  useEffect(() => {
    if (!confirmation) return

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const isDigit = /^[0-9]$/.test(e.key)
      if (isDigit) {
        e.preventDefault()
        resetForm(e.key)
      } else if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
        e.preventDefault()
        resetForm()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [confirmation, resetForm])

  // Virtual Keypad Handler
  const handleKeypadPress = (val: string) => {
    if (confirmation) {
      if (/^\d$/.test(val)) {
        resetForm(val)
      } else {
        resetForm()
      }
      return
    }
    setErrorMessage(null)

    if (val === 'clear') {
      setPin('')
      return
    }

    if (val === 'backspace') {
      setPin((prev) => prev.slice(0, -1))
      return
    }

    if (pin.length < 6) {
      setPin((prev) => prev + val)
    }
  }

  // Generate idempotency key (client generated UUID + timestamp)
  const generateIdempotencyKey = (cleanPin: string, nowMs: number) => {
    const randomHex =
      Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10)
    return `req_${cleanPin.slice(-2)}_${nowMs}_${randomHex}`
  }

  // Gravar batida offline localmente de forma segura e imediata
  const registrarBatidaOfflineLocal = async (cleanPin: string, nowMs: number) => {
    const validacao = await validarPinOffline(cleanPin, nowMs)

    if (!validacao.valido) {
      setErrorMessage(validacao.mensagemErro || 'PIN inválido ou não cadastrado.')
      setPin('')
      pinInputRef.current?.focus()
      return
    }

    const func = validacao.funcionario
    const isContingencia = Boolean(validacao.modoContingencia)
    const nomeExibicao = func ? func.nome : `Colaborador (PIN ••••${cleanPin.slice(-2)})`

    const dateNowObj = new Date(nowMs)
    const targetTimeZone = terminalInfo?.empresa?.fuso_horario || 'America/Sao_Paulo'
    const {
      shortDate: shortDateBR,
      hours,
      minutes,
      seconds,
    } = getSPDateTimeParts(dateNowObj, targetTimeZone)
    const horaFormatada = `${hours}:${minutes}:${seconds}`
    const horaSimples = `${hours}:${minutes}`

    // Deduplicação offline se bateu há menos de 90s
    if (validacao.deduplicado) {
      setConfirmation({
        success: true,
        idempotent: true,
        deduplicated: true,
        offline_recorded: true,
        offline_sync: true,
        identificador: validacao.batidaAnterior?.id_requisicao || 'OFFLINE-DEDUP',
        funcionario_nome: nomeExibicao,
        data_formatada: shortDateBR,
        horario_formatado: horaFormatada,
        timestamp_utc: validacao.batidaAnterior?.timestamp_utc || dateNowObj.toISOString(),
        server_timestamp_ms: validacao.batidaAnterior?.server_timestamp_ms || nowMs,
        fuso_horario: targetTimeZone,
        mensagem: `Sua batida às ${horaSimples} já valeu — não precisa bater de novo.`,
      })
      setPin('')
      return
    }

    // Gerar idempotência única e persistir na fila offline
    const idRequisicao = generateIdempotencyKey(cleanPin, nowMs)
    const novaBatida: BatidaOfflineFila = {
      id_requisicao: idRequisicao,
      pin: cleanPin,
      funcionario_id: func?.id,
      funcionario_nome: func?.nome,
      modo_contingencia: isContingencia,
      timestamp_utc: dateNowObj.toISOString(),
      server_timestamp_ms: nowMs,
      criado_em_ms: Date.now(),
      tentativas: 0,
    }

    enfileirarBatidaOffline(novaBatida)
    atualizarContadorFila()

    setConfirmation({
      success: true,
      idempotent: false,
      deduplicated: false,
      offline_recorded: true,
      offline_sync: true,
      identificador: idRequisicao,
      funcionario_nome: nomeExibicao,
      data_formatada: shortDateBR,
      horario_formatado: horaFormatada,
      timestamp_utc: novaBatida.timestamp_utc,
      server_timestamp_ms: nowMs,
      fuso_horario: targetTimeZone,
      mensagem: isContingencia
        ? 'Ponto registrado em modo de contingência! Salvo com segurança no terminal.'
        : 'Ponto registrado offline com sucesso!',
    })
    setPin('')
  }

  // Submit time punch (APENAS PIN) — com suporte completo a Modo Offline
  const handleRegisterPonto = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (submitting) return

    const cleanPin = pin.trim()

    if (!cleanPin) {
      setErrorMessage('Por favor, digite o seu PIN individual de 4 a 6 dígitos.')
      pinInputRef.current?.focus()
      return
    }

    if (cleanPin.length < 4 || cleanPin.length > 6) {
      setErrorMessage('O PIN deve conter entre 4 e 6 dígitos numéricos.')
      pinInputRef.current?.focus()
      return
    }

    setSubmitting(true)
    setErrorMessage(null)
    setIsLocked(false)

    // Timestamp oficial sincronizado do momento exato da batida
    const nowServerMs = Date.now() + serverOffsetRef.current

    // Se já estiver offline constatado (ou navigator.onLine for falso), registra direto offline sem esperar timeout
    if (!isOnline || !navigator.onLine) {
      try {
        await registrarBatidaOfflineLocal(cleanPin, nowServerMs)
      } finally {
        setSubmitting(false)
      }
      return
    }

    // Unique idempotency key
    const idRequisicao = generateIdempotencyKey(cleanPin, nowServerMs)
    const clientReqTime = Date.now()

    try {
      const res = await terminalService.registrarPonto({
        matricula: '',
        pin: cleanPin,
        id_requisicao: idRequisicao,
      })
      const clientResTime = Date.now()

      if (res.success) {
        const serverMs =
          typeof res.server_timestamp_ms === 'number'
            ? res.server_timestamp_ms
            : res.timestamp_utc
              ? new Date(res.timestamp_utc).getTime()
              : 0

        if (serverMs > 0) {
          const latency = Math.max(0, (clientResTime - clientReqTime) / 2)
          serverOffsetRef.current = serverMs + latency - clientResTime
          setCurrentTime(new Date(Date.now() + serverOffsetRef.current))
        }

        setConfirmation(res)
        setPin('')
      } else {
        setErrorMessage(res.message || res.mensagem || 'Falha ao registrar ponto. Tente novamente.')
      }
    } catch (err: any) {
      console.error('Erro no registro de ponto:', err)
      const data = err?.data || err?.response?.data || {}
      const status = err?.status || err?.response?.status

      // Se for erro de rede/conexão/timeout ou 502/503/504, mudar para modo offline e gravar localmente
      const isNetworkError =
        status === 0 ||
        !navigator.onLine ||
        (err?.name === 'ClientResponseError' && status >= 500) ||
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('NetworkError')

      if (isNetworkError) {
        setIsOnline(false)
        try {
          await registrarBatidaOfflineLocal(cleanPin, nowServerMs)
        } catch (offlineErr: any) {
          setErrorMessage(
            offlineErr?.message ||
              'Atenção: Não foi possível gravar o ponto offline. Verifique a lista de funcionários.',
          )
        }
      } else if (status === 429 || data.locked) {
        setIsLocked(true)
        setErrorMessage(
          data.message ||
            'Terminal temporariamente bloqueado por excesso de tentativas incorretas. Tente novamente mais tarde.',
        )
      } else if (status === 401) {
        setErrorMessage(data.message || 'PIN inválido ou não cadastrado.')
        setPin('')
        pinInputRef.current?.focus()
      } else if (status === 403) {
        setErrorMessage(
          data.message || 'Funcionário não autorizado a registrar ponto. Procure o RH.',
        )
      } else {
        setErrorMessage(
          data.message ||
            'Não foi possível registrar o ponto. A gravação NÃO foi confirmada no servidor. Tente novamente.',
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Formatting Clock display (24h) explicitly in America/Sao_Paulo timezone
  const targetTimeZone = terminalInfo?.empresa?.fuso_horario || 'America/Sao_Paulo'
  const {
    hours,
    minutes,
    seconds,
    shortDate: shortDateBR,
    longDate: dateFormatted,
  } = getSPDateTimeParts(currentTime, targetTimeZone)

  const companyLogoUrl =
    terminalInfo?.empresa?.logotipo && terminalInfo.empresa.id
      ? pb.files.getURL(
          {
            collectionId: 'empresa',
            id: terminalInfo.empresa.id,
          } as any,
          terminalInfo.empresa.logotipo,
        )
      : null

  const companyDisplayName =
    terminalInfo?.empresa?.nome_fantasia ||
    terminalInfo?.empresa?.razao_social ||
    'MH MIXX — Açaí e Frutas Congeladas'

  return (
    <div className="min-h-screen flex flex-col bg-[#090D14] text-amber-50 select-none">
      {/* 1. Header / Topo */}
      <header className="bg-[#070B11] border-b border-[#D4AF37]/20 px-4 sm:px-8 py-3.5 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          {/* Logo / Nome da Empresa */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-black border border-[#D4AF37]/40 flex items-center justify-center p-1 shrink-0 shadow-md">
              <img
                src={companyLogoUrl || '/src/assets/logomhmixx-7c4e3.jpeg'}
                alt={companyDisplayName}
                className="w-full h-full object-contain rounded-lg"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).src = '/src/assets/logomhmixx-7c4e3.jpeg'
                }}
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-amber-100 tracking-tight truncate">
                {companyDisplayName}
              </h1>
              <p className="text-xs text-[#D4AF37] font-medium">
                Terminal Eletrônico de Ponto • Registro por PIN
              </p>
            </div>
          </div>

          {/* Large Digital Clock com Fuso de São Paulo, Hora Oficial do Servidor e Ação Rápida */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1.5 font-mono text-2xl sm:text-4xl font-extrabold text-[#D4AF37] tracking-wider drop-shadow-xs">
                <span>{hours}</span>
                <span className="animate-pulse text-[#E5C07B]">:</span>
                <span>{minutes}</span>
                <span className="animate-pulse text-[#E5C07B]">:</span>
                <span className="text-lg sm:text-2xl text-slate-400">{seconds}</span>
              </div>
              <div className="text-[11px] sm:text-xs text-slate-400 font-medium capitalize mt-0.5">
                {shortDateBR} • <span className="capitalize">{dateFormatted}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-[#D4AF37]/90 font-medium mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] inline-block animate-pulse" />
                <span>
                  Horário oficial (servidor) •{' '}
                  {targetTimeZone === 'America/Sao_Paulo' ? 'São Paulo (UTC-3)' : targetTimeZone}
                </span>
              </div>
            </div>

            {/* Botão Tela Cheia no cabeçalho */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Sair de Tela Cheia' : 'Entrar em Tela Cheia (F11)'}
              aria-label={isFullscreen ? 'Sair de Tela Cheia' : 'Entrar em Tela Cheia'}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-[#121824] hover:bg-[#1A2233] text-amber-200 hover:text-amber-100 border border-[#D4AF37]/30 hover:border-[#D4AF37]/60 transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4 text-[#D4AF37]" />
                  <span className="text-xs font-semibold hidden md:inline">Sair Tela Cheia</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 text-[#D4AF37]" />
                  <span className="text-xs font-semibold hidden md:inline">Tela Cheia</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Banner de Aviso de Restabelecimento de Conexão ou Fila de Sincronização */}
      {syncNotice && (
        <div className="bg-emerald-600/90 text-white border-b border-emerald-400 px-4 py-2.5 text-center text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300 shadow-md">
          <CloudUpload className="w-4 h-4 animate-bounce" />
          <span>{syncNotice}</span>
        </div>
      )}

      {/* 2. Main Content / Centro */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          {confirmation ? (
            /* Confirmation Success Screen with Countdown */
            <div className="bg-white rounded-2xl border-2 border-emerald-500 p-6 sm:p-8 shadow-xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner relative">
                <CheckCircle2 className="w-12 h-12" />
                {confirmation.offline_recorded && (
                  <span
                    className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-1 rounded-full shadow-md border-2 border-white"
                    title="Registrado em modo offline"
                  >
                    <Radio className="w-4 h-4" />
                  </span>
                )}
              </div>

              {(() => {
                const isRepetida = Boolean(confirmation.idempotent || confirmation.deduplicated)
                const isOffline = Boolean(confirmation.offline_recorded)

                let displayDate = confirmation.data_formatada || ''
                let displayTime = confirmation.horario_formatado || ''

                if (confirmation.timestamp_utc) {
                  try {
                    const savedDateObj = new Date(confirmation.timestamp_utc)
                    if (!isNaN(savedDateObj.getTime())) {
                      const formattedTime = new Intl.DateTimeFormat('pt-BR', {
                        timeZone: targetTimeZone,
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                      }).format(savedDateObj)

                      const formattedDate = new Intl.DateTimeFormat('pt-BR', {
                        timeZone: targetTimeZone,
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      }).format(savedDateObj)

                      if (formattedTime) displayTime = formattedTime
                      if (formattedDate) displayDate = formattedDate
                    }
                  } catch {
                    /* fallback para os campos retornados */
                  }
                }

                const horaSimples = displayTime ? displayTime.slice(0, 5) : ''

                return (
                  <>
                    <div>
                      {/* Badge amigável sem jargão técnico */}
                      <div className="flex flex-col items-center gap-1.5 mb-2">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {isRepetida
                            ? 'Você já bateu o ponto agora'
                            : 'Ponto Registrado com Sucesso'}
                        </span>

                        {/* Selo discreto de registro offline */}
                        {isOffline && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
                            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse" />
                            <span>registrado offline — será enviado quando a internet voltar</span>
                          </span>
                        )}
                      </div>

                      <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                        {confirmation.funcionario_nome}
                      </h2>

                      {/* Subtítulo amigável e claro */}
                      {isRepetida ? (
                        <p className="text-xs sm:text-sm text-emerald-700 font-medium mt-1">
                          {confirmation.mensagem ||
                            (horaSimples
                              ? `Sua batida às ${horaSimples} já valeu — não precisa bater de novo.`
                              : 'Sua batida já valeu — não precisa bater de novo.')}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 mt-1">
                          {isOffline
                            ? 'Horário oficial preservado com segurança no terminal'
                            : 'Horário oficial do servidor registrado de forma persistente e imutável'}
                        </p>
                      )}
                    </div>

                    {/* Data & Horário Oficial Boxes */}
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="text-center">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Data da Marcação
                        </span>
                        <span className="text-lg sm:text-xl font-bold font-mono text-slate-900 mt-1 block">
                          {displayDate || shortDateBR}
                        </span>
                      </div>
                      <div className="text-center border-l border-slate-200 pl-3">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Horário Oficial (SP)
                        </span>
                        <span className="text-lg sm:text-xl font-extrabold font-mono text-[#D4AF37] mt-1 block">
                          {displayTime || `${hours}:${minutes}:${seconds}`}
                        </span>
                      </div>
                    </div>

                    {/* Identificador Único discreto */}
                    <div className="py-1.5 px-3 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between text-[11px] text-slate-500">
                      <span className="text-slate-400">Identificador:</span>
                      <span className="font-mono text-[10px] text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200 truncate max-w-[200px]">
                        {confirmation.identificador || 'N/A'}
                      </span>
                    </div>
                  </>
                )
              })()}

              {/* Automatic Countdown return (4s) & Botão Novo Registro Agora */}
              <div className="pt-2 flex flex-col items-center gap-3">
                <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#D4AF37] animate-spin" />
                  Retornando à tela inicial em{' '}
                  <span className="font-mono text-sm font-bold text-[#D4AF37]">{countdown}s</span>
                </p>

                <p className="text-[11px] text-slate-400 -mt-1 hidden sm:block">
                  Dica: o próximo funcionário pode começar a digitar o PIN direto no teclado
                </p>

                <Button
                  onClick={() => resetForm()}
                  className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold text-sm px-6 h-10 shadow-sm border-0 hover:brightness-110"
                >
                  Novo Registro Agora
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            </div>
          ) : (
            /* Terminal Input Card with PIN ONLY */
            <div className="bg-[#0F1624] rounded-2xl border border-[#D4AF37]/25 p-6 sm:p-7 shadow-2xl space-y-5">
              {/* Card Title */}
              <div className="text-center pb-2 border-b border-[#D4AF37]/15">
                <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 flex items-center justify-center mx-auto mb-2 shadow-xs">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-amber-100 tracking-tight">
                  Digite seu PIN
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Identificação rápida: digite apenas seu PIN numérico de 4 a 6 dígitos
                </p>
              </div>

              {/* Banner visual quando em modo offline na tela inicial */}
              {!isOnline && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-amber-100">Modo Offline Ativo</p>
                    <p className="text-[11px] text-amber-200/80 mt-0.5">
                      Você pode bater seu ponto normalmente. As marcações estão sendo salvas com
                      segurança no terminal e serão enviadas assim que a conexão retornar.
                    </p>
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {errorMessage && (
                <div
                  className={`p-3.5 rounded-xl border text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in duration-200 ${
                    isLocked
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  {isLocked ? (
                    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{isLocked ? 'Acesso Bloqueado' : 'Atenção'}</p>
                    <p className="text-xs mt-0.5 leading-relaxed">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Inputs Form: ONLY PIN */}
              <form onSubmit={handleRegisterPonto} className="space-y-4">
                {/* Campo PIN com Display Visual dos Dígitos */}
                <div
                  onClick={() => pinInputRef.current?.focus()}
                  className="p-4 rounded-xl border-2 border-[#D4AF37] bg-[#070B11] ring-2 ring-[#D4AF37]/20 transition-all cursor-pointer text-center"
                >
                  <label className="text-[11px] font-bold text-amber-200/80 uppercase tracking-wider block mb-2">
                    PIN do Funcionário
                  </label>

                  {/* Indicador de Bolinhas do PIN */}
                  <div className="flex items-center justify-center gap-3 my-2">
                    {[0, 1, 2, 3, 4, 5].map((idx) => {
                      const isFilled = pin.length > idx
                      return (
                        <div
                          key={idx}
                          className={`w-4 h-4 rounded-full border-2 transition-all ${
                            isFilled
                              ? 'bg-[#D4AF37] border-[#D4AF37] scale-110 shadow-xs'
                              : 'border-slate-700 bg-slate-900'
                          }`}
                        />
                      )
                    })}
                  </div>
                  <input
                    ref={pinInputRef}
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    placeholder="••••"
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full bg-transparent font-mono text-center text-2xl font-bold text-amber-100 tracking-widest focus:outline-none placeholder:text-slate-600 mt-1"
                    autoComplete="off"
                    autoFocus
                  />
                </div>

                {/* Virtual Keypad (Touch Screen Friendly) */}
                <div className="bg-[#070B11] p-3 rounded-xl border border-[#D4AF37]/20">
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleKeypadPress(String(num))}
                        className="h-12 sm:h-14 bg-[#121824] hover:bg-[#1A2233] active:bg-[#252F42] rounded-xl text-xl sm:text-2xl font-bold text-amber-50 border border-slate-800 shadow-xs hover:border-[#D4AF37]/50 transition-all flex items-center justify-center active:scale-95"
                      >
                        {num}
                      </button>
                    ))}

                    {/* Clear Button */}
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('clear')}
                      className="h-12 sm:h-14 bg-slate-900 hover:bg-slate-800 active:bg-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 border border-slate-800 transition-all flex flex-col items-center justify-center active:scale-95 gap-0.5"
                    >
                      <RotateCcw className="w-4 h-4 text-slate-400" />
                      <span>Limpar</span>
                    </button>

                    {/* Zero */}
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('0')}
                      className="h-12 sm:h-14 bg-[#121824] hover:bg-[#1A2233] active:bg-[#252F42] rounded-xl text-xl sm:text-2xl font-bold text-amber-50 border border-slate-800 shadow-xs hover:border-[#D4AF37]/50 transition-all flex items-center justify-center active:scale-95"
                    >
                      0
                    </button>

                    {/* Backspace Button */}
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('backspace')}
                      className="h-12 sm:h-14 bg-slate-900 hover:bg-slate-800 active:bg-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 border border-slate-800 transition-all flex flex-col items-center justify-center active:scale-95 gap-0.5"
                    >
                      <Delete className="w-4 h-4 text-slate-400" />
                      <span>Apagar</span>
                    </button>
                  </div>
                </div>

                {/* Action Button "REGISTRAR PONTO" */}
                <Button
                  type="submit"
                  disabled={submitting || pin.length < 4}
                  className="w-full h-14 bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 hover:brightness-110 font-extrabold text-base sm:text-lg rounded-xl shadow-lg shadow-[#D4AF37]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-40 border-0"
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>IDENTIFICANDO E REGISTRANDO...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>CONFIRMAR PONTO</span>
                    </>
                  )}
                </Button>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* 3. Footer / Base */}
      <footer className="bg-[#070B11] border-t border-[#D4AF37]/20 px-4 sm:px-8 py-3 text-xs text-slate-400">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          {/* Orientation message e versão do terminal */}
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
            <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
              Aproxime-se do terminal, digite seu PIN individual e pressione{' '}
              <strong className="text-amber-200">Confirmar Ponto</strong>.
            </p>
            <span className="text-[10px] text-slate-500 font-mono bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
              v0.0.29 • Modo Offline Ativo
            </span>
          </div>

          {/* Server Connection Status Indicator & Fullscreen Button */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Indicador de Conexão com Suporte ao Modo Offline */}
            {isOnline ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span>Terminal Online</span>
                {tamanhoFila > 0 && (
                  <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded-full border border-amber-300 font-bold ml-1">
                    {tamanhoFila} sincronizando...
                  </span>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span>Modo Offline — batendo normalmente</span>
                {tamanhoFila > 0 && (
                  <span className="bg-amber-400 text-slate-950 text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ml-1">
                    {tamanhoFila} na fila
                  </span>
                )}
              </span>
            )}

            {/* Botão Sincronizar Agora se houver batidas na fila e terminal online */}
            {tamanhoFila > 0 && isOnline && (
              <button
                type="button"
                onClick={dispararSincronizacao}
                disabled={isSyncingNow}
                title="Sincronizar batidas acumuladas agora"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all cursor-pointer disabled:opacity-50"
              >
                <CloudUpload className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-bounce' : ''}`} />
                <span>{isSyncingNow ? 'Enviando...' : 'Sincronizar'}</span>
              </button>
            )}

            {/* Botão Tela Cheia discreto */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Sair de Tela Cheia' : 'Entrar em Tela Cheia (F11)'}
              aria-label={isFullscreen ? 'Sair de Tela Cheia' : 'Entrar em Tela Cheia'}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold bg-[#121824] hover:bg-[#1A2233] text-amber-200 hover:text-amber-100 border border-[#D4AF37]/30 hover:border-[#D4AF37]/60 transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span className="hidden sm:inline">Sair Tela Cheia</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span className="hidden sm:inline">Tela Cheia</span>
                </>
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
