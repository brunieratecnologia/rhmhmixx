import React, { useState, useEffect, useRef, useCallback } from 'react'
import { terminalService, type TerminalInfo, type RegistroPontoResult } from '@/services/rh'
import pb from '@/lib/pocketbase/client'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function TerminalPonto() {
  // Terminal Status & Company Info
  const [terminalInfo, setTerminalInfo] = useState<TerminalInfo | null>(null)
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [checkingConnection, setCheckingConnection] = useState<boolean>(false)

  // Clock
  const [currentTime, setCurrentTime] = useState<Date>(new Date())

  // Form Fields
  const [matricula, setMatricula] = useState<string>('')
  const [pin, setPin] = useState<string>('')
  const [focusedField, setFocusedField] = useState<'matricula' | 'pin'>('matricula')

  // Status & Confirmation
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [confirmation, setConfirmation] = useState<RegistroPontoResult | null>(null)
  const [countdown, setCountdown] = useState<number>(8)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLocked, setIsLocked] = useState<boolean>(false)

  const matriculaInputRef = useRef<HTMLInputElement>(null)
  const pinInputRef = useRef<HTMLInputElement>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 1. Digital Clock update every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // 2. Fetch Terminal Info & check connection
  const checkStatus = useCallback(async () => {
    try {
      setCheckingConnection(true)
      const info = await terminalService.getInfo()
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
    // Poll connection every 30 seconds
    const interval = setInterval(() => {
      checkStatus()
    }, 30000)
    return () => clearInterval(interval)
  }, [checkStatus])

  // 3. Clear Confirmation and Reset
  const resetForm = useCallback(() => {
    setMatricula('')
    setPin('')
    setConfirmation(null)
    setErrorMessage(null)
    setIsLocked(false)
    setFocusedField('matricula')
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    setTimeout(() => {
      matriculaInputRef.current?.focus()
    }, 100)
  }, [])

  // 4. Handle Confirmation Countdown
  useEffect(() => {
    if (confirmation) {
      setCountdown(8)
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

  // Virtual Keypad Handler
  const handleKeypadPress = (val: string) => {
    if (confirmation) return
    setErrorMessage(null)

    if (val === 'clear') {
      if (focusedField === 'matricula') setMatricula('')
      else setPin('')
      return
    }

    if (val === 'backspace') {
      if (focusedField === 'matricula') {
        setMatricula((prev) => prev.slice(0, -1))
      } else {
        setPin((prev) => prev.slice(0, -1))
      }
      return
    }

    // Number keys
    if (focusedField === 'matricula') {
      if (matricula.length < 15) {
        setMatricula((prev) => prev + val)
      }
    } else {
      if (pin.length < 6) {
        setPin((prev) => prev + val)
      }
    }
  }

  // Generate idempotency key (client generated UUID + timestamp)
  const generateIdempotencyKey = () => {
    const randomHex =
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    return `req_${Date.now()}_${randomHex}`
  }

  // Submit time punch
  const handleRegisterPonto = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (submitting) return

    const cleanMatricula = matricula.trim().toUpperCase()
    const cleanPin = pin.trim()

    if (!cleanMatricula) {
      setErrorMessage('Por favor, informe o seu número de matrícula.')
      setFocusedField('matricula')
      matriculaInputRef.current?.focus()
      return
    }

    if (!cleanPin) {
      setErrorMessage('Por favor, digite o seu PIN de 4 a 6 dígitos.')
      setFocusedField('pin')
      pinInputRef.current?.focus()
      return
    }

    if (cleanPin.length < 4 || cleanPin.length > 6) {
      setErrorMessage('O PIN deve conter entre 4 e 6 dígitos.')
      setFocusedField('pin')
      pinInputRef.current?.focus()
      return
    }

    setSubmitting(true)
    setErrorMessage(null)
    setIsLocked(false)

    // Generate unique idempotency key
    const idRequisicao = generateIdempotencyKey()

    try {
      const res = await terminalService.registrarPonto({
        matricula: cleanMatricula,
        pin: cleanPin,
        id_requisicao: idRequisicao,
      })

      if (res.success) {
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
            'Terminal temporariamente bloqueado para esta matrícula por excesso de tentativas incorretas. Tente novamente mais tarde.',
        )
      } else if (status === 401) {
        setErrorMessage(data.message || 'Matrícula ou PIN inválido.')
        setPin('')
        setFocusedField('pin')
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

  // Formatting Clock display (24h)
  const hours = String(currentTime.getHours()).padStart(2, '0')
  const minutes = String(currentTime.getMinutes()).padStart(2, '0')
  const seconds = String(currentTime.getSeconds()).padStart(2, '0')
  const dateFormatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(currentTime)
  const shortDateBR = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(currentTime)

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
    'Sistema de Recursos Humanos'

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col justify-between text-slate-900 select-none">
      {/* 1. Header / Topo */}
      <header className="bg-white border-b border-[#E2E8F0] shadow-xs px-4 sm:px-8 py-3 sm:py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Company info */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {companyLogoUrl ? (
              <img
                src={companyLogoUrl}
                alt={companyDisplayName}
                className="w-10 h-10 sm:w-12 sm:h-12 object-contain rounded-xl border border-slate-100 shadow-xs shrink-0"
              />
            ) : (
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#2563EB] flex items-center justify-center text-white shrink-0 font-bold text-base sm:text-lg shadow-xs">
                RH
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                {companyDisplayName}
              </h1>
              <p className="text-xs text-slate-500 font-medium">Terminal Eletrônico de Registro</p>
            </div>
          </div>

          {/* Large Digital Clock */}
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5 font-mono text-2xl sm:text-4xl font-extrabold text-[#1E3A8A] tracking-wider drop-shadow-xs">
              <span>{hours}</span>
              <span className="animate-pulse text-[#2563EB]">:</span>
              <span>{minutes}</span>
              <span className="animate-pulse text-[#2563EB]">:</span>
              <span className="text-lg sm:text-2xl text-slate-600">{seconds}</span>
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500 font-medium capitalize mt-0.5">
              {shortDateBR} • <span className="capitalize">{dateFormatted}</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Content / Centro */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xl">
          {confirmation ? (
            /* Confirmation Success Screen with Countdown */
            <div className="bg-white rounded-2xl border-2 border-emerald-500 p-6 sm:p-8 shadow-xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-12 h-12" />
              </div>

              <div>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
                  {confirmation.idempotent
                    ? 'Marcação Confirmada (Preexistente)'
                    : 'Ponto Registrado com Sucesso'}
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {confirmation.funcionario_nome}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Horário oficial do servidor registrado de forma persistente e imutável
                </p>
              </div>

              {/* Data & Horário Oficial Boxes */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-center">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Data da Marcação
                  </span>
                  <span className="text-lg sm:text-xl font-bold font-mono text-slate-900 mt-1 block">
                    {confirmation.data_formatada || shortDateBR}
                  </span>
                </div>
                <div className="text-center border-l border-slate-200 pl-3">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Horário Oficial (SP)
                  </span>
                  <span className="text-lg sm:text-xl font-extrabold font-mono text-[#2563EB] mt-1 block">
                    {confirmation.horario_formatado || `${hours}:${minutes}:${seconds}`}
                  </span>
                </div>
              </div>

              {/* Identificador Único */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-left">
                <div className="flex items-center justify-between text-xs text-[#1E3A8A] font-semibold">
                  <span>Identificador Único do Registro:</span>
                  <span className="font-mono text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded border border-blue-200">
                    {confirmation.identificador || 'N/A'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Fuso horário oficial: {confirmation.fuso_horario || 'America/Sao_Paulo'} (UTC:{' '}
                  {confirmation.timestamp_utc?.slice(11, 19)})
                </div>
              </div>

              {/* Automatic Countdown return */}
              <div className="pt-2 flex flex-col items-center gap-3">
                <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#2563EB] animate-spin" />
                  Retornando à tela inicial em{' '}
                  <span className="font-mono text-sm font-bold text-[#2563EB]">{countdown}s</span>
                </p>

                <Button
                  onClick={resetForm}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm px-6 h-10 shadow-sm"
                >
                  Novo Registro Agora
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            </div>
          ) : (
            /* Terminal Input Card with Virtual Keypad */
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-7 shadow-lg space-y-5">
              {/* Card Title */}
              <div className="text-center pb-2 border-b border-slate-100">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  Registro de Horário de Trabalho
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Informe sua matrícula e seu PIN individual de 4 a 6 dígitos
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

              {/* Inputs Form */}
              <form onSubmit={handleRegisterPonto} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Campo Matrícula */}
                  <div
                    onClick={() => {
                      setFocusedField('matricula')
                      matriculaInputRef.current?.focus()
                    }}
                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${
                      focusedField === 'matricula'
                        ? 'border-[#2563EB] bg-blue-50/30 ring-2 ring-[#2563EB]/15'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                      Matrícula
                    </label>
                    <input
                      ref={matriculaInputRef}
                      type="text"
                      inputMode="numeric"
                      value={matricula}
                      placeholder="Ex: 001"
                      onFocus={() => setFocusedField('matricula')}
                      onChange={(e) => setMatricula(e.target.value.toUpperCase())}
                      className="w-full bg-transparent font-mono text-xl sm:text-2xl font-bold text-slate-900 tracking-wider focus:outline-none placeholder:text-slate-300 mt-1"
                      autoComplete="off"
                    />
                  </div>

                  {/* Campo PIN */}
                  <div
                    onClick={() => {
                      setFocusedField('pin')
                      pinInputRef.current?.focus()
                    }}
                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${
                      focusedField === 'pin'
                        ? 'border-[#2563EB] bg-blue-50/30 ring-2 ring-[#2563EB]/15'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                        PIN de Acesso
                      </label>
                      <span className="text-[10px] text-slate-400 font-medium">4 a 6 dígitos</span>
                    </div>
                    <input
                      ref={pinInputRef}
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={pin}
                      placeholder="••••"
                      onFocus={() => setFocusedField('pin')}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full bg-transparent font-mono text-xl sm:text-2xl font-bold text-slate-900 tracking-widest focus:outline-none placeholder:text-slate-300 mt-1"
                      autoComplete="off"
                    />
                  </div>
                </div>

                {/* Virtual Keypad (Touch Screen Friendly) */}
                <div className="bg-slate-100/80 p-3 rounded-xl border border-slate-200">
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleKeypadPress(String(num))}
                        className="h-12 sm:h-14 bg-white hover:bg-blue-50 active:bg-blue-100 rounded-xl text-lg sm:text-xl font-bold text-slate-800 border border-slate-200/80 shadow-xs hover:border-[#2563EB]/40 transition-all flex items-center justify-center active:scale-95"
                      >
                        {num}
                      </button>
                    ))}

                    {/* Clear Button */}
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('clear')}
                      className="h-12 sm:h-14 bg-slate-200/80 hover:bg-slate-300 active:bg-slate-400 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 border border-slate-300/80 transition-all flex flex-col items-center justify-center active:scale-95 gap-0.5"
                    >
                      <RotateCcw className="w-4 h-4 text-slate-500" />
                      <span>Limpar</span>
                    </button>

                    {/* Zero */}
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('0')}
                      className="h-12 sm:h-14 bg-white hover:bg-blue-50 active:bg-blue-100 rounded-xl text-lg sm:text-xl font-bold text-slate-800 border border-slate-200/80 shadow-xs hover:border-[#2563EB]/40 transition-all flex items-center justify-center active:scale-95"
                    >
                      0
                    </button>

                    {/* Backspace Button */}
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('backspace')}
                      className="h-12 sm:h-14 bg-slate-200/80 hover:bg-slate-300 active:bg-slate-400 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 border border-slate-300/80 transition-all flex flex-col items-center justify-center active:scale-95 gap-0.5"
                    >
                      <Delete className="w-4 h-4 text-slate-500" />
                      <span>Apagar</span>
                    </button>
                  </div>
                </div>

                {/* Big Action Button "REGISTRAR PONTO" */}
                <Button
                  type="submit"
                  disabled={submitting || !matricula || !pin}
                  className="w-full h-14 bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E3A8A] text-white font-extrabold text-base sm:text-lg rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>REGISTRANDO NO SERVIDOR...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>REGISTRAR PONTO</span>
                    </>
                  )}
                </Button>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* 3. Footer / Base */}
      <footer className="bg-white border-t border-[#E2E8F0] px-4 sm:px-8 py-3 text-xs text-slate-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          {/* Orientation message */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
            <p className="text-[11px] sm:text-xs text-slate-600 font-medium">
              Aproxime-se do terminal, digite sua matrícula e PIN e pressione{' '}
              <strong className="text-slate-800">Registrar Ponto</strong>.
            </p>
          </div>

          {/* Server Connection Status Indicator */}
          <div className="flex items-center gap-2 shrink-0">
            {isOnline ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span>Servidor Online</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                <WifiOff className="w-3.5 h-3.5 text-red-600" />
                <span>Desconectado</span>
              </span>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
