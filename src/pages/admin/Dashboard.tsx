import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { dashboardService } from '@/services/rh'
import pb from '@/lib/pocketbase/client'
import type { RegistroHorario } from '@/types/rh'
import { formatBRDate } from '@/lib/formatters'
import {
  Users,
  Clock,
  Sun,
  CalendarX,
  Inbox,
  CalendarDays,
  UserPlus,
  Search,
  Calendar,
  Upload,
  CalendarClock,
  Cake,
  FileText,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Dashboard() {
  const navigate = useNavigate()

  const [metrics, setMetrics] = useState({
    totalAtivos: 0,
    entradasHoje: 0,
    emFerias: 0,
    ausenciasHoje: 0,
    solicitacoesPendentes: 0,
    feriasProximos30Dias: 0,
  })

  const [movimentacoesHoje, setMovimentacoesHoje] = useState<RegistroHorario[]>([])
  const [proximosEventos, setProximosEventos] = useState<
    {
      id: string
      tipo: 'ferias' | 'aniversario' | 'documento'
      titulo: string
      data: string
      dataFormatted: string
    }[]
  >([])
  const [loading, setLoading] = useState(true)

  const loadAll = async () => {
    try {
      const [m, movs, evs] = await Promise.all([
        dashboardService.getMetrics(),
        dashboardService.getMovimentacoesHoje(),
        dashboardService.getProximosEventos(),
      ])
      setMetrics(m)
      setMovimentacoesHoje(movs)
      setProximosEventos(evs)
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()

    // Setup real-time subscriptions on all relevant collections
    const collections = [
      'funcionarios',
      'registros_horario',
      'ferias',
      'ausencias',
      'solicitacoes',
      'documentos',
    ]
    const unsubs: (() => void)[] = []

    collections.forEach((col) => {
      pb.collection(col)
        .subscribe('*', () => {
          loadAll()
        })
        .then((unsub) => {
          unsubs.push(unsub)
        })
        .catch(() => {})
    })

    return () => {
      unsubs.forEach((u) => u())
    }
  }, [])

  const cards = [
    {
      title: 'Total de Funcionários Ativos',
      value: metrics.totalAtivos,
      icon: Users,
      bgColor: 'bg-[#DBEAFE]',
      iconColor: 'text-[#2563EB]',
      hasData: metrics.totalAtivos > 0,
    },
    {
      title: 'Entradas Registradas Hoje',
      value: metrics.entradasHoje,
      icon: Clock,
      bgColor: 'bg-[#DCFCE7]',
      iconColor: 'text-[#16A34A]',
      hasData: metrics.entradasHoje > 0,
    },
    {
      title: 'Funcionários em Férias',
      value: metrics.emFerias,
      icon: Sun,
      bgColor: 'bg-[#FEF3C7]',
      iconColor: 'text-[#D97706]',
      hasData: metrics.emFerias > 0,
    },
    {
      title: 'Ausências Informadas',
      value: metrics.ausenciasHoje,
      icon: CalendarX,
      bgColor: 'bg-[#FFEDD5]',
      iconColor: 'text-[#EA580C]',
      hasData: metrics.ausenciasHoje > 0,
    },
    {
      title: 'Solicitações Pendentes',
      value: metrics.solicitacoesPendentes,
      icon: Inbox,
      bgColor: 'bg-[#F3E8FF]',
      iconColor: 'text-[#9333EA]',
      hasData: metrics.solicitacoesPendentes > 0,
    },
    {
      title: 'Férias nos Próximos 30 Dias',
      value: metrics.feriasProximos30Dias,
      icon: CalendarDays,
      bgColor: 'bg-[#DBEAFE]',
      iconColor: 'text-[#2563EB]',
      hasData: metrics.feriasProximos30Dias > 0,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Top Header Strip with Action Shortcuts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Painel Geral
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Indicadores e movimentações de Recursos Humanos em tempo real
          </p>
        </div>

        {/* Shortcuts Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <Button
            onClick={() => navigate('/admin/funcionarios/novo')}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-semibold h-9 px-3.5 shadow-sm"
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            Cadastrar Funcionário
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('/admin/funcionarios')}
            className="h-9 px-3 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-medium"
          >
            <Search className="w-4 h-4 mr-1.5 text-slate-500" />
            Consultar Registros
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('/admin/ferias')}
            className="h-9 px-3 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-medium"
          >
            <Calendar className="w-4 h-4 mr-1.5 text-slate-500" />
            Gestão de Férias
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('/admin/ausencias')}
            className="h-9 px-3 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-medium"
          >
            <Clock className="w-4 h-4 mr-1.5 text-slate-500" />
            Registrar Ausência
          </Button>
        </div>
      </div>

      {/* 6 Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {cards.map((card, idx) => {
          const Icon = card.icon
          return (
            <div
              key={idx}
              className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-[13px] font-medium text-slate-600 line-clamp-1">
                  {card.title}
                </span>
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${card.bgColor} ${card.iconColor}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
              </div>

              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight">
                  {card.value}
                </span>
                {!card.hasData && (
                  <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    Sem dados
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Two columns: Movimentações de Hoje & Próximos Eventos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Movimentações de Hoje */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Movimentações de Hoje
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Registros de horário do dia (ordem decrescente)
              </p>
            </div>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>

          <div className="mt-3 flex-1 overflow-y-auto max-h-[380px]">
            {movimentacoesHoje.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                  <Clock className="w-7 h-7" />
                </div>
                <p className="text-sm font-medium text-slate-600">
                  Nenhum registro de horário hoje.
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Os batimentos de ponto realizados aparecerão listados aqui automaticamente.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 font-semibold">
                    <th className="py-2.5 px-3">Horário</th>
                    <th className="py-2.5 px-3">Funcionário</th>
                    <th className="py-2.5 px-3">Matrícula</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movimentacoesHoje.map((reg) => {
                    const ts = reg.timestamp_utc
                      ? new Date(reg.timestamp_utc)
                      : new Date(reg.created)
                    const horaFormatada = new Intl.DateTimeFormat('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                    }).format(ts)

                    return (
                      <tr key={reg.id} className="hover:bg-[#F0F6FF] transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 font-mono">
                          {horaFormatada}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {reg.expand?.funcionario?.nome || 'Funcionário'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">
                          {reg.expand?.funcionario?.matricula || '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Próximos Eventos */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Próximos Eventos
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Férias, aniversários e vencimentos nos próximos 30 dias
              </p>
            </div>
            <CalendarClock className="w-4 h-4 text-slate-400" />
          </div>

          <div className="mt-3 flex-1 overflow-y-auto max-h-[380px]">
            {proximosEventos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                  <CalendarDays className="w-7 h-7" />
                </div>
                <p className="text-sm font-medium text-slate-600">
                  Nenhum evento nos próximos 30 dias.
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Eventos de férias programadas, aniversários e vencimentos serão exibidos aqui.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {proximosEventos.map((ev) => {
                  let dotColor = 'bg-blue-500'
                  let Icon = Sun
                  if (ev.tipo === 'aniversario') {
                    dotColor = 'bg-amber-500'
                    Icon = Cake
                  } else if (ev.tipo === 'documento') {
                    dotColor = 'bg-orange-500'
                    Icon = FileText
                  }

                  return (
                    <div
                      key={ev.id}
                      className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-[#F0F6FF] rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
                        <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-xs sm:text-sm font-medium text-slate-800 truncate">
                          {ev.titulo}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-500 shrink-0 font-mono">
                        {formatBRDate(ev.data)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
