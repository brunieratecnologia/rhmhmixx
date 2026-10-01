import React, { useState, useEffect } from 'react'
import { useOutletContext, Link } from 'react-router-dom'
import type { PortalContextType } from '@/pages/portal/PortalTypes'
import { espelhoPontoService, bancoHorasService } from '@/services/rh'
import {
  construirEspelhoMensal,
  DiaEspelhoCalculado,
  ResumoEspelhoMensal,
  minutesToTimeString,
  minutesToSignedString,
} from '@/lib/calculoHoras'
import { formatBRDate } from '@/lib/formatters'
import { FileCheck2, Calendar, ChevronLeft, ChevronRight, Clock, Send, Lock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export default function PortalMeuEspelho() {
  const { funcionario } = useOutletContext<PortalContextType>()
  const today = new Date()
  const [ano, setAno] = useState(today.getFullYear())
  const [mes, setMes] = useState(today.getMonth() + 1)
  const [loading, setLoading] = useState(true)
  const [diasCalculados, setDiasCalculados] = useState<DiaEspelhoCalculado[]>([])
  const [resumo, setResumo] = useState<ResumoEspelhoMensal | null>(null)
  const [saldoBH, setSaldoBH] = useState<string>('00:00')

  useEffect(() => {
    if (!funcionario?.id) return
    let isMounted = true

    async function loadEspelho() {
      setLoading(true)
      try {
        const [dados, bh] = await Promise.all([
          espelhoPontoService.getDadosEspelho(funcionario.id, ano, mes),
          bancoHorasService.getSaldoFuncionario(funcionario.id),
        ])

        if (isMounted) {
          const resultado = construirEspelhoMensal({
            ano,
            mes,
            jornadaAtual: dados.funcionario.expand?.jornada_atual || null,
            historicoJornadas: dados.historicoJornadas,
            registrosMes: dados.registros,
            tratamentosMes: dados.tratamentos,
            ausenciasMes: dados.ausencias,
            feriasMes: dados.ferias,
          })
          setDiasCalculados(resultado.dias)
          setResumo(resultado.resumo)
          setSaldoBH(bh.horasFormatadas)
        }
      } catch (err) {
        console.error('Erro ao calcular espelho do colaborador:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadEspelho()
    return () => {
      isMounted = false
    }
  }, [funcionario, ano, mes])

  if (!funcionario) return null

  const handleMesAnterior = () => {
    if (mes === 1) {
      setMes(12)
      setAno(ano - 1)
    } else {
      setMes(mes - 1)
    }
  }

  const handleMesProximo = () => {
    if (mes === 12) {
      setMes(1)
      setAno(ano + 1)
    } else {
      setMes(mes + 1)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Seletor de Mês */}
      <div className="rounded-2xl bg-[#0F1624] border border-[#D4AF37]/30 p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-[#D4AF37]/20 text-amber-200 border-[#D4AF37]/40 text-xs">
              Somente Leitura
            </Badge>
            <span className="text-xs text-slate-400">Registros Oficiais CLT</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-amber-100 flex items-center gap-2">
            <FileCheck2 className="w-6 h-6 text-[#D4AF37]" />
            Meu Espelho de Ponto
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Visualização das batidas de ponto, horas trabalhadas e balanço mensal.
          </p>
        </div>

        {/* Navigation Buttons for Month */}
        <div className="flex items-center gap-3 bg-[#070B11] border border-[#D4AF37]/30 p-1.5 rounded-xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMesAnterior}
            className="text-slate-400 hover:text-amber-200 hover:bg-[#121824] h-8 w-8 p-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <span className="font-bold text-xs sm:text-sm text-amber-100 px-3 min-w-[130px] text-center">
            {MESES[mes - 1]} / {ano}
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleMesProximo}
            className="text-slate-400 hover:text-amber-200 hover:bg-[#121824] h-8 w-8 p-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Cards de Totais do Mês */}
      {resumo && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#0F1624] border border-[#D4AF37]/20">
            <span className="text-[11px] text-slate-400 block">Horas Previstas</span>
            <span className="text-lg font-bold font-mono text-slate-200">
              {minutesToTimeString(resumo.previstoTotalMinutos)}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#0F1624] border border-[#D4AF37]/20">
            <span className="text-[11px] text-slate-400 block">Horas Trabalhadas</span>
            <span className="text-lg font-bold font-mono text-emerald-400">
              {minutesToTimeString(resumo.realizadoTotalMinutos)}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#0F1624] border border-[#D4AF37]/20">
            <span className="text-[11px] text-slate-400 block">Saldo do Mês</span>
            <span
              className={`text-lg font-bold font-mono ${
                resumo.saldoTotalMinutos >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {minutesToSignedString(resumo.saldoTotalMinutos)}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#0F1624] border border-[#D4AF37]/20">
            <span className="text-[11px] text-slate-400 block">Saldo Acumulado Banco</span>
            <span className="text-lg font-bold font-mono text-amber-300">{saldoBH}</span>
          </div>
        </div>
      )}

      {/* Tabela de Batidas Diárias */}
      <Card className="bg-[#0F1624] border-[#D4AF37]/20 text-amber-50 overflow-hidden shadow-xl">
        <CardHeader className="border-b border-[#D4AF37]/10 pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-amber-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#D4AF37]" />
            Marcações Dia a Dia
          </CardTitle>
          <Link to="/portal/minhas-solicitacoes">
            <Button
              variant="outline"
              size="sm"
              className="border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 text-xs h-8"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Solicitar Correção
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">
              <div className="w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Calculando espelho de ponto...
            </div>
          ) : diasCalculados.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Nenhuma movimentação registrada no mês selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#070B11]/80 text-slate-400">
                    <th className="py-3 px-4 font-semibold">Data / Dia</th>
                    <th className="py-3 px-4 font-semibold">Horários Registrados</th>
                    <th className="py-3 px-4 font-semibold">Previsto</th>
                    <th className="py-3 px-4 font-semibold">Trabalhado</th>
                    <th className="py-3 px-4 font-semibold">Banco Horas</th>
                    <th className="py-3 px-4 font-semibold">Saldo</th>
                    <th className="py-3 px-4 font-semibold">Ocorrência / Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {diasCalculados.map((dia) => {
                    const isFimDeSemana = dia.diaSemana === 'sab' || dia.diaSemana === 'dom'
                    const saldoColor =
                      dia.diferencaMinutos > 0
                        ? 'text-emerald-400'
                        : dia.diferencaMinutos < 0
                          ? 'text-rose-400'
                          : 'text-slate-400'

                    return (
                      <tr
                        key={dia.data}
                        className={`hover:bg-[#121824] transition-colors ${
                          isFimDeSemana ? 'bg-[#0A0E17]/40' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 font-mono font-medium text-slate-200">
                          <span>{formatBRDate(dia.data)}</span>
                          <span className="text-[10px] text-slate-500 ml-1.5 uppercase font-sans">
                            {dia.diaSemana}
                          </span>
                        </td>

                        <td className="py-2.5 px-4 font-mono">
                          {dia.todasMarcacoes.length === 0 ? (
                            <span className="text-slate-600">---</span>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-1.5">
                                {dia.todasMarcacoes.map((m, idx) => {
                                  const ehAuto = m.origem === 'intervalo_automatico'
                                  const ehAjuste = m.origem === 'tratamento_fechamento'
                                  const ehAnulado = Boolean(m.anulado)
                                  return (
                                    <span
                                      key={idx}
                                      className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 ${
                                        ehAnulado
                                          ? 'bg-rose-950/30 text-rose-400/80 border-rose-500/30 line-through opacity-70'
                                          : ehAuto
                                            ? 'bg-[#7C3AED]/20 text-purple-300 border-[#7C3AED]/40'
                                            : ehAjuste
                                              ? 'bg-amber-950/40 text-amber-300 border-amber-500/30'
                                              : 'bg-[#151D2C] text-amber-100 border-[#D4AF37]/20'
                                      }`}
                                      title={
                                        ehAnulado
                                          ? `Marcação Anulada (${m.motivoAnulacao || 'Desconsiderada no fechamento'})`
                                          : ehAuto
                                            ? 'Intervalo automático da jornada'
                                            : ehAjuste
                                              ? 'Ajuste de fechamento'
                                              : 'Batida registrada'
                                      }
                                    >
                                      {m.horario}
                                      {ehAuto && (
                                        <span className="text-[9px] bg-[#7C3AED]/40 text-purple-200 px-1 rounded uppercase tracking-wider">
                                          Auto
                                        </span>
                                      )}
                                      {ehAnulado && (
                                        <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1 rounded font-bold uppercase">
                                          Anulada
                                        </span>
                                      )}
                                    </span>
                                  )
                                })}
                              </div>
                              {dia.intervaloAutomaticoAplicado && dia.intervaloInfo && (
                                <div className="text-[10px] text-purple-300/80 font-sans">
                                  Intervalo auto: {dia.intervaloInfo.inicio} às{' '}
                                  {dia.intervaloInfo.retorno} (-{dia.intervaloInfo.duracaoMinutos}m)
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-4 font-mono text-slate-400">
                          {dia.previstoFormatado}
                        </td>

                        <td className="py-2.5 px-4 font-mono font-semibold text-slate-200">
                          {dia.realizadoFormatado}
                        </td>

                        <td className="py-2.5 px-4 font-mono">
                          {dia.horasBancoCreditoMinutos > 0 ? (
                            <span
                              className="font-bold text-amber-300 bg-amber-950/50 px-1.5 py-0.5 rounded border border-[#D4AF37]/30 text-[11px]"
                              title="Tempo trabalhado além da saída prevista -> Banco de Horas"
                            >
                              {dia.horasBancoCreditoFormatado}
                            </span>
                          ) : (
                            <span className="text-slate-600">--</span>
                          )}
                        </td>

                        <td className={`py-2.5 px-4 font-mono font-bold ${saldoColor}`}>
                          {dia.diferencaFormatada}
                        </td>

                        <td className="py-2.5 px-4">
                          {dia.ocorrencias.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {dia.ocorrencias.map((oc, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className={`text-[10px] ${
                                    oc.tipo === 'ferias'
                                      ? 'border-emerald-500/30 text-emerald-300 bg-emerald-950/30'
                                      : oc.tipo === 'ausencia'
                                        ? 'border-rose-500/30 text-rose-300 bg-rose-950/30'
                                        : 'border-[#7C3AED]/30 text-purple-300 bg-[#7C3AED]/10'
                                  }`}
                                >
                                  {oc.descricao}
                                </Badge>
                              ))}
                            </div>
                          ) : isFimDeSemana ? (
                            <span className="text-slate-500 text-[11px]">DSR / Folga</span>
                          ) : (
                            <span className="text-slate-600 text-[11px]">Regular</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nota de Fechamento CLT */}
      <div className="p-4 rounded-xl bg-[#0F1624] border border-[#D4AF37]/20 text-xs text-slate-400 flex items-start gap-3">
        <Lock className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
        <p>
          O espelho de ponto exibido é de visualização exclusiva do colaborador. As marcações
          originais do terminal são imutáveis conforme Portaria MTP nº 671/2021. Inclusões ou
          justificativas de batidas são processadas pelo setor de Recursos Humanos durante o
          fechamento mensal da folha.
        </p>
      </div>
    </div>
  )
}
