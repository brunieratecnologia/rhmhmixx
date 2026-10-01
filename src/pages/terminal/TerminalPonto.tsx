import React, { useState, useEffect, useRef, useCallback } from 'react'
import { terminalService, type TerminalInfo, type RegistroPontoResult } from '@/services/rh'
import pb from '@/lib/pocketbase/client'
import { getSPDateTimeParts } from '@/lib/formatters'
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
  ShieldCheck,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function TerminalPonto() {
  // Terminal Status & Company Info
  const [terminalInfo, setTerminalInfo] = useState<TerminalInfo | null>(null)
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [checkingConnection, setCheckingConnection] = useState<boolean>(false)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)

  // Clock offset in ms between server time (UTC) and client clock (Date.now())
  const serverOffsetRef = useRef<number>(0)

  // Clock
  const [currentTime, setCurrentTime] = useState<Date>(new Date())

  // Form Field: APENAS PIN do funcionário
  const [pin, setPin] = useState<string>('')

  // Status & Confirmation
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [confirmation, setConfirmation] = useState<RegistroPontoResult | null>(null)
  const [countdown, setCountdown] = useState<number>(4)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLocked, setIsLocked] = useState<boolean>(false)

  const pinInputRef = useRef<HTMLInputElement>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
        // Estimated server time when response arrived = serverTimestampMs + roundTripLatency
        // Offset = estimatedServerTimeNow - clientNow
        const nowAtArrival = Date.now()
        serverOffsetRef.current = serverTimestampMs + roundTripLatency - nowAtArrival
        setCurrentTime(new Date(Date.now() + serverOffsetRef.current))
      }

      setTerminalInfo(info)
      setIsOnline(true)
    } catch {
      setIsOnline(false)
    } finally {
      setCheckingConnection(false)
    }
  }, [])

  useEffect(() => {
    checkStatus()
    const interval = setInterval(() => {
      checkStatus()
    }, 30000)
    return () => clearInterval(interval)
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

  // 5. Interceptação global de teclado durante a tela de confirmação:
  // Se o próximo funcionário na fila começar a digitar seu PIN no teclado físico/numérico,
  // avança imediatamente para a tela de PIN já com o dígito inicial preenchido sem perder a tecla.
  useEffect(() => {
    if (!confirmation) return

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignorar teclas modificadoras ou combinações
      if (e.ctrlKey || e.metaKey || e.altKey) return

      // Teclas numéricas do teclado padrão (0-9) e teclado numérico lateral (Numpad0-Numpad9)
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
    // Se estiver em confirmação e tocar no teclado virtual, inicia o próximo registro imediatamente
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

    // Number keys: PIN 4 a 6 dígitos
    if (pin.length < 6) {
      setPin((prev) => prev + val)
    }
  }

  // Generate idempotency key (client generated UUID + timestamp)
  const generateIdempotencyKey = () => {
    const randomHex =
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    return `req_${Date.now()}_${randomHex}`
  }

  // Submit time punch (APENAS PIN)
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

    // Unique idempotency key
    const idRequisicao = generateIdempotencyKey()

    const clientReqTime = Date.now()

    try {
      const res = await terminalService.registrarPonto({
        matricula: '', // Requisito: apenas PIN, sem matrícula
        pin: cleanPin,
        id_requisicao: idRequisicao,
      })
      const clientResTime = Date.now()

      if (res.success) {
        // Se a resposta contiver o timestamp oficial do servidor gravado, sincronizar o offset
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
      } else {
        setErrorMessage(res.message || res.mensagem || 'Falha ao registrar ponto. Tente novamente.')
      }
    } catch (err: any) {
      console.error('Erro no registro de ponto:', err)
      const data = err?.data || err?.response?.data || {}
      const status = err?.status || err?.response?.status

      if (status === 429 || data.locked) {
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
      } else if (status === 0 || !navigator.onLine) {
        setIsOnline(false)
        setErrorMessage(
          'Atenção: Sem conexão com o servidor. A marcação NÃO foi confirmada. Verifique sua rede e tente novamente.',
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
              />{' '}
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
      {/* 2. Main Content / Centro */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          {confirmation ? (
            /* Confirmation Success Screen with Countdown */
            <div className="bg-white rounded-2xl border-2 border-emerald-500 p-6 sm:p-8 shadow-xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-12 h-12" />
              </div>

              {(() => {
                const isRepetida = Boolean(confirmation.idempotent || confirmation.deduplicated)

                // Formatação garantida em America/Sao_Paulo a partir do timestamp_utc gravado
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

                // Horário simples HH:MM para subtítulo amigável
                const horaSimples = displayTime ? displayTime.slice(0, 5) : ''

                return (
                  <>
                    <div>
                      {/* Badge amigável sem jargão técnico */}
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
                        {isRepetida
                          ? 'Você já bateu o ponto agora'
                          : 'Ponto Registrado com Sucesso'}
                      </span>
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
                          Horário oficial do servidor registrado de forma persistente e imutável
                        </p>
                      )}
                    </div>

                    {/* Data & Horário Oficial Boxes — 100% derivado da gravação no banco */}
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

                    {/* Identificador Único discreto/pequeno */}
                    <div className="py-1.5 px-3 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between text-[11px] text-slate-500">
                      <span className="text-slate-400">Identificador:</span>
                      <span className="font-mono text-[10px] text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
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
          {/* Orientation message */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
            <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
              Aproxime-se do terminal, digite seu PIN individual e pressione{' '}
              <strong className="text-amber-200">Confirmar Ponto</strong>.
            </p>
          </div>

          {/* Server Connection Status Indicator & Fullscreen Button */}
          <div className="flex items-center gap-2.5 shrink-0">
            {isOnline ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span>Terminal Online</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                <WifiOff className="w-3.5 h-3.5 text-red-600" />
                <span>Desconectado</span>
              </span>
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
