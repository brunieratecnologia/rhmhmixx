import React, { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { funcionariosService, feriasService, ausenciasService } from '@/services/rh'
import type { Funcionario, Ferias, Ausencia } from '@/types/rh'
import {
  calcularPeriodosColaborador,
  validarRegrasFerias,
  PeriodoAquisitivoCalculado,
} from '@/lib/calculoFerias'
import { formatBRDate } from '@/lib/formatters'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import {
  Palmtree,
  CalendarDays,
  Users,
  AlertTriangle,
  Clock,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  CalendarClock,
  Info,
  CalendarCheck2,
  ChevronRight,
  UserCheck,
  Building2,
  AlertCircle,
  HelpCircle,
  ShieldAlert,
  FileText,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

export default function FeriasPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [todasFerias, setTodasFerias] = useState<Ferias[]>([])
  const [todasAusencias, setTodasAusencias] = useState<Ausencia[]>([])

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [alertaFilter, setAlertaFilter] = useState<string>('todos')

  // Visualização: 'geral' ou funcionário específico selecionado
  const selectedFuncId = searchParams.get('funcionarioId') || ''

  // Modal de Cadastro/Edição de Férias
  const [modalOpen, setModalOpen] = useState(false)
  const [editingFerias, setEditingFerias] = useState<Ferias | null>(null)
  const [saving, setSaving] = useState(false)

  // Form State
  const [formFuncId, setFormFuncId] = useState('')
  const [formDataInicio, setFormDataInicio] = useState('')
  const [formDataFim, setFormDataFim] = useState('')
  const [formDiasAbono, setFormDiasAbono] = useState<number>(0)
  const [formStatus, setFormStatus] = useState<Ferias['status']>('programada')
  const [formTipo, setFormTipo] = useState<'integral' | 'fracionada'>('integral')
  const [formObservacoes, setFormObservacoes] = useState('')
  const [formJustificativaRh, setFormJustificativaRh] = useState('')
  const [formPeriodoIndex, setFormPeriodoIndex] = useState<number | null>(null)

  // Validação em tempo real
  const [validationResult, setValidationResult] = useState<{
    valido: boolean
    erros: string[]
    avisos: string[]
    diasCalculados: number
  }>({
    valido: true,
    erros: [],
    avisos: [],
    diasCalculados: 0,
  })

  // Carrega dados iniciais
  const loadData = async () => {
    setLoading(true)
    try {
      const [funcsRes, feriasRes, ausenciasRes] = await Promise.all([
        funcionariosService.list(1, 200, '', 'nome'),
        feriasService.listAll('', '-data_inicio'),
        ausenciasService.listAll('', '-data_inicio'),
      ])
      setFuncionarios(funcsRes.items)
      setTodasFerias(feriasRes)
      setTodasAusencias(ausenciasRes)
    } catch (err: any) {
      console.error('Erro ao carregar dados de férias:', err)
      toast({
        title: 'Erro ao carregar módulo de férias',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    // Realtime subscriptions
    const unsubs: (() => void)[] = []
    ;['ferias', 'funcionarios', 'ausencias'].forEach((col) => {
      pb.collection(col)
        .subscribe('*', () => {
          loadData()
        })
        .then((u) => unsubs.push(u))
        .catch(() => {})
    })

    return () => {
      unsubs.forEach((u) => u())
    }
  }, [])

  // Mapa de cálculos por funcionário
  const calculosPorFuncionario = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calcularPeriodosColaborador>>()
    for (const func of funcionarios) {
      const feriasFunc = todasFerias.filter((f) => f.funcionario === func.id)
      const ausenciasFunc = todasAusencias.filter((a) => a.funcionario === func.id)
      const calc = calcularPeriodosColaborador({
        dataAdmissao: func.data_admissao,
        feriasCadastradas: feriasFunc,
        ausencias: ausenciasFunc,
      })
      map.set(func.id, calc)
    }
    return map
  }, [funcionarios, todasFerias, todasAusencias])

  // Indicadores Gerais
  const resumoGeral = useMemo(() => {
    const hojeStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())

    let totalEmGozo = 0
    let totalProgramadas30d = 0
    let totalAlertasConcessivos = 0
    let totalVencidas = 0

    const trintaDias = new Date()
    trintaDias.setDate(trintaDias.getDate() + 30)
    const trintaDiasStr = trintaDias.toISOString().split('T')[0]

    for (const f of todasFerias) {
      if (f.status === 'cancelada') continue
      const ini = f.data_inicio.split('T')[0]
      const fim = f.data_fim.split('T')[0]
      if (hojeStr >= ini && hojeStr <= fim) {
        totalEmGozo++
      }
      if (ini >= hojeStr && ini <= trintaDiasStr && f.status !== 'concluida') {
        totalProgramadas30d++
      }
    }

    calculosPorFuncionario.forEach((calc) => {
      for (const p of calc.periodos) {
        if (p.situacao === 'vencido') {
          totalVencidas++
        } else if (p.alertaVencimento !== 'normal') {
          totalAlertasConcessivos++
        }
      }
    })

    return {
      totalEmGozo,
      totalProgramadas30d,
      totalAlertasConcessivos,
      totalVencidas,
      totalAtivos: funcionarios.filter((f) => f.situacao === 'ativo' || f.situacao === 'em_ferias')
        .length,
    }
  }, [todasFerias, calculosPorFuncionario, funcionarios])

  // Funcionário selecionado para visão detalhada
  const funcionarioSelecionado = useMemo(() => {
    if (!selectedFuncId) return null
    return funcionarios.find((f) => f.id === selectedFuncId) || null
  }, [selectedFuncId, funcionarios])

  const calculoFuncionarioSelecionado = useMemo(() => {
    if (!funcionarioSelecionado) return null
    return calculosPorFuncionario.get(funcionarioSelecionado.id) || null
  }, [funcionarioSelecionado, calculosPorFuncionario])

  const feriasDoFuncionarioSelecionado = useMemo(() => {
    if (!funcionarioSelecionado) return []
    return todasFerias.filter((f) => f.funcionario === funcionarioSelecionado.id)
  }, [funcionarioSelecionado, todasFerias])

  // Filtragem da lista geral de funcionários
  const funcionariosFiltrados = useMemo(() => {
    return funcionarios.filter((func) => {
      const calc = calculosPorFuncionario.get(func.id)

      // Busca texto (nome ou matrícula)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const nomeMatch = func.nome.toLowerCase().includes(term)
        const matMatch = func.matricula.toLowerCase().includes(term)
        if (!nomeMatch && !matMatch) return false
      }

      // Filtro de Alerta Concessivo
      if (alertaFilter !== 'todos') {
        if (!calc) return false
        if (alertaFilter === 'com_alerta' && !calc.temAlertaConcessivo) return false
        if (
          alertaFilter === 'urgente_15' &&
          !calc.periodos.some((p) => p.alertaVencimento === 'urgente_15')
        )
          return false
        if (
          alertaFilter === 'alerta_30' &&
          !calc.periodos.some((p) => p.alertaVencimento === 'alerta_30')
        )
          return false
        if (
          alertaFilter === 'vencido' &&
          !calc.periodos.some((p) => p.alertaVencimento === 'vencido')
        )
          return false
      }

      // Filtro de Status
      if (statusFilter !== 'todos') {
        if (statusFilter === 'em_ferias' && func.situacao !== 'em_ferias') return false
        if (statusFilter === 'ativo' && func.situacao !== 'ativo') return false
        if (statusFilter === 'com_saldo' && (calc?.saldoTotalDisponivel || 0) <= 0) return false
      }

      return true
    })
  }, [funcionarios, searchTerm, alertaFilter, statusFilter, calculosPorFuncionario])

  // Validação ao mudar campos no modal
  useEffect(() => {
    if (!modalOpen || !formFuncId) return

    const calc = calculosPorFuncionario.get(formFuncId)
    const saldoTotal = calc ? calc.saldoTotalDisponivel : 30
    const feriasExistentes = todasFerias.filter(
      (f) => f.funcionario === formFuncId && (!editingFerias || f.id !== editingFerias.id),
    )

    let perSel: PeriodoAquisitivoCalculado | undefined = undefined
    if (calc && formPeriodoIndex !== null && calc.periodos[formPeriodoIndex]) {
      perSel = calc.periodos[formPeriodoIndex]
    }

    const res = validarRegrasFerias({
      dataInicio: formDataInicio,
      dataFim: formDataFim,
      diasAbono: Number(formDiasAbono) || 0,
      saldoDisponivel: perSel ? perSel.saldoRemanescente : saldoTotal,
      feriasExistentesMesmoPeriodo: feriasExistentes,
      periodoAquisitivo: perSel,
    })

    setValidationResult(res)

    // Ajusta o tipo automaticamente
    if (res.diasCalculados > 0 && res.diasCalculados < 30) {
      setFormTipo('fracionada')
    } else if (res.diasCalculados >= 30) {
      setFormTipo('integral')
    }
  }, [
    modalOpen,
    formFuncId,
    formDataInicio,
    formDataFim,
    formDiasAbono,
    formPeriodoIndex,
    editingFerias,
    calculosPorFuncionario,
    todasFerias,
  ])

  // Abrir Modal para Novo Cadastro
  const handleOpenNewModal = (funcId?: string) => {
    const targetId = funcId || selectedFuncId || (funcionarios[0]?.id ?? '')
    setEditingFerias(null)
    setFormFuncId(targetId)

    // Datas padrão: sugerir a partir de 30 dias à frente
    const in30 = new Date()
    in30.setDate(in30.getDate() + 30)
    const in30Str = in30.toISOString().split('T')[0]

    const in60 = new Date(in30)
    in60.setDate(in60.getDate() + 29)
    const in60Str = in60.toISOString().split('T')[0]

    setFormDataInicio(in30Str)
    setFormDataFim(in60Str)
    setFormDiasAbono(0)
    setFormStatus('programada')
    setFormTipo('integral')
    setFormObservacoes('')
    setFormJustificativaRh('')
    setFormPeriodoIndex(null)
    setModalOpen(true)
  }

  // Abrir Modal para Edição
  const handleOpenEditModal = (ferias: Ferias) => {
    setEditingFerias(ferias)
    setFormFuncId(ferias.funcionario)
    setFormDataInicio(ferias.data_inicio.split('T')[0])
    setFormDataFim(ferias.data_fim.split('T')[0])
    setFormDiasAbono(ferias.dias_abono || 0)
    setFormStatus(ferias.status)
    setFormTipo(ferias.tipo || 'integral')
    setFormObservacoes(ferias.observacoes || '')
    setFormJustificativaRh(ferias.justificativa_rh || '')

    // Tentar achar índice do período aquisitivo
    const calc = calculosPorFuncionario.get(ferias.funcionario)
    if (calc && ferias.periodo_aquisitivo_inicio) {
      const idx = calc.periodos.findIndex(
        (p) => p.inicio === ferias.periodo_aquisitivo_inicio?.split('T')[0],
      )
      setFormPeriodoIndex(idx >= 0 ? idx : null)
    } else {
      setFormPeriodoIndex(null)
    }

    setModalOpen(true)
  }

  // Salvar Férias (Criar / Editar)
  const handleSubmitFerias = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validationResult.valido) {
      toast({
        title: 'Verifique as pendências',
        description: validationResult.erros[0] || 'Dados inválidos.',
        variant: 'destructive',
      })
      return
    }

    if (validationResult.avisos.length > 0 && !formJustificativaRh.trim()) {
      toast({
        title: 'Justificativa do RH obrigatória',
        description:
          'Existem alertas legais de saldo ou fracionamento CLT. Informe a justificativa da decisão do RH.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const calc = calculosPorFuncionario.get(formFuncId)
      let periodoSelecionado: PeriodoAquisitivoCalculado | undefined = undefined
      if (calc && formPeriodoIndex !== null && calc.periodos[formPeriodoIndex]) {
        periodoSelecionado = calc.periodos[formPeriodoIndex]
      } else if (calc && calc.periodos.length > 0) {
        // Seleciona o primeiro período com saldo ou o mais antigo completo
        periodoSelecionado = calc.periodos.find((p) => p.saldoRemanescente > 0) || calc.periodos[0]
      }

      const payload: Partial<Ferias> = {
        funcionario: formFuncId,
        data_inicio: formDataInicio,
        data_fim: formDataFim,
        dias: validationResult.diasCalculados,
        dias_abono: Number(formDiasAbono) || 0,
        tipo: formTipo,
        status: formStatus,
        periodo_aquisitivo_inicio: periodoSelecionado ? periodoSelecionado.inicio : undefined,
        periodo_aquisitivo_fim: periodoSelecionado ? periodoSelecionado.fim : undefined,
        periodo_concessivo_fim: periodoSelecionado
          ? periodoSelecionado.limiteConcessivo
          : undefined,
        saldo_dias: periodoSelecionado ? periodoSelecionado.saldoRemanescente : undefined,
        observacoes: formObservacoes.trim(),
        justificativa_rh: formJustificativaRh.trim(),
        usuario_responsavel: user?.id,
      }

      if (editingFerias) {
        await feriasService.update(editingFerias.id, payload)
        toast({
          title: 'Férias atualizadas com sucesso.',
          className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        })
      } else {
        await feriasService.create(payload)
        toast({
          title: 'Período de férias cadastrado com sucesso.',
          className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        })
      }

      setModalOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar férias',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Cancelar férias
  const handleCancelarFerias = async (feriasId: string) => {
    if (
      !window.confirm(
        'Deseja realmente marcar este período de férias como cancelado? O saldo de dias será restaurado.',
      )
    ) {
      return
    }

    try {
      await feriasService.update(feriasId, { status: 'cancelada' })
      toast({
        title: 'Férias canceladas',
        description: 'O período foi cancelado e o saldo restaurado ao colaborador.',
      })
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao cancelar férias',
        description: err?.message,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
              <Palmtree className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Gestão de Férias</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Controle de períodos aquisitivos, concessivos CLT, fracionamentos e abonos
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedFuncId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchParams({})}
              className="text-xs h-9 border-slate-200 text-slate-700"
            >
              ← Voltar à Visão Geral
            </Button>
          )}

          <Button
            onClick={() => handleOpenNewModal()}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold h-9 px-3.5 shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Cadastrar Período de Férias
          </Button>
        </div>
      </div>

      {/* Indicadores de Alto Nível */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Em Férias Hoje</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Palmtree className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {resumoGeral.totalEmGozo}
          </p>
          <span className="text-[11px] text-slate-500 block mt-0.5">
            Colaboradores ausentes por férias
          </span>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Próximos 30 Dias</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center">
              <CalendarClock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {resumoGeral.totalProgramadas30d}
          </p>
          <span className="text-[11px] text-slate-500 block mt-0.5">
            Férias com início agendado
          </span>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 uppercase">
              Alertas Concessivos
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-amber-700 mt-2">
            {resumoGeral.totalAlertasConcessivos}
          </p>
          <span className="text-[11px] text-slate-500 block mt-0.5">Vencendo em até 60 dias</span>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-600 uppercase">Períodos Vencidos</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-red-600 mt-2">
            {resumoGeral.totalVencidas}
          </p>
          <span className="text-[11px] text-slate-500 block mt-0.5">
            Sujeito à dobra legal (art. 137 CLT)
          </span>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SELECIONADO: VISÃO DETALHADA DO FUNCIONÁRIO                   */}
      {/* ============================================================ */}
      {funcionarioSelecionado && calculoFuncionarioSelecionado ? (
        <div className="space-y-6">
          {/* Card Resumo do Funcionário */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-100 text-[#2563EB] flex items-center justify-center font-bold text-base">
                  {funcionarioSelecionado.nome.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      {funcionarioSelecionado.nome}
                    </h3>
                    <Badge
                      className={
                        funcionarioSelecionado.situacao === 'em_ferias'
                          ? 'bg-amber-100 text-amber-800'
                          : funcionarioSelecionado.situacao === 'ativo'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                      }
                    >
                      {funcionarioSelecionado.situacao === 'em_ferias'
                        ? 'Em Férias'
                        : funcionarioSelecionado.situacao === 'ativo'
                          ? 'Ativo'
                          : funcionarioSelecionado.situacao}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Matrícula: {funcionarioSelecionado.matricula} • Admissão:{' '}
                    <strong>{formatBRDate(funcionarioSelecionado.data_admissao)}</strong> • Vínculo:{' '}
                    {funcionarioSelecionado.tipo_vinculo || 'CLT'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link to={`/admin/funcionarios/${funcionarioSelecionado.id}`}>
                  <Button variant="outline" size="sm" className="text-xs h-8">
                    Ver Ficha Completa
                  </Button>
                </Link>
                <Button
                  size="sm"
                  onClick={() => handleOpenNewModal(funcionarioSelecionado.id)}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs h-8"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Programar Férias
                </Button>
              </div>
            </div>

            {/* Métricas do Colaborador */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase block">
                  Saldo Total Adquirido
                </span>
                <p className="text-xl font-bold text-emerald-700 font-mono mt-0.5">
                  {calculoFuncionarioSelecionado.saldoTotalDisponivel} dias
                </p>
                <span className="text-[11px] text-slate-500">Disponível para gozo imediato</span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase block">
                  Dias Gozados
                </span>
                <p className="text-xl font-bold text-slate-800 font-mono mt-0.5">
                  {calculoFuncionarioSelecionado.periodos.reduce(
                    (acc, p) => acc + p.diasGozados,
                    0,
                  )}{' '}
                  dias
                </p>
                <span className="text-[11px] text-slate-500">Histórico de descansos</span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase block">
                  Abonos Pecuniários
                </span>
                <p className="text-xl font-bold text-blue-700 font-mono mt-0.5">
                  {calculoFuncionarioSelecionado.periodos.reduce((acc, p) => acc + p.diasAbono, 0)}{' '}
                  dias
                </p>
                <span className="text-[11px] text-slate-500">Dias convertidos em abono</span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase block">
                  Próximas Férias
                </span>
                <p className="text-sm font-bold text-slate-800 mt-1">
                  {calculoFuncionarioSelecionado.proximasFerias
                    ? `${formatBRDate(calculoFuncionarioSelecionado.proximasFerias.data_inicio)} (${calculoFuncionarioSelecionado.proximasFerias.dias}d)`
                    : 'Nenhuma agendada'}
                </p>
                <span className="text-[11px] text-slate-500">Início previsto</span>
              </div>
            </div>
          </div>

          {/* Períodos Aquisitivos e Concessivos */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-[#2563EB]" />
                  Ciclos Aquisitivos e Limites Concessivos (CLT)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Calculados rigorosamente de 12 em 12 meses a partir da data de admissão (
                  {formatBRDate(funcionarioSelecionado.data_admissao)})
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Ciclo</th>
                    <th className="py-2.5 px-3">Período Aquisitivo</th>
                    <th className="py-2.5 px-3">Limite Concessivo</th>
                    <th className="py-2.5 px-3 text-center">Faltas Injust.</th>
                    <th className="py-2.5 px-3 text-center">Direito Base</th>
                    <th className="py-2.5 px-3 text-center">Gozados</th>
                    <th className="py-2.5 px-3 text-center">Abono</th>
                    <th className="py-2.5 px-3 text-center">Programados</th>
                    <th className="py-2.5 px-3 text-center font-bold">Saldo</th>
                    <th className="py-2.5 px-3">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calculoFuncionarioSelecionado.periodos.map((p) => {
                    return (
                      <tr
                        key={p.indice}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          p.alertaVencimento === 'urgente_15' || p.alertaVencimento === 'vencido'
                            ? 'bg-red-50/30'
                            : p.alertaVencimento === 'alerta_30' ||
                                p.alertaVencimento === 'alerta_60'
                              ? 'bg-amber-50/30'
                              : ''
                        }`}
                      >
                        <td className="py-3 px-3 font-mono font-bold text-slate-700">
                          {p.indice}º Ciclo
                        </td>
                        <td className="py-3 px-3 font-mono">
                          {formatBRDate(p.inicio)} a {formatBRDate(p.fim)}
                        </td>
                        <td className="py-3 px-3 font-mono">
                          <span
                            className={
                              p.alertaVencimento === 'vencido'
                                ? 'text-red-700 font-bold'
                                : p.alertaVencimento === 'urgente_15'
                                  ? 'text-red-600 font-bold'
                                  : p.alertaVencimento === 'alerta_30'
                                    ? 'text-amber-700 font-bold'
                                    : 'text-slate-700'
                            }
                          >
                            {formatBRDate(p.limiteConcessivo)}
                          </span>
                          {p.situacao !== 'em_aquisicao' && p.situacao !== 'quitado' && (
                            <span className="block text-[10px] text-slate-400">
                              {p.diasParaVencerConcessivo < 0
                                ? `Vencido há ${Math.abs(p.diasParaVencerConcessivo)} dias`
                                : `Faltam ${p.diasParaVencerConcessivo} dias`}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          {p.faltasInjustificadas > 0 ? (
                            <span
                              className="text-amber-700 font-semibold"
                              title={`${p.faltasInjustificadas} dia(s) de falta injustificada no período`}
                            >
                              {p.faltasInjustificadas}d
                            </span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          {p.diasDireitoAposFaltas}d
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-700">
                          {p.diasGozados > 0 ? `${p.diasGozados}d` : '—'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-700">
                          {p.diasAbono > 0 ? `${p.diasAbono}d` : '—'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-blue-700">
                          {p.diasProgramados > 0 ? `${p.diasProgramados}d` : '—'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700 text-sm">
                          {p.saldoRemanescente}d
                        </td>
                        <td className="py-3 px-3">
                          {p.situacao === 'em_aquisicao' && (
                            <Badge
                              variant="outline"
                              className="text-blue-700 border-blue-200 bg-blue-50"
                            >
                              Em Aquisição
                            </Badge>
                          )}
                          {p.situacao === 'quitado' && (
                            <Badge
                              variant="outline"
                              className="text-emerald-700 border-emerald-200 bg-emerald-50"
                            >
                              Quitado
                            </Badge>
                          )}
                          {p.situacao === 'vencido' && (
                            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                              <AlertTriangle className="w-3 h-3" />
                              Concessivo Vencido
                            </Badge>
                          )}
                          {p.situacao === 'aquisitivo_completo' && (
                            <>
                              {p.alertaVencimento === 'urgente_15' && (
                                <Badge className="bg-red-600 text-white flex items-center gap-1 w-fit">
                                  <AlertCircle className="w-3 h-3" />
                                  Vence em &lt;15d
                                </Badge>
                              )}
                              {p.alertaVencimento === 'alerta_30' && (
                                <Badge className="bg-amber-500 text-white flex items-center gap-1 w-fit">
                                  <AlertTriangle className="w-3 h-3" />
                                  Vence em &lt;30d
                                </Badge>
                              )}
                              {p.alertaVencimento === 'alerta_60' && (
                                <Badge className="bg-amber-100 text-amber-900 border border-amber-300 w-fit">
                                  Vence em &lt;60d
                                </Badge>
                              )}
                              {p.alertaVencimento === 'normal' && (
                                <Badge
                                  variant="outline"
                                  className="text-slate-700 border-slate-300"
                                >
                                  Adquirido
                                </Badge>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Histórico de Períodos de Férias Cadastrados */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CalendarCheck2 className="w-4 h-4 text-[#2563EB]" />
                  Histórico de Férias Agendadas e Concluídas
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Registros de gozo, fracionamento, abono pecuniário e observações
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => handleOpenNewModal(funcionarioSelecionado.id)}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs h-8"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Novo Agendamento
              </Button>
            </div>

            {feriasDoFuncionarioSelecionado.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50">
                <p className="text-xs text-slate-500">
                  Nenhum período de férias cadastrado para este colaborador.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                      <th className="py-2.5 px-3">Período de Gozo</th>
                      <th className="py-2.5 px-3 text-center">Dias Gozo</th>
                      <th className="py-2.5 px-3 text-center">Dias Abono</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Situação</th>
                      <th className="py-2.5 px-3">Observações / Justificativa RH</th>
                      <th className="py-2.5 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {feriasDoFuncionarioSelecionado.map((f) => {
                      return (
                        <tr key={f.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-3 font-mono font-medium text-slate-800">
                            {formatBRDate(f.data_inicio)} a {formatBRDate(f.data_fim)}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">
                            {f.dias} dias
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-slate-700">
                            {f.dias_abono ? `${f.dias_abono} dias` : '—'}
                          </td>
                          <td className="py-3 px-3 capitalize">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                              {f.tipo || 'integral'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <Badge
                              className={
                                f.status === 'em_gozo'
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : f.status === 'concluida'
                                    ? 'bg-slate-100 text-slate-700 border-slate-300'
                                    : f.status === 'programada' || f.status === 'aprovado'
                                      ? 'bg-blue-100 text-[#1E3A8A] border-blue-300'
                                      : 'bg-red-50 text-red-700 border-red-200'
                              }
                            >
                              {f.status === 'programada'
                                ? 'Programada'
                                : f.status === 'em_gozo'
                                  ? 'Em Gozo'
                                  : f.status === 'concluida'
                                    ? 'Concluída'
                                    : f.status === 'cancelada'
                                      ? 'Cancelada'
                                      : f.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 max-w-xs text-slate-600">
                            {f.observacoes && <p className="truncate">{f.observacoes}</p>}
                            {f.justificativa_rh && (
                              <p className="text-[10px] text-amber-800 font-medium mt-0.5 truncate">
                                RH: {f.justificativa_rh}
                              </p>
                            )}
                            {!f.observacoes && !f.justificativa_rh && (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEditModal(f)}
                                className="h-7 px-2 text-[11px] border-slate-200 text-slate-700"
                              >
                                Editar
                              </Button>
                              {f.status !== 'cancelada' && f.status !== 'concluida' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelarFerias(f.id)}
                                  className="h-7 px-2 text-[11px] text-red-600 hover:bg-red-50"
                                >
                                  Cancelar
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ============================================================ */
        /* VISÃO GERAL: TABELA DE TODOS OS FUNCIONÁRIOS ATIVOS          */
        /* ============================================================ */
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden space-y-4">
          {/* Barra de Filtros e Busca */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por colaborador ou matrícula..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Filtro Alerta Concessivo */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium">Alerta:</span>
                <Select value={alertaFilter} onValueChange={setAlertaFilter}>
                  <SelectTrigger className="text-xs h-9 w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Alertas</SelectItem>
                    <SelectItem value="com_alerta">Com Qualquer Alerta</SelectItem>
                    <SelectItem value="urgente_15">Urgente (&lt;15 dias)</SelectItem>
                    <SelectItem value="alerta_30">Alerta (&lt;30 dias)</SelectItem>
                    <SelectItem value="vencido">Concessivo Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro Situação */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium">Situação:</span>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="text-xs h-9 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    <SelectItem value="ativo">Ativos</SelectItem>
                    <SelectItem value="em_ferias">Em Férias</SelectItem>
                    <SelectItem value="com_saldo">Com Saldo &gt; 0</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Tabela de Colaboradores */}
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Calculando períodos de férias...</p>
            </div>
          ) : funcionariosFiltrados.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Nenhum funcionário encontrado com os filtros aplicados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-3">Admissão</th>
                    <th className="py-3 px-3 text-center">Saldo Adquirido</th>
                    <th className="py-3 px-3 text-center">Dias Gozados</th>
                    <th className="py-3 px-3 text-center">Próximas Férias</th>
                    <th className="py-3 px-3">Alerta Limite Concessivo</th>
                    <th className="py-3 px-3">Situação</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {funcionariosFiltrados.map((func) => {
                    const calc = calculosPorFuncionario.get(func.id)
                    const proxFerias = calc?.proximasFerias

                    // Período com maior urgência
                    const piorPeriodo = calc?.periodos.find(
                      (p) =>
                        p.alertaVencimento === 'vencido' ||
                        p.alertaVencimento === 'urgente_15' ||
                        p.alertaVencimento === 'alerta_30' ||
                        p.alertaVencimento === 'alerta_60',
                    )

                    return (
                      <tr
                        key={func.id}
                        className={`hover:bg-slate-50/90 transition-colors ${
                          piorPeriodo?.alertaVencimento === 'vencido' ||
                          piorPeriodo?.alertaVencimento === 'urgente_15'
                            ? 'bg-red-50/20'
                            : piorPeriodo?.alertaVencimento === 'alerta_30'
                              ? 'bg-amber-50/20'
                              : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <button
                            onClick={() => setSearchParams({ funcionarioId: func.id })}
                            className="text-left group focus:outline-none"
                          >
                            <span className="font-bold text-slate-900 group-hover:text-[#2563EB] group-hover:underline block">
                              {func.nome}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              Matrícula: {func.matricula} • {func.expand?.cargo?.nome || 'Cargo'}
                            </span>
                          </button>
                        </td>

                        <td className="py-3 px-3 font-mono text-slate-700">
                          {formatBRDate(func.data_admissao)}
                        </td>

                        <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700 text-sm">
                          {calc?.saldoTotalDisponivel ?? 0}d
                        </td>

                        <td className="py-3 px-3 text-center font-mono text-slate-700">
                          {(calc?.periodos || []).reduce((acc, p) => acc + p.diasGozados, 0)}d
                        </td>

                        <td className="py-3 px-3 text-center font-mono">
                          {proxFerias ? (
                            <span className="text-[#2563EB] font-semibold">
                              {formatBRDate(proxFerias.data_inicio)} ({proxFerias.dias}d)
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          {piorPeriodo ? (
                            <div className="space-y-0.5">
                              {piorPeriodo.alertaVencimento === 'vencido' && (
                                <Badge
                                  variant="destructive"
                                  className="flex items-center gap-1 w-fit"
                                >
                                  <AlertCircle className="w-3 h-3" />
                                  Concessivo Vencido!
                                </Badge>
                              )}
                              {piorPeriodo.alertaVencimento === 'urgente_15' && (
                                <Badge className="bg-red-600 text-white flex items-center gap-1 w-fit">
                                  <AlertTriangle className="w-3 h-3" />
                                  Vence em &lt;15d ({formatBRDate(piorPeriodo.limiteConcessivo)})
                                </Badge>
                              )}
                              {piorPeriodo.alertaVencimento === 'alerta_30' && (
                                <Badge className="bg-amber-500 text-white flex items-center gap-1 w-fit">
                                  <AlertTriangle className="w-3 h-3" />
                                  Vence em &lt;30d ({formatBRDate(piorPeriodo.limiteConcessivo)})
                                </Badge>
                              )}
                              {piorPeriodo.alertaVencimento === 'alerta_60' && (
                                <Badge className="bg-amber-100 text-amber-900 border border-amber-300 w-fit">
                                  Vence em &lt;60d ({formatBRDate(piorPeriodo.limiteConcessivo)})
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-emerald-700 text-[11px] font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Regular
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <Badge
                            className={
                              func.situacao === 'em_ferias'
                                ? 'bg-amber-100 text-amber-800'
                                : func.situacao === 'ativo'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700'
                            }
                          >
                            {func.situacao === 'em_ferias'
                              ? 'Em Férias'
                              : func.situacao === 'ativo'
                                ? 'Ativo'
                                : func.situacao}
                          </Badge>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSearchParams({ funcionarioId: func.id })}
                              className="text-xs h-7 px-2.5 border-slate-200 text-[#2563EB] hover:bg-blue-50"
                            >
                              Ver Períodos
                              <ChevronRight className="w-3 h-3 ml-1" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleOpenNewModal(func.id)}
                              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs h-7 px-2"
                              title="Agendar Férias"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: CADASTRO / EDIÇÃO DE FÉRIAS                           */}
      {/* ============================================================ */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#2563EB] flex items-center justify-center mb-1">
              <Palmtree className="w-5 h-5" />
            </div>
            <DialogTitle>
              {editingFerias ? 'Editar Período de Férias' : 'Cadastrar Período de Férias'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do período de descanso. As validações da CLT (art. 134 e 130) serão
              checadas automaticamente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitFerias} className="space-y-4 pt-1">
            {/* Seleção do Funcionário */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Colaborador <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formFuncId}
                onValueChange={(val) => {
                  setFormFuncId(val)
                  setFormPeriodoIndex(null)
                }}
                disabled={Boolean(editingFerias)}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Selecione o funcionário" />
                </SelectTrigger>
                <SelectContent>
                  {funcionarios.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome} ({f.matricula}) — Saldo:{' '}
                      {calculosPorFuncionario.get(f.id)?.saldoTotalDisponivel ?? 0}d
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ciclo Aquisitivo Correspondente */}
            {formFuncId && calculosPorFuncionario.get(formFuncId)?.periodos.length ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Ciclo Aquisitivo de Referência</Label>
                <Select
                  value={formPeriodoIndex !== null ? String(formPeriodoIndex) : 'auto'}
                  onValueChange={(val) =>
                    setFormPeriodoIndex(val === 'auto' ? null : parseInt(val, 10))
                  }
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Automático (ciclo mais antigo com saldo)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">
                      Automático (Priorizar mais antigo com saldo)
                    </SelectItem>
                    {calculosPorFuncionario.get(formFuncId)!.periodos.map((p, idx) => (
                      <SelectItem key={idx} value={String(idx)}>
                        {p.indice}º Ciclo ({formatBRDate(p.inicio)} a {formatBRDate(p.fim)}) —
                        Saldo: {p.saldoRemanescente}d • Limite: {formatBRDate(p.limiteConcessivo)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {/* Datas de Início e Término */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dataInicioInput" className="text-xs font-semibold">
                  Data de Início do Gozo <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="dataInicioInput"
                  type="date"
                  required
                  value={formDataInicio}
                  onChange={(e) => setFormDataInicio(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dataFimInput" className="text-xs font-semibold">
                  Data de Término do Gozo <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="dataFimInput"
                  type="date"
                  required
                  value={formDataFim}
                  onChange={(e) => setFormDataFim(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Dias Calculados e Abono Pecuniário */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                  Dias de Descanso
                </span>
                <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                  {validationResult.diasCalculados} dias
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="abonoInput" className="text-xs font-semibold">
                  Abono Pecuniário (venda)
                </Label>
                <Input
                  id="abonoInput"
                  type="number"
                  min={0}
                  max={10}
                  value={formDiasAbono}
                  onChange={(e) => setFormDiasAbono(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="text-xs h-8 font-mono"
                  placeholder="0 a 10 dias"
                />
                <span className="text-[10px] text-slate-400">Máx legal 10d (1/3 CLT)</span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                  Total Deduzido
                </span>
                <p className="text-lg font-bold text-[#2563EB] font-mono mt-0.5">
                  {validationResult.diasCalculados + (Number(formDiasAbono) || 0)} dias
                </p>
              </div>
            </div>

            {/* Situação e Tipo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Situação do Período</Label>
                <Select value={formStatus} onValueChange={(val: any) => setFormStatus(val)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="programada">Programada</SelectItem>
                    <SelectItem value="em_gozo">Em Gozo</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Tipo de Férias</Label>
                <Select value={formTipo} onValueChange={(val: any) => setFormTipo(val)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="integral">Integral (30 dias)</SelectItem>
                    <SelectItem value="fracionada">Fracionada (&lt;30 dias)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Painel de Validações Legais CLT (Erros e Avisos) */}
            {validationResult.erros.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1 text-xs text-red-900">
                <div className="font-bold flex items-center gap-1.5 text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  Impedimento Legal Detectado:
                </div>
                {validationResult.erros.map((err, i) => (
                  <p key={i} className="pl-5 text-red-700">
                    • {err}
                  </p>
                ))}
              </div>
            )}

            {validationResult.avisos.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-1 text-xs text-amber-950">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  Alerta CLT (Requer Justificativa do RH):
                </div>
                {validationResult.avisos.map((av, i) => (
                  <p key={i} className="pl-5">
                    • {av}
                  </p>
                ))}
              </div>
            )}

            {/* Justificativa do RH (Obrigatória em caso de avisos) */}
            {validationResult.avisos.length > 0 && (
              <div className="space-y-1.5">
                <Label
                  htmlFor="justificativaRhInput"
                  className="text-xs font-semibold text-amber-900"
                >
                  Justificativa da Decisão do RH <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="justificativaRhInput"
                  required
                  placeholder="Registre formalmente a justificativa da decisão do RH..."
                  value={formJustificativaRh}
                  onChange={(e) => setFormJustificativaRh(e.target.value)}
                  className="text-xs border-amber-300 focus:border-amber-500"
                  rows={2}
                />
              </div>
            )}

            {/* Observações Gerais */}
            <div className="space-y-1.5">
              <Label htmlFor="obsInput" className="text-xs font-semibold">
                Observações Gerais (opcional)
              </Label>
              <Input
                id="obsInput"
                placeholder="Ex: Acordo individual assinado / Substituição temporária alinhada"
                value={formObservacoes}
                onChange={(e) => setFormObservacoes(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving || !validationResult.valido}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
              >
                {saving
                  ? 'Gravando...'
                  : editingFerias
                    ? 'Salvar Alterações'
                    : 'Confirmar Cadastro'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
