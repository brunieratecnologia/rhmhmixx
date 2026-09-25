import React, { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { PortalContextType } from '@/pages/portal/PortalTypes'
import { portalService } from '@/services/rh'
import type { Solicitacao } from '@/types/rh'
import { formatBRDate } from '@/lib/formatters'
import {
  Send,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileQuestion,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

export default function PortalMinhasSolicitacoes() {
  const { funcionario } = useOutletContext<PortalContextType>()
  const { toast } = useToast()
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [tipo, setTipo] = useState<Solicitacao['tipo']>('correcao_ponto')
  const [motivo, setMotivo] = useState('')
  const [detalhes, setDetalhes] = useState('')

  const loadSolicitacoes = async () => {
    if (!funcionario?.id) return
    try {
      const list = await portalService.getMinhasSolicitacoes(funcionario.id)
      setSolicitacoes(list)
    } catch (err) {
      console.error('Erro ao carregar solicitações:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSolicitacoes()
  }, [funcionario])

  if (!funcionario) return null

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!motivo.trim()) {
      toast({
        title: 'Atenção',
        description: 'Informe o motivo da solicitação.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(true)
      await portalService.criarSolicitacao({
        funcionarioId: funcionario.id,
        tipo,
        motivo,
        detalhes,
      })

      toast({
        title: 'Solicitação Enviada',
        description: 'Sua solicitação foi encaminhada para análise do Recursos Humanos.',
      })

      setMotivo('')
      setDetalhes('')
      setModalOpen(false)
      await loadSolicitacoes()
    } catch (err: any) {
      toast({
        title: 'Erro ao enviar',
        description: err.message || 'Não foi possível registrar a solicitação.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-[#0F1624] via-[#161F33] to-[#0F1624] border border-[#D4AF37]/30 p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-[#7C3AED]/20 text-purple-300 border-[#7C3AED]/40 text-xs">
              Canal Direto com o RH
            </Badge>
            <span className="text-xs text-slate-400">Ajustes de Ponto, Férias e Ausências</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-amber-100 flex items-center gap-2">
            <Send className="w-6 h-6 text-[#D4AF37]" />
            Minhas Solicitações
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Envie justificativas de esquecimento de batida, solicitações de períodos de férias e
            pedidos de correção cadastral.
          </p>
        </div>

        <Button
          onClick={() => setModalOpen(true)}
          className="bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-slate-950 font-bold hover:brightness-110 shadow-md shadow-[#D4AF37]/20 text-xs h-10 px-4 shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nova Solicitação
        </Button>
      </div>

      {/* Lista de Solicitações */}
      <Card className="bg-[#0F1624] border-[#D4AF37]/20 text-amber-50">
        <CardHeader className="border-b border-[#D4AF37]/10 pb-3">
          <CardTitle className="text-sm font-bold text-amber-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#D4AF37]" />
            Histórico de Solicitações Enviadas
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <div className="w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Carregando solicitações...
            </div>
          ) : solicitacoes.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Você ainda não enviou nenhuma solicitação. Clique em "Nova Solicitação" caso precise
              contatar o RH.
            </div>
          ) : (
            <div className="space-y-3">
              {solicitacoes.map((sol) => (
                <div
                  key={sol.id}
                  className="p-4 rounded-xl bg-[#0A0E17] border border-[#D4AF37]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-200">{sol.motivo}</span>
                      <Badge
                        variant="outline"
                        className="text-[10px] border-[#D4AF37]/30 text-amber-300 capitalize"
                      >
                        {sol.tipo.replace('_', ' ')}
                      </Badge>
                    </div>

                    {sol.detalhes && <p className="text-xs text-slate-400">{sol.detalhes}</p>}

                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span>Enviado em {formatBRDate(sol.created)}</span>
                      {sol.decidido_em && (
                        <span>• Avaliado em {formatBRDate(sol.decidido_em)}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {sol.status === 'pendente' && (
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                        Pendente de Análise
                      </Badge>
                    )}
                    {sol.status === 'aprovado' && (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Aprovado pelo RH
                      </Badge>
                    )}
                    {sol.status === 'recusado' && (
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/30 flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        Recusado
                      </Badge>
                    )}
                    {sol.status === 'cancelado' && (
                      <Badge className="bg-slate-700 text-slate-300 border-slate-600">
                        Cancelado
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Criação de Solicitação */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#0F1624] border-[#D4AF37]/30 text-amber-50 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-amber-100 flex items-center gap-2">
              <Send className="w-5 h-5 text-[#D4AF37]" />
              Nova Solicitação ao RH
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCriar} className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Tipo de Solicitação</Label>
              <Select value={tipo} onValueChange={(val: any) => setTipo(val)}>
                <SelectTrigger className="bg-[#070B11] border-[#D4AF37]/30 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0F1624] border-[#D4AF37]/30 text-slate-200">
                  <SelectItem value="correcao_ponto">Ajuste / Esquecimento de Ponto</SelectItem>
                  <SelectItem value="ferias">Agendamento ou Fracionamento de Férias</SelectItem>
                  <SelectItem value="documento">Declaração ou Documento</SelectItem>
                  <SelectItem value="justificativa">Justificativa de Ausência</SelectItem>
                  <SelectItem value="outro">Outro Assunto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-300">Assunto / Motivo Resumido</Label>
              <Input
                required
                placeholder="Ex: Esquecimento de batida na saída do dia 12/03"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="bg-[#070B11] border-[#D4AF37]/30 text-slate-200 placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-300">Detalhes e Informações Adicionais</Label>
              <Textarea
                rows={4}
                placeholder="Explique o horário exato, motivo da divergência ou período de férias pretendido..."
                value={detalhes}
                onChange={(e) => setDetalhes(e.target.value)}
                className="bg-[#070B11] border-[#D4AF37]/30 text-slate-200 placeholder:text-slate-500"
              />
            </div>

            <div className="p-3 rounded-lg bg-[#7C3AED]/10 border border-[#7C3AED]/20 text-[11px] text-slate-300 flex items-start gap-2">
              <Info className="w-4 h-4 text-purple-300 shrink-0 mt-0.5" />
              <span>
                As solicitações de ajuste de batidas serão analisadas pelo gestor de RH durante o
                processo de fechamento mensal.
              </span>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="border-slate-700 text-slate-400 hover:bg-slate-800 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-slate-950 font-bold hover:brightness-110 shadow-sm text-xs"
              >
                {saving ? 'Enviando...' : 'Enviar Solicitação'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
