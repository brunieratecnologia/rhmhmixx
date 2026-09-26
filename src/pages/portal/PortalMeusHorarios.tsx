import React from 'react'
import { useOutletContext } from 'react-router-dom'
import type { PortalContextType } from '@/pages/portal/PortalTypes'
import { Clock, Calendar, CheckCircle2, XCircle, Info, ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { minutesToHoursText, getHorarioDiaJornada } from '@/lib/calculoHoras'
import type { DiaSemanaSigla } from '@/types/rh'

const DIAS_MAP: Record<string, string> = {
  seg: 'Segunda-feira',
  ter: 'Terça-feira',
  qua: 'Quarta-feira',
  qui: 'Quinta-feira',
  sex: 'Sexta-feira',
  sab: 'Sábado',
  dom: 'Domingo',
}

const ORDEM_DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']

export default function PortalMeusHorarios() {
  const { funcionario } = useOutletContext<PortalContextType>()
  const jornada = funcionario?.expand?.jornada_atual

  if (!funcionario) return null

  const diasTrabalho = jornada?.dias_trabalho || ['seg', 'ter', 'qua', 'qui', 'sex']
  const diasFolga = jornada?.dias_folga || ['sab', 'dom']

  const duracaoHoras = jornada?.duracao_jornada_min
    ? `${Math.floor(jornada.duracao_jornada_min / 60)}h${String(jornada.duracao_jornada_min % 60).padStart(2, '0')}`
    : '8h00'

  return (
    <div className="space-y-6">
      {/* Banner de Jornada */}
      <div className="rounded-2xl bg-gradient-to-r from-[#0F1624] via-[#151D2C] to-[#0F1624] border border-[#D4AF37]/30 p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-[#D4AF37]/20 text-amber-200 border-[#D4AF37]/40 text-xs">
                Escala Ativa
              </Badge>
              {jornada?.atravessa_meia_noite && (
                <Badge className="bg-[#7C3AED]/20 text-purple-300 border-[#7C3AED]/40 text-xs">
                  Noturna (Atravessa Meia-noite)
                </Badge>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-amber-100">
              {jornada?.nome || 'Jornada Padrão MH MIXX'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Carga horária diária prevista:{' '}
              <strong className="text-amber-300">{duracaoHoras}</strong>
            </p>
          </div>

          <div className="bg-[#070B11] border border-[#D4AF37]/20 p-3 rounded-xl flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px]">Entrada</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                {jornada?.hora_entrada || '08:00'}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-slate-500 block text-[10px]">Intervalo</span>
              <span className="font-mono text-amber-300 text-sm">
                {jornada?.hora_inicio_intervalo || '12:00'} -{' '}
                {jornada?.hora_retorno_intervalo || '13:00'}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-slate-500 block text-[10px]">Saída</span>
              <span className="font-mono font-bold text-rose-400 text-sm">
                {jornada?.hora_saida || '17:00'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grade Semanal de Escala */}
      <Card className="bg-[#0F1624] border-[#D4AF37]/20 text-amber-50">
        <CardHeader className="border-b border-[#D4AF37]/10 pb-3">
          <CardTitle className="text-sm font-bold text-amber-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#D4AF37]" />
            Programação Semanal da Sua Escala
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
            {ORDEM_DIAS.map((dia) => {
              const horarioDia = getHorarioDiaJornada(jornada, dia as DiaSemanaSigla)
              const trabalha = horarioDia ? horarioDia.ativo : diasTrabalho.includes(dia as any)
              const folga = !trabalha
              const horaEntradaDia = horarioDia?.hora_entrada || jornada?.hora_entrada
              const horaSaidaDia = horarioDia?.hora_saida || jornada?.hora_saida
              const duracaoDiaTexto = horarioDia
                ? minutesToHoursText(horarioDia.duracao_min)
                : duracaoHoras

              return (
                <div
                  key={dia}
                  className={`p-3 rounded-xl border flex flex-col justify-between min-h-[136px] transition-all ${
                    folga
                      ? 'bg-[#070B11]/60 border-slate-800 text-slate-500'
                      : 'bg-[#121A28] border-[#D4AF37]/30 text-amber-100 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider">{dia}</span>
                    {folga ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        Folga
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                        Trabalho
                      </span>
                    )}
                  </div>

                  <div className="my-auto py-1">
                    <span className="text-[11px] block font-medium">{DIAS_MAP[dia]}</span>
                    {!folga ? (
                      <div className="space-y-0.5 mt-1">
                        <div className="font-mono text-xs text-amber-200 font-semibold">
                          {horaEntradaDia} às {horaSaidaDia}
                        </div>
                        {horarioDia?.hora_inicio_intervalo &&
                          horarioDia?.hora_retorno_intervalo && (
                            <div className="text-[10px] font-mono text-slate-400">
                              Almoço: {horarioDia.hora_inicio_intervalo}–
                              {horarioDia.hora_retorno_intervalo}
                            </div>
                          )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Descanso Semanal
                      </span>
                    )}
                  </div>

                  <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800/60 flex items-center justify-between">
                    <span>{folga ? 'DSR' : `${duracaoDiaTexto} liq.`}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs text-slate-300">
              <Clock className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-200 mb-0.5">
                  Tolerância de Entrada e Horas Extras
                </p>
                <p className="text-[11px] text-slate-400">
                  Entradas com até <strong>10 minutos</strong> de atraso em relação ao horário
                  previsto não geram ocorrência de atraso. Horas trabalhadas após o horário previsto
                  de saída da sua escala são apuradas e creditadas no seu{' '}
                  <strong>Banco de Horas</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#7C3AED]/10 border border-[#7C3AED]/30 text-xs text-slate-300">
              <Info className="w-4 h-4 text-purple-300 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-purple-200 mb-0.5">
                  Proteção de Batida Dupla no Terminal
                </p>
                <p className="text-[11px] text-slate-400">
                  Batidas consecutivas do mesmo funcionário em intervalo muito curto são
                  consolidadas automaticamente em 1 único registro para evitar duplicidade.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
