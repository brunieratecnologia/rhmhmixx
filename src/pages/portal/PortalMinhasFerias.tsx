import React, { useState, useEffect } from 'react'
import { useOutletContext, Link } from 'react-router-dom'
import type { PortalContextType } from '@/pages/portal/PortalTypes'
import { portalService } from '@/services/rh'
import type { Ferias } from '@/types/rh'
import { formatBRDate } from '@/lib/formatters'
import { Palmtree, Calendar, Clock, CheckCircle2, AlertTriangle, Send, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function PortalMinhasFerias() {
  const { funcionario } = useOutletContext<PortalContextType>()
  const [feriasList, setFeriasList] = useState<Ferias[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!funcionario?.id) return
    let isMounted = true

    async function loadFerias() {
      try {
        const list = await portalService.getMinhasFerias(funcionario.id)
        if (isMounted) setFeriasList(list)
      } catch (err) {
        console.error('Erro ao carregar férias do colaborador:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadFerias()
    return () => {
      isMounted = false
    }
  }, [funcionario])

  if (!funcionario) return null

  // Calcular status geral
  const emGozo = feriasList.find((f) => f.status === 'em_gozo')
  const programadas = feriasList.filter((f) => f.status === 'programada' || f.status === 'aprovado')

  return (
    <div className="space-y-6">
      {/* Banner Principal */}
      <div className="rounded-2xl bg-gradient-to-r from-[#0F1624] via-[#161F33] to-[#0F1624] border border-[#D4AF37]/30 p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
              Art. 130 CLT
            </Badge>
            <span className="text-xs text-slate-400">Direito Anual a 30 Dias</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-amber-100 flex items-center gap-2">
            <Palmtree className="w-6 h-6 text-[#D4AF37]" />
            Minhas Férias
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Consulte seus períodos aquisitivos, férias programadas, saldos e solicite agendamentos
            ao RH.
          </p>
        </div>

        <Link to="/portal/minhas-solicitacoes">
          <Button className="bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-slate-950 font-bold hover:brightness-110 shadow-md shadow-[#D4AF37]/20 text-xs h-10 px-4">
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Solicitar Período de Férias
          </Button>
        </Link>
      </div>

      {/* Status Atual */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#0F1624] border border-[#D4AF37]/20">
          <span className="text-[11px] text-slate-400 block">Status Concessivo</span>
          <span className="text-base font-bold text-emerald-400">
            {emGozo ? 'Atualmente em Gozo' : 'Situação Regular CLT'}
          </span>
          <p className="text-[10px] text-slate-500 mt-1">Conforme registro de admissão</p>
        </div>

        <div className="p-4 rounded-xl bg-[#0F1624] border border-[#D4AF37]/20">
          <span className="text-[11px] text-slate-400 block">Férias Programadas</span>
          <span className="text-base font-bold text-amber-200">
            {programadas.length > 0 ? `${programadas.length} período(s)` : 'Nenhuma no momento'}
          </span>
          <p className="text-[10px] text-slate-500 mt-1">Aprovadas ou agendadas</p>
        </div>

        <div className="p-4 rounded-xl bg-[#0F1624] border border-[#D4AF37]/20">
          <span className="text-[11px] text-slate-400 block">Regras de Fracionamento</span>
          <span className="text-base font-bold text-purple-300">Até 3 períodos</span>
          <p className="text-[10px] text-slate-500 mt-1">Um deles não inferior a 14 dias</p>
        </div>
      </div>

      {/* Histórico e Períodos de Férias */}
      <Card className="bg-[#0F1624] border-[#D4AF37]/20 text-amber-50">
        <CardHeader className="border-b border-[#D4AF37]/10 pb-3">
          <CardTitle className="text-sm font-bold text-amber-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#D4AF37]" />
            Períodos de Férias Registrados
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <div className="w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Carregando histórico de férias...
            </div>
          ) : feriasList.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Nenhum registro de férias lançado na sua ficha funcional ainda.
            </div>
          ) : (
            <div className="space-y-3">
              {feriasList.map((f) => (
                <div
                  key={f.id}
                  className="p-4 rounded-xl bg-[#0A0E17] border border-[#D4AF37]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-200">
                        {formatBRDate(f.data_inicio)} até {formatBRDate(f.data_fim)}
                      </span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#D4AF37]/10 text-amber-300 border border-[#D4AF37]/30">
                        {f.dias} dias
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Período Aquisitivo: {formatBRDate(f.periodo_aquisitivo_inicio)} a{' '}
                      {formatBRDate(f.periodo_aquisitivo_fim)}
                    </div>

                    {f.observacoes && (
                      <p className="text-[11px] text-slate-500 italic">Obs: {f.observacoes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {f.status === 'em_gozo' && (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                        Em Gozo
                      </Badge>
                    )}
                    {f.status === 'programada' && (
                      <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                        Programada
                      </Badge>
                    )}
                    {f.status === 'concluida' && (
                      <Badge className="bg-slate-700 text-slate-300 border-slate-600">
                        Concluída
                      </Badge>
                    )}
                    {f.status === 'solicitado' && (
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                        Aguardando Aprovação
                      </Badge>
                    )}
                    {f.status === 'cancelada' && (
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
                        Cancelada
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Regras Importantes */}
      <div className="p-4 rounded-xl bg-[#7C3AED]/10 border border-[#7C3AED]/30 flex items-start gap-3 text-xs text-slate-300">
        <Info className="w-4 h-4 text-purple-300 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-purple-200">
            Avisos e Normas CLT para Agendamento de Férias
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            A CLT estabelece que as férias devem ser comunicadas com no mínimo 30 dias de
            antecedência. O início não pode ocorrer nos 2 dias que antecedem feriados ou dias de
            descanso remunerado (DSR). Caso tenha dúvidas ou queira solicitar períodos fracionados,
            utilize a central de solicitações.
          </p>
        </div>
      </div>
    </div>
  )
}
