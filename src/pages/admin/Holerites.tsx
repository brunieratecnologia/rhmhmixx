import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { funcionariosService, holeritesService } from '@/services/rh'
import { useAuth } from '@/contexts/AuthContext'
import type { Holerite, HoleriteVersao, Funcionario } from '@/types/rh'
import { formatBRDate } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  RefreshCw,
  Clock,
  ShieldCheck,
  History,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Layers,
  ArrowUpRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const MESES = [
  { valor: 1, label: 'Janeiro' },
  { valor: 2, label: 'Fevereiro' },
  { valor: 3, label: 'Março' },
  { valor: 4, label: 'Abril' },
  { valor: 5, label: 'Maio' },
  { valor: 6, label: 'Junho' },
  { valor: 7, label: 'Julho' },
  { valor: 8, label: 'Agosto' },
  { valor: 9, label: 'Setembro' },
  { valor: 10, label: 'Outubro' },
  { valor: 11, label: 'Novembro' },
  { valor: 12, label: 'Dezembro' },
]

export default function HoleritesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [holerites, setHolerites] = useState<Holerite[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [selectedFuncionario, setSelectedFuncionario] = useState<string>(
    searchParams.get('funcionarioId') || 'todos',
  )
  const [selectedAno, setSelectedAno] = useState<number>(currentYear)
  const [selectedMes, setSelectedMes] = useState<number>(0) // 0 = todos
  const [searchTerm, setSearchTerm] = useState('')

  // Modais
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [substituirModalOpen, setSubstituirModalOpen] = useState(false)
  const [versoesModalOpen, setVersoesModalOpen] = useState(false)
  const [viewModalOpen, setViewModalOpen] = useState(false)

  const [selectedHolerite, setSelectedHolerite] = useState<Holerite | null>(null)
  const [historicoVersoes, setHistoricoVersoes] = useState<HoleriteVersao[]>([])
  const [loadingVersoes, setLoadingVersoes] = useState(false)

  const [previewUrl, setPreviewUrl] = useState('')
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Form Upload
  const [formFuncionario, setFormFuncionario] = useState('')
  const [formMes, setFormMes] = useState<number>(currentMonth)
  const [formAno, setFormAno] = useState<number>(currentYear)
  const [formArquivo, setFormArquivo] = useState<File | null>(null)
  const [formObservacoes, setFormObservacoes] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Form Substituição
  const [subArquivo, setSubArquivo] = useState<File | null>(null)
  const [subMotivo, setSubMotivo] = useState('')
  const [subObservacoes, setSubObservacoes] = useState('')
  const [subSubmitting, setSubSubmitting] = useState(false)

  // Carregar dados
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [holeritesData, funcsData] = await Promise.all([
        holeritesService.list({
          funcionarioId: selectedFuncionario !== 'todos' ? selectedFuncionario : undefined,
          competenciaAno: selectedAno,
          competenciaMes: selectedMes > 0 ? selectedMes : undefined,
          search: searchTerm,
        }),
        funcionariosService.listAll("situacao = 'ativo'"),
      ])
      setHolerites(holeritesData)
      setFuncionarios(funcsData)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar holerites',
        description: err.message || 'Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [selectedFuncionario, selectedAno, selectedMes, searchTerm, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Validação estrita de arquivo (PDF exclusivo para holerite)
  const validateHoleritePdf = (file: File): boolean => {
    const MAX_SIZE = 10 * 1024 * 1024 // 10MB
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast({
        title: 'Formato inválido',
        description: 'Holerites devem ser enviados exclusivamente em formato PDF.',
        variant: 'destructive',
      })
      return false
    }

    if (file.size > MAX_SIZE) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo do comprovante PDF é de 10 MB.',
        variant: 'destructive',
      })
      return false
    }

    return true
  }

  // Upload inicial de holerite
  const handleUploadHolerite = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formFuncionario) {
      toast({
        title: 'Selecione o funcionário',
        description: 'Informe o colaborador ao qual pertence este holerite.',
        variant: 'destructive',
      })
      return
    }

    if (!formArquivo) {
      toast({
        title: 'Anexe o holerite em PDF',
        description: 'O arquivo PDF do holerite é obrigatório.',
        variant: 'destructive',
      })
      return
    }

    try {
      setFormSubmitting(true)
      await holeritesService.create({
        funcionario: formFuncionario,
        competencia_mes: formMes,
        competencia_ano: formAno,
        arquivo: formArquivo,
        observacoes: formObservacoes,
        usuario_responsavel: user?.id,
      })

      toast({
        title: 'Holerite cadastrado com sucesso!',
        description: `Competência ${String(formMes).padStart(2, '0')}/${formAno} salva com armazenamento seguro.`,
      })

      setUploadModalOpen(false)
      setFormFuncionario('')
      setFormArquivo(null)
      setFormObservacoes('')
      loadData()
    } catch (err: any) {
      toast({
        title: 'Não foi possível salvar o holerite',
        description: err.message || 'Falha ao processar o arquivo.',
        variant: 'destructive',
      })
    } finally {
      setFormSubmitting(false)
    }
  }

  // Substituir holerite incorreto com histórico de versões
  const handleSubstituirHolerite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedHolerite) return

    if (!subArquivo) {
      toast({
        title: 'Novo arquivo PDF obrigatório',
        description: 'Selecione o arquivo PDF corrigido.',
        variant: 'destructive',
      })
      return
    }

    if (!subMotivo.trim() || subMotivo.trim().length < 5) {
      toast({
        title: 'Motivo obrigatório',
        description:
          'Descreva a razão da retificação (ex: Correção de horas extras, reajuste retroativo).',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubSubmitting(true)
      await holeritesService.substituir(selectedHolerite.id, {
        arquivo: subArquivo,
        motivo_substituicao: subMotivo,
        observacoes: subObservacoes || selectedHolerite.observacoes,
        usuario_responsavel: user?.id,
      })

      toast({
        title: 'Holerite retificado com sucesso!',
        description:
          'A versão anterior foi arquivada no histórico e a nova versão v' +
          ((selectedHolerite.versao || 1) + 1) +
          ' está ativa.',
      })

      setSubstituirModalOpen(false)
      setSelectedHolerite(null)
      setSubArquivo(null)
      setSubMotivo('')
      setSubObservacoes('')
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao substituir holerite',
        description: err.message || 'Falha na comunicação com o servidor.',
        variant: 'destructive',
      })
    } finally {
      setSubSubmitting(false)
    }
  }

  // Abrir histórico de versões
  const handleOpenVersoes = async (holerite: Holerite) => {
    setSelectedHolerite(holerite)
    setLoadingVersoes(true)
    setVersoesModalOpen(true)
    try {
      const versoes = await holeritesService.listVersoes(holerite.id)
      setHistoricoVersoes(versoes)
    } catch (err) {
      console.error('Erro ao carregar histórico de versões:', err)
    } finally {
      setLoadingVersoes(false)
    }
  }

  // Visualizar PDF com segurança
  const handleOpenView = async (holerite: Holerite | HoleriteVersao) => {
    setLoadingPreview(true)
    setViewModalOpen(true)
    try {
      const url = await holeritesService.getSecureUrl(holerite)
      setPreviewUrl(url)
      await holeritesService.logAcesso(holerite, 'view')
    } catch (err) {
      console.error('Erro ao abrir preview:', err)
    } finally {
      setLoadingPreview(false)
    }
  }

  // Download seguro
  const handleDownload = async (record: Holerite | HoleriteVersao) => {
    try {
      const url = await holeritesService.getSecureUrl(record)
      if (!url) throw new Error('Arquivo não disponível.')

      await holeritesService.logAcesso(record, 'download')

      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      const fNome = (record as any).expand?.funcionario?.nome?.replace(/\s+/g, '_') || 'holerite'
      a.download = `Holerite_${String((record as any).competencia_mes).padStart(2, '0')}-${(record as any).competencia_ano}_${fNome}_v${(record as any).versao || 1}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(blobUrl)

      toast({
        title: 'Download seguro realizado',
        description: 'Acesso registrado nos logs de auditoria do sistema.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao baixar holerite',
        description: err.message || 'Falha ao autorizar download.',
        variant: 'destructive',
      })
    }
  }

  // Anos disponíveis para filtro (atual - 2 até atual + 1)
  const anosDisponiveis = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1]

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
            <span className="text-xs font-bold text-[#2563EB] uppercase tracking-wider">
              Etapa 5 • Folha e Comprovantes
            </span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Central de Holerites
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Repositório seguro de comprovantes de pagamento em PDF, pesquisa por competência e
            histórico auditado de versões.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => loadData()}
            variant="outline"
            size="sm"
            className="text-xs h-9 border-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            onClick={() => {
              if (selectedFuncionario !== 'todos') {
                setFormFuncionario(selectedFuncionario)
              }
              setUploadModalOpen(true)
            }}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs h-9 font-semibold shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Enviar Holerite
          </Button>
        </div>
      </div>

      {/* 2. Banner de Regras de Segurança */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#1E3A8A]">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-[#2563EB] shrink-0" />
          <div>
            <span className="font-bold block">Controle Estrito de Privacidade & Regras de API</span>
            <span className="text-slate-600 block">
              Arquivos protegidos no servidor. Funcionários têm permissão restrita exclusivamente
              aos seus próprios holerites via PocketBase API Rules.
            </span>
          </div>
        </div>
        <Badge
          variant="outline"
          className="border-blue-300 text-[#1E3A8A] bg-white font-mono shrink-0"
        >
          PDF 100% Auditado
        </Badge>
      </div>

      {/* 3. Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Busca por funcionário */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar por colaborador ou matrícula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          {/* Filtro Funcionário Dropdown */}
          <div>
            <Select
              value={selectedFuncionario}
              onValueChange={(val) => {
                setSelectedFuncionario(val)
                if (val !== 'todos') {
                  setSearchParams({ funcionarioId: val })
                } else {
                  setSearchParams({})
                }
              }}
            >
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Todos os funcionários" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os colaboradores</SelectItem>
                {funcionarios.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.matricula ? `[${f.matricula}] ` : ''}
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro Mês */}
          <div>
            <Select
              value={String(selectedMes)}
              onValueChange={(val) => setSelectedMes(Number(val))}
            >
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Mês de Competência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Todos os meses</SelectItem>
                {MESES.map((m) => (
                  <SelectItem key={m.valor} value={String(m.valor)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro Ano */}
          <div>
            <Select
              value={String(selectedAno)}
              onValueChange={(val) => setSelectedAno(Number(val))}
            >
              <SelectTrigger className="text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anosDisponiveis.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    Ano {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 4. Tabela de Holerites */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[#2563EB]" />
            <span>Consultando banco de holerites...</span>
          </div>
        ) : holerites.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-[#2563EB] flex items-center justify-center mx-auto mb-3">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Nenhum holerite encontrado</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Nenhum comprovante foi enviado para a competência e filtros selecionados.
            </p>
            <Button
              onClick={() => setUploadModalOpen(true)}
              size="sm"
              className="mt-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Enviar Holerite
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Competência</th>
                  <th className="py-3 px-4">Funcionário</th>
                  <th className="py-3 px-4">Versão</th>
                  <th className="py-3 px-4">Data de Envio</th>
                  <th className="py-3 px-4">Responsável Envio</th>
                  <th className="py-3 px-4">Observações</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {holerites.map((h) => {
                  const mesLabel =
                    MESES.find((m) => m.valor === h.competencia_mes)?.label || h.competencia_mes
                  const versaoNum = h.versao || 1

                  return (
                    <tr key={h.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Competência */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block font-mono text-sm">
                              {String(h.competencia_mes).padStart(2, '0')}/{h.competencia_ano}
                            </span>
                            <span className="text-[11px] text-slate-500 capitalize">
                              {mesLabel}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Funcionário */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">
                          {h.expand?.funcionario?.nome || '—'}
                        </div>
                        {h.expand?.funcionario?.matricula && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Matrícula: {h.expand.funcionario.matricula}
                          </div>
                        )}
                      </td>

                      {/* Versão */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            className={`text-[10px] font-mono ${
                              versaoNum > 1
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            v{versaoNum}
                          </Badge>
                          {versaoNum > 1 && (
                            <button
                              type="button"
                              onClick={() => handleOpenVersoes(h)}
                              className="text-[10px] text-[#2563EB] hover:underline flex items-center gap-0.5"
                              title="Ver histórico de retificações"
                            >
                              <History className="w-3 h-3" />
                              Histórico
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Data de Envio */}
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {formatBRDate(h.data_envio || h.created)}
                      </td>

                      {/* Responsável Envio */}
                      <td className="py-3 px-4 text-slate-700">
                        {h.expand?.usuario_responsavel?.name ||
                          h.expand?.usuario_responsavel?.email ||
                          'Administrador RH'}
                      </td>

                      {/* Observações */}
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                        {h.observacoes || '—'}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            onClick={() => handleOpenView(h)}
                            variant="ghost"
                            size="sm"
                            title="Visualizar holerite em PDF"
                            className="h-8 w-8 p-0 text-slate-600 hover:text-[#2563EB] hover:bg-blue-50"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          <Button
                            onClick={() => handleDownload(h)}
                            variant="ghost"
                            size="sm"
                            title="Download seguro do PDF"
                            className="h-8 w-8 p-0 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"
                          >
                            <Download className="w-4 h-4" />
                          </Button>

                          <Button
                            onClick={() => {
                              setSelectedHolerite(h)
                              setSubArquivo(null)
                              setSubMotivo('')
                              setSubObservacoes(h.observacoes || '')
                              setSubstituirModalOpen(true)
                            }}
                            variant="outline"
                            size="sm"
                            title="Substituir por arquivo corrigido (mantém histórico)"
                            className="text-xs h-7 px-2 border-slate-200 text-slate-700 hover:border-[#2563EB] hover:text-[#2563EB]"
                          >
                            <Layers className="w-3 h-3 mr-1" />
                            Substituir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Modal Enviar Holerite */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-blue-100 text-[#2563EB] flex items-center justify-center mb-1">
              <FileText className="w-5 h-5" />
            </div>
            <DialogTitle>Enviar Comprovante de Holerite</DialogTitle>
            <DialogDescription>
              Faça o upload do documento PDF do holerite oficial para a competência desejada.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadHolerite} className="space-y-4 pt-2">
            {/* Funcionário */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Funcionário <span className="text-red-500">*</span>
              </Label>
              <Select value={formFuncionario} onValueChange={setFormFuncionario}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Selecione o funcionário" />
                </SelectTrigger>
                <SelectContent>
                  {funcionarios.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.matricula ? `[${f.matricula}] ` : ''}
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mês e Ano de Competência */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Mês de Competência <span className="text-red-500">*</span>
                </Label>
                <Select value={String(formMes)} onValueChange={(val) => setFormMes(Number(val))}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map((m) => (
                      <SelectItem key={m.valor} value={String(m.valor)}>
                        {m.label} ({String(m.valor).padStart(2, '0')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Ano de Competência <span className="text-red-500">*</span>
                </Label>
                <Select value={String(formAno)} onValueChange={(val) => setFormAno(Number(val))}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anosDisponiveis.map((a) => (
                      <SelectItem key={a} value={String(a)}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Arquivo PDF */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Arquivo PDF do Holerite <span className="text-red-500">*</span>
              </Label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors">
                <Input
                  type="file"
                  accept="application/pdf"
                  required
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f && validateHoleritePdf(f)) {
                      setFormArquivo(f)
                    } else {
                      e.target.value = ''
                      setFormArquivo(null)
                    }
                  }}
                  className="text-xs cursor-pointer"
                />
                {formArquivo && (
                  <p className="text-[11px] text-emerald-600 font-semibold mt-2 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Arquivo: {formArquivo.name} ({(formArquivo.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Observações Internas (opcional)</Label>
              <Input
                type="text"
                placeholder="Ex: Folha normal mensal, adiantamento quinzenal..."
                value={formObservacoes}
                onChange={(e) => setFormObservacoes(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={formSubmitting}
                onClick={() => setUploadModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={formSubmitting || !formFuncionario || !formArquivo}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
              >
                {formSubmitting ? 'Salvando...' : 'Salvar Holerite'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 6. Modal Substituir Holerite com Versionamento */}
      <Dialog open={substituirModalOpen} onOpenChange={setSubstituirModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-1">
              <Layers className="w-5 h-5" />
            </div>
            <DialogTitle>Substituir Arquivo de Holerite</DialogTitle>
            <DialogDescription>
              Retifique um comprovante enviado com erro. A versão atual (v
              {selectedHolerite?.versao || 1}) será arquivada no histórico e o novo PDF assumirá
              como versão v{(selectedHolerite?.versao || 1) + 1}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubstituirHolerite} className="space-y-4 pt-2">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <div className="text-slate-500">
                Funcionário:{' '}
                <strong className="text-slate-800">
                  {selectedHolerite?.expand?.funcionario?.nome}
                </strong>
              </div>
              <div className="text-slate-500">
                Competência:{' '}
                <strong className="text-slate-800 font-mono">
                  {String(selectedHolerite?.competencia_mes).padStart(2, '0')}/
                  {selectedHolerite?.competencia_ano}
                </strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Novo Arquivo PDF Corrigido <span className="text-red-500">*</span>
              </Label>
              <Input
                type="file"
                accept="application/pdf"
                required
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f && validateHoleritePdf(f)) {
                    setSubArquivo(f)
                  } else {
                    e.target.value = ''
                    setSubArquivo(null)
                  }
                }}
                className="text-xs cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Motivo da Substituição / Retificação <span className="text-red-500">*</span>
              </Label>
              <Textarea
                required
                rows={3}
                placeholder="Descreva o motivo desta nova versão (ex: Correção de cálculo de horas extras, reajuste salarial da categoria...)"
                value={subMotivo}
                onChange={(e) => setSubMotivo(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={subSubmitting}
                onClick={() => setSubstituirModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={subSubmitting || !subArquivo || !subMotivo}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {subSubmitting ? 'Substituindo...' : 'Confirmar Substituição'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 7. Modal Histórico de Versões */}
      <Dialog open={versoesModalOpen} onOpenChange={setVersoesModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center mb-1">
              <History className="w-5 h-5" />
            </div>
            <DialogTitle>Histórico de Versões do Holerite</DialogTitle>
            <DialogDescription>
              Trilhas de auditoria das substituições de arquivo realizadas para esta competência.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2 max-h-[60vh] overflow-y-auto">
            {loadingVersoes ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Carregando versões arquivadas...
              </div>
            ) : historicoVersoes.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Nenhuma versão arquivada anterior encontrada.
              </div>
            ) : (
              historicoVersoes.map((v) => (
                <div
                  key={v.id}
                  className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2 hover:bg-slate-100/60 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[11px] font-bold">
                        Versão {v.versao} (Arquivada)
                      </Badge>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {formatBRDate(v.created)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        onClick={() => handleOpenView(v)}
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-[#2563EB]"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Ver
                      </Button>
                      <Button
                        onClick={() => handleDownload(v)}
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-emerald-600"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Baixar
                      </Button>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium block text-[10px] uppercase">
                      Motivo da Substituição
                    </span>
                    <p className="text-slate-800 mt-0.5">
                      {v.motivo_substituicao || 'Não informado.'}
                    </p>
                  </div>

                  {v.expand?.usuario_responsavel && (
                    <div className="text-[10px] text-slate-400">
                      Operado por:{' '}
                      {v.expand.usuario_responsavel.name || v.expand.usuario_responsavel.email}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 8. Modal Visualizador PDF */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-4">
          <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <DialogTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-red-600" />
                Visualizador de Holerite em PDF
              </DialogTitle>
              <DialogDescription className="text-xs">
                Acesso protegido com autenticação e registro em auditoria.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center p-2 relative">
            {loadingPreview ? (
              <div className="flex flex-col items-center gap-2 text-xs text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin text-[#2563EB]" />
                <span>Carregando holerite seguro...</span>
              </div>
            ) : previewUrl ? (
              <iframe
                src={`${previewUrl}#toolbar=0`}
                title="Visualizador de Holerite"
                className="w-full h-full rounded border-0"
              />
            ) : (
              <div className="text-xs text-slate-500">Falha ao gerar link do arquivo.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
