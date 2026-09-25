import React, { useState } from 'react'
import type { Jornada, DiaSemanaSigla, GradeSemanal, HorarioDiaSemana } from '@/types/rh'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { timeStringToMinutes, minutesToHoursText } from '@/lib/calculoHoras'
import { AlertCircle, Clock, Copy } from 'lucide-react'

interface JornadaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jornada?: Jornada | null
  onSave: (data: Partial<Jornada>) => Promise<void>
}

const DIAS_SEMANA: { id: DiaSemanaSigla; label: string; fullLabel: string }[] = [
  { id: 'seg', label: 'Seg', fullLabel: 'Segunda-feira' },
  { id: 'ter', label: 'Ter', fullLabel: 'Terça-feira' },
  { id: 'qua', label: 'Qua', fullLabel: 'Quarta-feira' },
  { id: 'qui', label: 'Qui', fullLabel: 'Quinta-feira' },
  { id: 'sex', label: 'Sex', fullLabel: 'Sexta-feira' },
  { id: 'sab', label: 'Sáb', fullLabel: 'Sábado' },
  { id: 'dom', label: 'Dom', fullLabel: 'Domingo' },
]

function calcularDuracaoHorario(
  entStr: string,
  saiStr: string,
  intIniStr?: string,
  intFimStr?: string,
  atravessa?: boolean,
): number {
  if (!entStr || !saiStr) return 0
  const ent = timeStringToMinutes(entStr)
  let sai = timeStringToMinutes(saiStr)
  if (sai < ent || atravessa) {
    sai += 24 * 60
  }
  let total = sai - ent
  if (intIniStr && intFimStr) {
    const intIni = timeStringToMinutes(intIniStr)
    let intFim = timeStringToMinutes(intFimStr)
    if (intFim < intIni) {
      intFim += 24 * 60
    }
    const interv = intFim - intIni
    if (interv > 0) {
      total -= interv
    }
  }
  return Math.max(0, total)
}

function criarGradePadrao(
  baseEntrada = '08:00',
  baseSaida = '17:00',
  baseIniInt = '12:00',
  baseRetInt = '13:00',
  diasAtivos: DiaSemanaSigla[] = ['seg', 'ter', 'qua', 'qui', 'sex'],
): GradeSemanal {
  const duracao = calcularDuracaoHorario(baseEntrada, baseSaida, baseIniInt, baseRetInt)
  const grade: any = {}
  for (const d of DIAS_SEMANA) {
    const ativo = diasAtivos.includes(d.id)
    grade[d.id] = {
      ativo,
      hora_entrada: ativo ? baseEntrada : '',
      hora_inicio_intervalo: ativo ? baseIniInt : '',
      hora_retorno_intervalo: ativo ? baseRetInt : '',
      hora_saida: ativo ? baseSaida : '',
      duracao_min: ativo ? duracao : 0,
      atravessa_meia_noite: false,
    }
  }
  return grade as GradeSemanal
}

export default function JornadaModal({ open, onOpenChange, jornada, onSave }: JornadaModalProps) {
  const [salvando, setSalvando] = useState(false)
  const [nome, setNome] = useState(jornada?.nome || '')
  const [modoConfiguracao, setModoConfiguracao] = useState<'unico' | 'grade'>('unico')

  // Horários globais
  const [horaEntrada, setHoraEntrada] = useState(jornada?.hora_entrada || '08:00')
  const [horaInicioIntervalo, setHoraInicioIntervalo] = useState(
    jornada?.hora_inicio_intervalo || '12:00',
  )
  const [horaRetornoIntervalo, setHoraRetornoIntervalo] = useState(
    jornada?.hora_retorno_intervalo || '13:00',
  )
  const [horaSaida, setHoraSaida] = useState(jornada?.hora_saida || '17:00')
  const [diasTrabalho, setDiasTrabalho] = useState<DiaSemanaSigla[]>(
    jornada?.dias_trabalho || ['seg', 'ter', 'qua', 'qui', 'sex'],
  )
  const [diasFolga, setDiasFolga] = useState<DiaSemanaSigla[]>(
    jornada?.dias_folga || ['sab', 'dom'],
  )
  const [tipoEscala, setTipoEscala] = useState<string>(jornada?.tipo_escala || 'semanal_fixa')
  const [atravessaMeiaNoite, setAtravessaMeiaNoite] = useState<boolean>(
    Boolean(jornada?.atravessa_meia_noite),
  )

  // Grade semanal individual por dia
  const [gradeSemanal, setGradeSemanal] = useState<GradeSemanal>(() =>
    criarGradePadrao('08:00', '17:00', '12:00', '13:00', ['seg', 'ter', 'qua', 'qui', 'sex']),
  )

  const [error, setError] = useState<string | null>(null)

  // Re-sync when editing changes
  React.useEffect(() => {
    if (jornada) {
      setNome(jornada.nome || '')
      setHoraEntrada(jornada.hora_entrada || '08:00')
      setHoraInicioIntervalo(jornada.hora_inicio_intervalo || '')
      setHoraRetornoIntervalo(jornada.hora_retorno_intervalo || '')
      setHoraSaida(jornada.hora_saida || '17:00')
      setDiasTrabalho(
        (jornada.dias_trabalho as DiaSemanaSigla[]) || ['seg', 'ter', 'qua', 'qui', 'sex'],
      )
      setDiasFolga((jornada.dias_folga as DiaSemanaSigla[]) || ['sab', 'dom'])
      setTipoEscala(jornada.tipo_escala || 'semanal_fixa')
      setAtravessaMeiaNoite(Boolean(jornada.atravessa_meia_noite))

      if (jornada.grade_semanal && Object.keys(jornada.grade_semanal).length > 0) {
        setModoConfiguracao('grade')
        const gradeCarregada: any = {}
        for (const d of DIAS_SEMANA) {
          const item = (jornada.grade_semanal as any)[d.id]
          if (item) {
            gradeCarregada[d.id] = {
              ativo: Boolean(item.ativo),
              hora_entrada: item.hora_entrada || '',
              hora_inicio_intervalo: item.hora_inicio_intervalo || '',
              hora_retorno_intervalo: item.hora_retorno_intervalo || '',
              hora_saida: item.hora_saida || '',
              duracao_min: item.duracao_min ?? 0,
              atravessa_meia_noite: Boolean(item.atravessa_meia_noite),
            }
          } else {
            gradeCarregada[d.id] = {
              ativo: false,
              hora_entrada: '',
              hora_inicio_intervalo: '',
              hora_retorno_intervalo: '',
              hora_saida: '',
              duracao_min: 0,
              atravessa_meia_noite: false,
            }
          }
        }
        setGradeSemanal(gradeCarregada)
      } else {
        setModoConfiguracao('unico')
        setGradeSemanal(
          criarGradePadrao(
            jornada.hora_entrada || '08:00',
            jornada.hora_saida || '17:00',
            jornada.hora_inicio_intervalo || '12:00',
            jornada.hora_retorno_intervalo || '13:00',
            (jornada.dias_trabalho as DiaSemanaSigla[]) || ['seg', 'ter', 'qua', 'qui', 'sex'],
          ),
        )
      }
    } else {
      setNome('')
      setModoConfiguracao('unico')
      setHoraEntrada('08:00')
      setHoraInicioIntervalo('12:00')
      setHoraRetornoIntervalo('13:00')
      setHoraSaida('17:00')
      setDiasTrabalho(['seg', 'ter', 'qua', 'qui', 'sex'])
      setDiasFolga(['sab', 'dom'])
      setTipoEscala('semanal_fixa')
      setAtravessaMeiaNoite(false)
      setGradeSemanal(
        criarGradePadrao('08:00', '17:00', '12:00', '13:00', ['seg', 'ter', 'qua', 'qui', 'sex']),
      )
    }
    setError(null)
  }, [jornada, open])

  // Toggle dia de trabalho no modo único
  const toggleDiaTrabalho = (dia: DiaSemanaSigla) => {
    if (diasTrabalho.includes(dia)) {
      const novosTrabalho = diasTrabalho.filter((d) => d !== dia)
      setDiasTrabalho(novosTrabalho)
      if (!diasFolga.includes(dia)) {
        setDiasFolga([...diasFolga, dia])
      }
    } else {
      const novosTrabalho = [...diasTrabalho, dia]
      setDiasTrabalho(novosTrabalho)
      setDiasFolga(diasFolga.filter((d) => d !== dia))
    }
  }

  // Auto-detect midnight crossing no modo único
  React.useEffect(() => {
    const ent = timeStringToMinutes(horaEntrada)
    const sai = timeStringToMinutes(horaSaida)
    if (horaEntrada && horaSaida && sai < ent) {
      setAtravessaMeiaNoite(true)
    }
  }, [horaEntrada, horaSaida])

  // Cálculo da duração no modo único
  const duracaoMinUnico = calcularDuracaoHorario(
    horaEntrada,
    horaSaida,
    horaInicioIntervalo,
    horaRetornoIntervalo,
    atravessaMeiaNoite,
  )

  // Atualizar campo de um dia na grade semanal
  const handleUpdateDiaGrade = (dia: DiaSemanaSigla, updates: Partial<HorarioDiaSemana>) => {
    setGradeSemanal((prev) => {
      const diaAtual = prev[dia]
      const merged = { ...diaAtual, ...updates }
      if (merged.ativo) {
        const ent = timeStringToMinutes(merged.hora_entrada)
        const sai = timeStringToMinutes(merged.hora_saida)
        if (merged.hora_entrada && merged.hora_saida && sai < ent) {
          merged.atravessa_meia_noite = true
        }
        merged.duracao_min = calcularDuracaoHorario(
          merged.hora_entrada,
          merged.hora_saida,
          merged.hora_inicio_intervalo,
          merged.hora_retorno_intervalo,
          merged.atravessa_meia_noite,
        )
      } else {
        merged.duracao_min = 0
      }
      return { ...prev, [dia]: merged }
    })
  }

  // Botão utilitário: replicar a configuração de um dia para Terça a Sexta
  const replicarParaTercaSexta = (diaOrigem: DiaSemanaSigla = 'ter') => {
    const modelo = gradeSemanal[diaOrigem]
    if (!modelo) return
    setGradeSemanal((prev) => {
      const nova = { ...prev }
      const diasAlvo: DiaSemanaSigla[] = ['ter', 'qua', 'qui', 'sex']
      for (const d of diasAlvo) {
        nova[d] = {
          ativo: modelo.ativo,
          hora_entrada: modelo.hora_entrada,
          hora_inicio_intervalo: modelo.hora_inicio_intervalo,
          hora_retorno_intervalo: modelo.hora_retorno_intervalo,
          hora_saida: modelo.hora_saida,
          duracao_min: modelo.duracao_min,
          atravessa_meia_noite: modelo.atravessa_meia_noite,
        }
      }
      return nova
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!nome.trim()) {
      setError('O nome descritivo da jornada é obrigatório.')
      return
    }

    if (modoConfiguracao === 'unico') {
      if (!horaEntrada || !horaSaida) {
        setError('Horários de entrada e saída são obrigatórios.')
        return
      }

      if (diasTrabalho.length === 0) {
        setError('Selecione pelo menos um dia de trabalho na semana.')
        return
      }

      setSalvando(true)
      try {
        await onSave({
          nome: nome.trim(),
          hora_entrada: horaEntrada,
          hora_inicio_intervalo: horaInicioIntervalo || '',
          hora_retorno_intervalo: horaRetornoIntervalo || '',
          hora_saida: horaSaida,
          duracao_jornada_min: duracaoMinUnico,
          dias_trabalho: diasTrabalho,
          dias_folga: diasFolga,
          tipo_escala: tipoEscala as any,
          atravessa_meia_noite: atravessaMeiaNoite,
          grade_semanal: null,
        })
        onOpenChange(false)
      } catch (err: any) {
        setError(err?.message || 'Erro ao salvar jornada.')
      } finally {
        setSalvando(false)
      }
    } else {
      // Modo individual por dia da semana
      const diasAtivos = DIAS_SEMANA.filter((d) => gradeSemanal[d.id]?.ativo).map((d) => d.id)
      const diasFolgaCalculados = DIAS_SEMANA.filter((d) => !gradeSemanal[d.id]?.ativo).map(
        (d) => d.id,
      )

      if (diasAtivos.length === 0) {
        setError('Pelo menos um dia da semana deve ser marcado como dia de trabalho.')
        return
      }

      for (const d of diasAtivos) {
        const item = gradeSemanal[d]
        if (!item.hora_entrada || !item.hora_saida) {
          const nomeDia = DIAS_SEMANA.find((x) => x.id === d)?.fullLabel || d
          setError(`Informe horário de entrada e saída para ${nomeDia}.`)
          return
        }
      }

      // Referência global baseada no primeiro dia ativo para retrocompatibilidade
      const primeiroDiaAtivo = gradeSemanal[diasAtivos[0]]
      const duracaoMedia = Math.round(
        diasAtivos.reduce((acc, d) => acc + (gradeSemanal[d]?.duracao_min || 0), 0) /
          diasAtivos.length,
      )

      setSalvando(true)
      try {
        await onSave({
          nome: nome.trim(),
          hora_entrada: primeiroDiaAtivo.hora_entrada,
          hora_inicio_intervalo: primeiroDiaAtivo.hora_inicio_intervalo || '',
          hora_retorno_intervalo: primeiroDiaAtivo.hora_retorno_intervalo || '',
          hora_saida: primeiroDiaAtivo.hora_saida,
          duracao_jornada_min: duracaoMedia,
          dias_trabalho: diasAtivos,
          dias_folga: diasFolgaCalculados,
          tipo_escala: tipoEscala as any,
          atravessa_meia_noite: diasAtivos.some((d) => gradeSemanal[d]?.atravessa_meia_noite),
          grade_semanal: gradeSemanal,
        })
        onOpenChange(false)
      } catch (err: any) {
        setError(err?.message || 'Erro ao salvar jornada.')
      } finally {
        setSalvando(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 flex items-center justify-center mb-1">
            <Clock className="w-5 h-5" />
          </div>
          <DialogTitle>{jornada ? 'Editar Jornada' : 'Nova Jornada de Trabalho'}</DialogTitle>
          <DialogDescription>
            Configure turnos flexíveis, horários individuais por dia da semana (ex: Segunda
            diferente de Ter–Sex), intervalos e escalas.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Nome e Escala */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="jornadaNome" className="text-xs font-semibold">
                Nome da Jornada <span className="text-red-500">*</span>
              </Label>
              <Input
                id="jornadaNome"
                placeholder="Ex: Comercial 08h-17h, SÁBADO (Seg 10h-18h / Ter-Sex 09h-18h), etc."
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold">Tipo de Escala</Label>
              <Select value={tipoEscala} onValueChange={setTipoEscala}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Selecione a escala" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal_fixa">Semanal Fixa (Seg a Sex / Seg a Sáb)</SelectItem>
                  <SelectItem value="escala_12x36">Plantão / Escala 12x36</SelectItem>
                  <SelectItem value="escala_6x1">Escala 6x1</SelectItem>
                  <SelectItem value="personalizada">Personalizada / Flexível por Dia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Alternância de Modo: Horário Único vs Horários Individuais por Dia */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold block text-slate-700">
              Modo de Definição de Horários
            </Label>
            <Tabs
              value={modoConfiguracao}
              onValueChange={(v) => setModoConfiguracao(v as 'unico' | 'grade')}
              className="w-full"
            >
              <TabsList className="grid grid-cols-2 w-full bg-slate-100 p-1 rounded-xl">
                <TabsTrigger
                  value="unico"
                  className="text-xs font-semibold py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-xs"
                >
                  Horário único para todos os dias
                </TabsTrigger>
                <TabsTrigger
                  value="grade"
                  className="text-xs font-semibold py-1.5 data-[state=active]:bg-[#D4AF37]/20 data-[state=active]:text-slate-950 data-[state=active]:font-bold data-[state=active]:shadow-xs"
                >
                  Horários individuais por dia da semana
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {modoConfiguracao === 'unico' ? (
            <>
              {/* Horários Únicos */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Horários Previstos (24h)</span>
                  <span className="text-xs font-mono font-semibold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                    Líquido: {minutesToHoursText(duracaoMinUnico)} ({duracaoMinUnico} min)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="space-y-1">
                    <Label
                      htmlFor="horaEntrada"
                      className="text-[11px] font-semibold text-slate-600"
                    >
                      Entrada
                    </Label>
                    <Input
                      id="horaEntrada"
                      type="time"
                      value={horaEntrada}
                      onChange={(e) => setHoraEntrada(e.target.value)}
                      required
                      className="font-mono text-xs h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label
                      htmlFor="horaIniInt"
                      className="text-[11px] font-semibold text-slate-600"
                    >
                      Início Intervalo
                    </Label>
                    <Input
                      id="horaIniInt"
                      type="time"
                      value={horaInicioIntervalo}
                      onChange={(e) => setHoraInicioIntervalo(e.target.value)}
                      className="font-mono text-xs h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label
                      htmlFor="horaRetInt"
                      className="text-[11px] font-semibold text-slate-600"
                    >
                      Fim Intervalo
                    </Label>
                    <Input
                      id="horaRetInt"
                      type="time"
                      value={horaRetornoIntervalo}
                      onChange={(e) => setHoraRetornoIntervalo(e.target.value)}
                      className="font-mono text-xs h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="horaSaida" className="text-[11px] font-semibold text-slate-600">
                      Saída Prevista
                    </Label>
                    <Input
                      id="horaSaida"
                      type="time"
                      value={horaSaida}
                      onChange={(e) => setHoraSaida(e.target.value)}
                      required
                      className="font-mono text-xs h-9"
                    />
                  </div>
                </div>

                {/* Virada de meia-noite switch */}
                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">
                      Ultrapassa a meia-noite (Turno Noturno)
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Ex: Entrada às 22:00 e término no dia seguinte às 06:00.
                    </p>
                  </div>
                  <Switch checked={atravessaMeiaNoite} onCheckedChange={setAtravessaMeiaNoite} />
                </div>
              </div>

              {/* Dias de Trabalho */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold block">
                  Dias de Trabalho na Semana <span className="text-red-500">*</span>
                </Label>
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                  {DIAS_SEMANA.map((dia) => {
                    const ativo = diasTrabalho.includes(dia.id)
                    return (
                      <button
                        key={dia.id}
                        type="button"
                        onClick={() => toggleDiaTrabalho(dia.id)}
                        className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                          ativo
                            ? 'bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-slate-950 font-bold border-[#D4AF37] shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {dia.label}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-slate-500">
                  Dias não selecionados são automaticamente computados como folga no espelho.
                </p>
              </div>
            </>
          ) : (
            /* Modo Grade Semanal por Dia */
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                <div className="text-xs text-amber-950">
                  <span className="font-bold block">Grade por Dia da Semana:</span>
                  Defina entrada, intervalo e saída específicos para cada dia (ex: Segunda
                  10:00–18:00 com 1h30 de almoço; Ter–Sex 09:00–18:00).
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => replicarParaTercaSexta('ter')}
                  className="text-xs h-8 border-amber-300 bg-white hover:bg-amber-100/60 text-amber-900 shrink-0 font-semibold"
                >
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  Replicar Terça p/ Ter–Sex
                </Button>
              </div>

              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {DIAS_SEMANA.map((dia) => {
                  const item = gradeSemanal[dia.id] || {
                    ativo: false,
                    hora_entrada: '',
                    hora_inicio_intervalo: '',
                    hora_retorno_intervalo: '',
                    hora_saida: '',
                    duracao_min: 0,
                    atravessa_meia_noite: false,
                  }
                  const duracao = item.ativo ? item.duracao_min : 0

                  return (
                    <div
                      key={dia.id}
                      className={`p-3 rounded-xl border transition-all ${
                        item.ativo
                          ? 'bg-white border-slate-200 shadow-xs'
                          : 'bg-slate-50/70 border-slate-200/60 opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`chk-${dia.id}`}
                            checked={item.ativo}
                            onCheckedChange={(checked) =>
                              handleUpdateDiaGrade(dia.id, {
                                ativo: Boolean(checked),
                                hora_entrada: checked ? item.hora_entrada || '08:00' : '',
                                hora_inicio_intervalo: checked
                                  ? item.hora_inicio_intervalo || '12:00'
                                  : '',
                                hora_retorno_intervalo: checked
                                  ? item.hora_retorno_intervalo || '13:00'
                                  : '',
                                hora_saida: checked ? item.hora_saida || '17:00' : '',
                              })
                            }
                          />
                          <Label
                            htmlFor={`chk-${dia.id}`}
                            className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-1.5"
                          >
                            <span className="w-8 inline-block uppercase text-[#D4AF37] font-black">
                              {dia.label}
                            </span>
                            <span>{dia.fullLabel}</span>
                          </Label>
                        </div>

                        {item.ativo ? (
                          <span className="text-[11px] font-mono font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            Líquido: {minutesToHoursText(duracao)} ({duracao} min)
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                            Folga Semanal
                          </span>
                        )}
                      </div>

                      {item.ativo && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100">
                          <div>
                            <Label className="text-[10px] text-slate-500 font-semibold block mb-0.5">
                              Entrada
                            </Label>
                            <Input
                              type="time"
                              value={item.hora_entrada}
                              onChange={(e) =>
                                handleUpdateDiaGrade(dia.id, { hora_entrada: e.target.value })
                              }
                              className="font-mono text-xs h-8"
                              required
                            />
                          </div>

                          <div>
                            <Label className="text-[10px] text-slate-500 font-semibold block mb-0.5">
                              Início Almoço
                            </Label>
                            <Input
                              type="time"
                              value={item.hora_inicio_intervalo || ''}
                              onChange={(e) =>
                                handleUpdateDiaGrade(dia.id, {
                                  hora_inicio_intervalo: e.target.value,
                                })
                              }
                              className="font-mono text-xs h-8"
                            />
                          </div>

                          <div>
                            <Label className="text-[10px] text-slate-500 font-semibold block mb-0.5">
                              Fim Almoço
                            </Label>
                            <Input
                              type="time"
                              value={item.hora_retorno_intervalo || ''}
                              onChange={(e) =>
                                handleUpdateDiaGrade(dia.id, {
                                  hora_retorno_intervalo: e.target.value,
                                })
                              }
                              className="font-mono text-xs h-8"
                            />
                          </div>

                          <div>
                            <Label className="text-[10px] text-slate-500 font-semibold block mb-0.5">
                              Saída
                            </Label>
                            <Input
                              type="time"
                              value={item.hora_saida}
                              onChange={(e) =>
                                handleUpdateDiaGrade(dia.id, { hora_saida: e.target.value })
                              }
                              className="font-mono text-xs h-8"
                              required
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={salvando}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando}
              className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold hover:brightness-110 border-0"
            >
              {salvando ? 'Salvando...' : jornada ? 'Salvar Alterações' : 'Cadastrar Jornada'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
