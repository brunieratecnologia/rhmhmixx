import React, { useState, useEffect } from 'react'
import { useOutletContext, Link } from 'react-router-dom'
import type { PortalContextType } from '@/pages/portal/PortalTypes'
import { portalService, bancoHorasService } from '@/services/rh'
import type { RegistroHorario, Solicitacao, Holerite, Ferias } from '@/types/rh'
import { formatBRDate, formatBRTime } from '@/lib/formatters'
import {
  Clock,
  FileCheck2,
  Palmtree,
  FileText,
  FolderOpen,
  Send,
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function PortalInicio() {
  const { funcionario } = useOutletContext<PortalContextType>()
  const [registros, setRegistros] = useState<RegistroHorario[]>([])
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([])
  const [ultimoHolerite, setUltimoHolerite] = useState<Holerite | null>(null)
  const [saldoBH, setSaldoBH] = useState<string>('00:00')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!funcionario?.id) return
    let isMounted = true

    async function loadDashboard() {
      try {
        const [regs, sols, hols, bh] = await Promise.all([
          portalService.getMeusRegistrosRecentes(funcionario.id, 8),
          portalService.getMinhasSolicitacoes(funcionario.id),
          portalService.getMeusHolerites(funcionario.id),
          bancoHorasService.getSaldoFuncionario(funcionario.id),
        ])

        if (isMounted) {
          setRegistros(regs)
          setSolicitacoes(sols.slice(0, 5))
          setUltimoHolerite(hols.length > 0 ? hols[0] : null)
          setSaldoBH(bh.horasFormatadas)
        }
      } catch (err) {
        console.error('Erro ao carregar dados do início do portal:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadDashboard()
    return () => {
      isMounted = false
    }
  }, [funcionario])

  if (!funcionario) return null

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#101726] via-[#161F33] to-[#111928] border border-[#D4AF37]/30 p-6 shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-[#7C3AED]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#7C3AED]/20 text-purple-300 border border-[#7C3AED]/40">
                Área do Colaborador
              </span>
              <span className="text-xs text-slate-400">
                Matrícula: <strong className="text-amber-200">{funcionario.matricula}</strong>
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-amber-100 tracking-tight">
              Olá, {funcionario.nome.split(' ')[0]}! Bem-vindo(a) ao seu portal.
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Aqui você consulta seus horários, solicita justificativas de ponto, acompanha férias,
              acessa holerites e baixa documentos disponibilizados pela empresa.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <Link to="/portal/minhas-solicitacoes">
              <Button className="bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-slate-950 font-bold hover:brightness-110 shadow-md shadow-[#D4AF37]/20 text-xs h-10 px-4">
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Nova Solicitação
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Banco de Horas */}
        <Card className="bg-[#0F1624] border-[#D4AF37]/20 text-amber-50 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-400">Banco de Horas</CardTitle>
            <TrendingUp className="w-4 h-4 text-[#D4AF37]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-amber-200">{saldoBH}</div>
            <p className="text-[11px] text-slate-400 mt-1">Saldo acumulado vigente</p>
          </CardContent>
        </Card>

        {/* Card 2: Espelho de Ponto */}
        <Card className="bg-[#0F1624] border-[#D4AF37]/20 text-amber-50 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-400">Espelho Mensal</CardTitle>
            <FileCheck2 className="w-4 h-4 text-[#7C3AED]" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold text-slate-200 truncate">
              {funcionario.expand?.jornada_atual?.nome || 'Jornada Padrão'}
            </div>
            <Link
              to="/portal/meu-espelho"
              className="text-[11px] text-[#D4AF37] hover:underline flex items-center gap-1 mt-2"
            >
              <span>Ver espelho detalhado</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>

        {/* Card 3: Último Holerite */}
        <Card className="bg-[#0F1624] border-[#D4AF37]/20 text-amber-50 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-400">Último Holerite</CardTitle>
            <FileText className="w-4 h-4 text-[#D4AF37]" />
          </CardHeader>
          <CardContent>
            {ultimoHolerite ? (
              <div>
                <div className="text-base font-bold text-amber-200">
                  {String(ultimoHolerite.competencia_mes).padStart(2, '0')}/
                  {ultimoHolerite.competencia_ano}
                </div>
                <Link
                  to="/portal/meus-holerites"
                  className="text-[11px] text-[#D4AF37] hover:underline flex items-center gap-1 mt-1"
                >
                  <span>Baixar contracheque</span>
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-1">Nenhum holerite arquivado ainda.</p>
            )}
          </CardContent>
        </Card>

        {/* Card 4: Férias */}
        <Card className="bg-[#0F1624] border-[#D4AF37]/20 text-amber-50 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-400">Gestão de Férias</CardTitle>
            <Palmtree className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold text-emerald-300">
              {funcionario.situacao === 'em_ferias' ? 'Em Gozo de Férias' : 'Situação Ativa'}
            </div>
            <Link
              to="/portal/minhas-ferias"
              className="text-[11px] text-[#D4AF37] hover:underline flex items-center gap-1 mt-2"
            >
              <span>Consultar períodos</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Grid: Últimas Batidas & Minhas Solicitações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Últimas Batidas */}
        <Card className="bg-[#0F1624] border-[#D4AF37]/20 text-amber-50 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between border-b border-[#D4AF37]/10 pb-3">
            <CardTitle className="text-sm font-bold text-amber-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#D4AF37]" />
              Últimas Marcações Registradas
            </CardTitle>
            <Link to="/portal/meu-espelho">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-[#D4AF37] hover:bg-[#D4AF37]/10 h-7 px-2"
              >
                Ver Todas
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-4">
            {registros.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                Nenhuma batida recente encontrada para sua matrícula.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {registros.map((reg) => (
                  <div key={reg.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                      <span className="font-medium text-slate-200">
                        {formatBRDate(reg.data_utc || reg.timestamp_utc)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-amber-300 text-sm">
                        {reg.hora_utc || formatBRTime(reg.timestamp_utc)}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] border-[#D4AF37]/30 text-slate-400 capitalize"
                      >
                        {reg.origem || 'terminal'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Minhas Solicitações Recentes */}
        <Card className="bg-[#0F1624] border-[#D4AF37]/20 text-amber-50 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between border-b border-[#D4AF37]/10 pb-3">
            <CardTitle className="text-sm font-bold text-amber-100 flex items-center gap-2">
              <Send className="w-4 h-4 text-[#7C3AED]" />
              Minhas Solicitações Recentes
            </CardTitle>
            <Link to="/portal/minhas-solicitacoes">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-[#D4AF37] hover:bg-[#D4AF37]/10 h-7 px-2"
              >
                Ver Todas
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-4">
            {solicitacoes.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                Você não possui nenhuma solicitação aberta. Caso precise justificar uma ausência ou
                correção de ponto, crie uma solicitação.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {solicitacoes.map((sol) => (
                  <div key={sol.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-200 capitalize">
                        {sol.tipo.replace('_', ' ')}: {sol.motivo}
                      </p>
                      <p className="text-[11px] text-slate-500">{formatBRDate(sol.created)}</p>
                    </div>
                    <div>
                      {sol.status === 'pendente' && (
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                          Pendente
                        </Badge>
                      )}
                      {sol.status === 'aprovado' && (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                          Aprovado
                        </Badge>
                      )}
                      {sol.status === 'recusado' && (
                        <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">
                          Recusado
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Acesso Rápido a Documentos e Normas */}
      <div className="p-4 rounded-xl bg-[#0F1624] border border-[#D4AF37]/15 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#7C3AED]/20 border border-[#7C3AED]/40 flex items-center justify-center text-purple-300">
            <FolderOpen className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-amber-100">
              Central de Documentos do Colaborador
            </h4>
            <p className="text-[11px] text-slate-400">
              Acesse contratos de trabalho, termos internos e comprovantes disponibilizados para
              você.
            </p>
          </div>
        </div>
        <Link to="/portal/meus-documentos">
          <Button
            variant="outline"
            size="sm"
            className="border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 text-xs"
          >
            Abrir Meus Documentos
          </Button>
        </Link>
      </div>
    </div>
  )
}
