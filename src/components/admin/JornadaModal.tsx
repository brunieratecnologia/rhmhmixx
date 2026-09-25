import React, { useState } from 'react'
import type { Jornada } from '@/types/rh'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { timeStringToMinutes, minutesToHoursText } from '@/lib/calculoHoras'
import { AlertCircle, Clock } from 'lucide-react'

interface JornadaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jornada?: Jornada | null
  onSave: (data: Partial<Jornada>) => Promise<void>
}

const DIAS_SEMANA = [
  { id: 'seg', label: 'Seg' },
  { id: 'ter', label: 'Ter' },
  { id: 'qua', label: 'Qua' },
  { id: 'qui', label: 'Qui' },
  { id: 'sex', label: 'Sex' },
  { id: 'sab', label: 'Sáb' },
  { id: 'dom', label: 'Dom' },
] as const

export default function JornadaModal({ open, onOpenChange, jornada, onSave }: JornadaModalProps) {
  const [nome, setNome] = useState(jornada?.nome || '')
  const [horaEntrada, setHoraEntrada] = useState(jornada?.hora_entrada || '08:00')
  const [horaInicioIntervalo, setHoraInicioIntervalo] = useState(
    jornada?.hora_inicio_intervalo || '12:00',
  )
  const [horaRetornoIntervalo, setHoraRetornoIntervalo] = useState(
    jornada?.hora_retorno_intervalo || '13:00',
  )
  const [horaSaida, setHoraSaida] = useState(jornada?.hora_saida || '17:00')
  const [diasTrabalho, setDiasTrabalho] = useState<string[]>(
    jornada?.dias_trabalho || ['seg', 'ter', 'qua', 'qui', 'sex'],
  )
  const [diasFolga, setDiasFolga] = useState<string[]>(jornada?.dias_folga || ['sab', 'dom'])
  const [tipoEscala, setTipoEscala] = useState<string>(jornada?.tipo_escala || 'semanal_fixa')
  const [atravessaMeiaNoite, setAtravessaMeiaNoite] = useState<boolean>(
    Boolean(jornada?.atravessa_meia_noite),
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-sync when editing changes
  React.useEffect(() => {
    if (jornada) {
      setNome(jornada.nome || '')
      setHoraEntrada(jornada.hora_entrada || '08:00')
      setHoraInicioIntervalo(jornada.hora_inicio_intervalo || '')
      setHoraRetornoIntervalo(jornada.hora_retorno_intervalo || '')
      setHoraSaida(jornada.hora_saida || '17:00')
      setDiasTrabalho(jornada.dias_trabalho || ['seg', 'ter', 'qua', 'qui', 'sex'])
      setDiasFolga(jornada.dias_folga || ['sab', 'dom'])
      setTipoEscala(jornada.tipo_escala || 'semanal_fixa')
      setAtravessaMeiaNoite(Boolean(jornada.atravessa_meia_noite))
    } else {
      setNome('')
      setHoraEntrada('08:00')
      setHoraInicioIntervalo('12:00')
      setHoraRetornoIntervalo('13:00')
      setHoraSaida('17:00')
      setDiasTrabalho(['seg', 'ter', 'qua', 'qui', 'sex'])
      setDiasFolga(['sab', 'dom'])
      setTipoEscala('semanal_fixa')
      setAtravessaMeiaNoite(false)
    }
    setError(null)
  }, [jornada, open])

  // Toggle dia de trabalho
  const toggleDiaTrabalho = (dia: string) => {
    if (diasTrabalho.includes(dia)) {
      setDiasTrabalho(diasTrabalho.filter((d) => d !== dia))
      if (!diasFolga.includes(dia)) {
        setDiasFolga([...diasFolga, dia])
      }
    } else {
      setDiasTrabalho([...diasTrabalho, dia])
      setDiasFolga(diasFolga.filter((d) => d !== dia))
    }
  }

  // Auto-detect midnight crossing
  React.useEffect(() => {
    const ent = timeStringToMinutes(horaEntrada)
    const sai = timeStringToMinutes(horaSaida)
    if (horaEntrada && horaSaida && sai < ent) {
      setAtravessaMeiaNoite(true)
    }
  }, [horaEntrada, horaSaida])

  // Calculate projected daily duration in minutes
  const calcularDuracao = () => {
    const ent = timeStringToMinutes(horaEntrada)
    let sai = timeStringToMinutes(horaSaida)
    if (sai < ent || atravessaMeiaNoite) {
      sai += 24 * 60
    }
    let total = sai - ent
    if (horaInicioIntervalo && horaRetornoIntervalo) {
      const intIni = timeStringToMinutes(horaInicioIntervalo)
      let intFim = timeStringToMinutes(horaRetornoIntervalo)
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

  const duracaoMin = calcularDuracao()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!nome.trim()) {
      setError('O nome descritivo da jornada é obrigatório.')
      return
    }

    if (!horaEntrada || !horaSaida) {
      setError('Horários de entrada e saída são obrigatórios.')
      return
    }

    if (diasTrabalho.length === 0) {
      setError('Selecione pelo menos um dia de trabalho na semana.')
      return
    }

    setSaving(true)
    try {
      await onSave({
        nome: nome.trim(),
        hora_entrada: horaEntrada,
        hora_inicio_intervalo: horaInicioIntervalo || '',
        hora_retorno_intervalo: horaRetornoIntervalo || '',
        hora_saida: horaSaida,
        duracao_jornada_min: duracaoMin,
        dias_trabalho: diasTrabalho as any,
        dias_folga: diasFolga as any,
        tipo_escala: tipoEscala as any,
        atravessa_meia_noite: atravessaMeiaNoite,
      })
      onOpenChange(false)
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar jornada.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 flex items-center justify-center mb-1">
            <Clock className="w-5 h-5" />
          </div>
          <DialogTitle>{jornada ? 'Editar Jornada' : 'Nova Jornada de Trabalho'}</DialogTitle>
          <DialogDescription>
            Configure dias, turnos flexíveis, intervalos e escalas individualizadas. Suporta virada
            de meia-noite.
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
                placeholder="Ex: Comercial 08h-17h, Plantão 12x36 Noturno, etc."
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
                  <SelectItem value="personalizada">Personalizada / Flexível</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Horários */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Horários Previstos (24h)</span>
              <span className="text-xs font-mono font-semibold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                Líquido: {minutesToHoursText(duracaoMin)} ({duracaoMin} min)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="space-y-1">
                <Label htmlFor="horaEntrada" className="text-[11px] font-semibold text-slate-600">
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
                <Label htmlFor="horaIniInt" className="text-[11px] font-semibold text-slate-600">
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
                <Label htmlFor="horaRetInt" className="text-[11px] font-semibold text-slate-600">
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

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
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
            </Button>{' '}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
