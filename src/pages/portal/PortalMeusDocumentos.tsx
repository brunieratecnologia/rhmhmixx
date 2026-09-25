import React, { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { PortalContextType } from '@/pages/portal/PortalTypes'
import { portalService, documentosService } from '@/services/rh'
import type { Documento } from '@/types/rh'
import { formatBRDate } from '@/lib/formatters'
import { FolderOpen, Download, Calendar, Lock, FileCheck, ShieldCheck, Tag } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const CATEGORIAS_LABELS: Record<string, string> = {
  contrato_trabalho: 'Contrato de Trabalho',
  documentacao_admissional: 'Documentação Admissional',
  atestado_medico: 'Atestado Médico',
  comprovantes: 'Comprovantes',
  termos_internos: 'Termos e Políticas',
  documentos_ferias: 'Documentos de Férias',
  outros: 'Outros Documentos',
}

export default function PortalMeusDocumentos() {
  const { funcionario } = useOutletContext<PortalContextType>()
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    if (!funcionario?.id) return
    let isMounted = true

    async function loadDocs() {
      try {
        const list = await portalService.getMeusDocumentos(funcionario.id)
        if (isMounted) setDocumentos(list)
      } catch (err) {
        console.error('Erro ao carregar documentos do colaborador:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadDocs()
    return () => {
      isMounted = false
    }
  }, [funcionario])

  if (!funcionario) return null

  const handleDownload = async (doc: Documento) => {
    try {
      setDownloadingId(doc.id)
      await documentosService.logAcessoVisualizacao(doc, 'download')
      const url = await documentosService.getSecureUrl(doc)
      if (url) {
        window.open(url, '_blank')
      }
    } catch (err) {
      console.error('Erro ao baixar documento:', err)
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-[#0F1624] via-[#161F33] to-[#0F1624] border border-[#D4AF37]/30 p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-[#7C3AED]/20 text-purple-300 border-[#7C3AED]/40 text-xs">
              Central do Colaborador
            </Badge>
            <span className="text-xs text-slate-400">Arquivos Pessoais e Corporativos</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-amber-100 flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-[#7C3AED]" />
            Meus Documentos
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Acesse contratos, termos e comprovantes disponibilizados para você pela empresa.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#070B11] border border-[#D4AF37]/20 text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
          <span>Acesso seguro verificado</span>
        </div>
      </div>

      {/* Lista de Documentos */}
      <Card className="bg-[#0F1624] border-[#D4AF37]/20 text-amber-50">
        <CardHeader className="border-b border-[#D4AF37]/10 pb-3">
          <CardTitle className="text-sm font-bold text-amber-100 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-[#D4AF37]" />
            Documentos Disponibilizados
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <div className="w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Carregando documentos...
            </div>
          ) : documentos.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Nenhum documento liberado na sua ficha até o momento.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documentos.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 rounded-xl bg-[#0A0E17] border border-[#D4AF37]/20 flex flex-col justify-between gap-3 hover:border-[#D4AF37]/40 transition-all"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-slate-200 truncate">{doc.nome}</span>
                      <Badge
                        variant="outline"
                        className="text-[10px] border-[#D4AF37]/30 text-amber-300"
                      >
                        {CATEGORIAS_LABELS[doc.categoria] || doc.categoria}
                      </Badge>
                    </div>

                    {doc.descricao && (
                      <p className="text-xs text-slate-400 line-clamp-2">{doc.descricao}</p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                      <span>Enviado: {formatBRDate(doc.data_envio || doc.created)}</span>
                      {doc.data_validade && (
                        <span>• Validade: {formatBRDate(doc.data_validade)}</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">Arquivo autenticado</span>
                    <Button
                      size="sm"
                      onClick={() => handleDownload(doc)}
                      disabled={downloadingId === doc.id || !doc.arquivo}
                      className="bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-slate-950 font-bold hover:brightness-110 shadow-sm text-xs h-8 px-3"
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      {downloadingId === doc.id ? 'Baixando...' : 'Download'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
