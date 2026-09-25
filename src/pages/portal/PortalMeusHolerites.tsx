import React, { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { PortalContextType } from '@/pages/portal/PortalTypes'
import { portalService, holeritesService } from '@/services/rh'
import type { Holerite } from '@/types/rh'
import { formatBRDate } from '@/lib/formatters'
import { FileText, Download, Calendar, Lock, Eye, AlertCircle, FileCheck } from 'lucide-react'
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

export default function PortalMeusHolerites() {
  const { funcionario } = useOutletContext<PortalContextType>()
  const [holerites, setHolerites] = useState<Holerite[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    if (!funcionario?.id) return
    let isMounted = true

    async function loadHolerites() {
      try {
        const list = await portalService.getMeusHolerites(funcionario.id)
        if (isMounted) setHolerites(list)
      } catch (err) {
        console.error('Erro ao carregar holerites:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadHolerites()
    return () => {
      isMounted = false
    }
  }, [funcionario])

  if (!funcionario) return null

  const handleDownload = async (h: Holerite) => {
    try {
      setDownloadingId(h.id)
      await holeritesService.logAcesso(h, 'download')
      const url = await holeritesService.getSecureUrl(h)
      if (url) {
        window.open(url, '_blank')
      }
    } catch (err) {
      console.error('Erro ao baixar holerite:', err)
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-[#0F1624] via-[#151D2C] to-[#0F1624] border border-[#D4AF37]/30 p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-[#D4AF37]/20 text-amber-200 border-[#D4AF37]/40 text-xs">
              Acesso Seguro e Individual
            </Badge>
            <span className="text-xs text-slate-400">Disponibilização Mensal pelo RH</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-amber-100 flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#D4AF37]" />
            Meus Holerites e Contracheques
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Faça download dos seus recibos de pagamento de salário e adiantamentos mensais em PDF
            seguro.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#070B11] border border-[#D4AF37]/20 text-xs text-slate-300">
          <Lock className="w-4 h-4 text-[#D4AF37]" />
          <span>Visível apenas para você</span>
        </div>
      </div>

      {/* Lista de Holerites */}
      <Card className="bg-[#0F1624] border-[#D4AF37]/20 text-amber-50">
        <CardHeader className="border-b border-[#D4AF37]/10 pb-3">
          <CardTitle className="text-sm font-bold text-amber-100 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-[#D4AF37]" />
            Holerites Disponíveis por Competência
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <div className="w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Carregando seus holerites...
            </div>
          ) : holerites.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Nenhum holerite foi disponibilizado pelo RH até o momento.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {holerites.map((h) => (
                <div
                  key={h.id}
                  className="p-4 rounded-xl bg-[#0A0E17] border border-[#D4AF37]/20 flex items-center justify-between gap-4 hover:border-[#D4AF37]/40 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center shrink-0 text-[#D4AF37]">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-slate-200">
                        {MESES[h.competencia_mes - 1]} / {h.competencia_ano}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Disponibilizado em {formatBRDate(h.data_envio || h.created)}
                      </p>
                      {h.versao && h.versao > 1 && (
                        <span className="text-[10px] text-amber-400">
                          Versão atualizada ({h.versao}ª retificação)
                        </span>
                      )}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleDownload(h)}
                    disabled={downloadingId === h.id || !h.arquivo}
                    className="bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-slate-950 font-bold hover:brightness-110 shadow-sm text-xs h-9 px-3 shrink-0"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    {downloadingId === h.id ? 'Abrindo...' : 'Baixar PDF'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
