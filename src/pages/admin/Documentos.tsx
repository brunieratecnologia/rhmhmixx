import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { funcionariosService, documentosService } from '@/services/rh'
import { useAuth } from '@/contexts/AuthContext'
import type { Documento, Funcionario } from '@/types/rh'
import { formatBRDate } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import {
  FolderOpen,
  Plus,
  Search,
  Filter,
  FileText,
  FileImage,
  Calendar,
  AlertTriangle,
  Download,
  Eye,
  Archive,
  RefreshCw,
  Clock,
  Shield,
  ShieldAlert,
  UserCheck,
  CheckCircle2,
  X,
  ExternalLink,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'

export const CATEGORIAS_DOCUMENTOS: {
  id: Documento['categoria']
  label: string
  descricao: string
}[] = [
  {
    id: 'contrato_trabalho',
    label: 'Contrato de Trabalho',
    descricao: 'Contratos CLT, estágios, aditivos e termos de prorrogação',
  },
  {
    id: 'documentacao_admissional',
    label: 'Documentos Admissionais',
    descricao: 'RG, CPF, CNH, comprovante de residência e título de eleitor',
  },
  {
    id: 'atestado_medico',
    label: 'Atestados Médicos',
    descricao: 'Atestados de saúde ocupacional (ASO) e atestados de afastamento',
  },
  {
    id: 'comprovantes',
    label: 'Comprovantes',
    descricao: 'Comprovantes de escolaridade, cursos e declarações externas',
  },
  {
    id: 'termos_internos',
    label: 'Termos Internos',
    descricao: 'Termos de confidencialidade, entrega de EPI e comodato',
  },
  {
    id: 'documentos_ferias',
    label: 'Documentos de Férias',
    descricao: 'Avisos e recibos assinados de concessão de férias',
  },
  {
    id: 'outros',
    label: 'Outros Documentos',
    descricao: 'Documentações diversas não categorizadas',
  },
]

export default function DocumentosPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [selectedFuncionario, setSelectedFuncionario] = useState<string>(
    searchParams.get('funcionarioId') || 'todos',
  )
  const [selectedCategoria, setSelectedCategoria] = useState<string>('todas')
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroVencendo, setFiltroVencendo] = useState(false)
  const [mostrarArquivados, setMostrarArquivados] = useState(false)

  // Modais
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<Documento | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [previewType, setPreviewType] = useState<'pdf' | 'image' | 'other'>('pdf')
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Form de upload/criação
  const [formFuncionario, setFormFuncionario] = useState('')
  const [formCategoria, setFormCategoria] = useState<Documento['categoria']>('contrato_trabalho')
  const [formNome, setFormNome] = useState('')
  const [formDescricao, setFormDescricao] = useState('')
  const [formDataValidade, setFormDataValidade] = useState('')
  const [formNivelAcesso, setFormNivelAcesso] = useState<Documento['nivel_acesso']>('restrito_rh')
  const [formArquivo, setFormArquivo] = useState<File | null>(null)
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Form de edição
  const [editNome, setEditNome] = useState('')
  const [editDescricao, setEditDescricao] = useState('')
  const [editCategoria, setEditCategoria] = useState<Documento['categoria']>('contrato_trabalho')
  const [editDataValidade, setEditDataValidade] = useState('')
  const [editNivelAcesso, setEditNivelAcesso] = useState<Documento['nivel_acesso']>('restrito_rh')
  const [editArquivo, setEditArquivo] = useState<File | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Carregar dados
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [docsData, funcsData] = await Promise.all([
        documentosService.list({
          funcionarioId: selectedFuncionario !== 'todos' ? selectedFuncionario : undefined,
          categoria: selectedCategoria !== 'todas' ? selectedCategoria : undefined,
          somenteAtivos: !mostrarArquivados,
          vencendo: filtroVencendo,
        }),
        funcionariosService.listAll("situacao = 'ativo'"),
      ])
      setDocumentos(docsData)
      setFuncionarios(funcsData)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar documentos',
        description: err.message || 'Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [selectedFuncionario, selectedCategoria, mostrarArquivados, filtroVencendo, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Atualizar parâmetro na URL se selecionado funcionario
  useEffect(() => {
    const qFunc = searchParams.get('funcionarioId')
    if (qFunc && qFunc !== selectedFuncionario) {
      setSelectedFuncionario(qFunc)
    }
  }, [searchParams, selectedFuncionario])

  // Filtragem em memória por busca de texto
  const documentosFiltrados = useMemo(() => {
    return documentos.filter((doc) => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const matchNome = doc.nome.toLowerCase().includes(q)
        const matchFunc = doc.expand?.funcionario?.nome?.toLowerCase().includes(q) || false
        const matchMat = doc.expand?.funcionario?.matricula?.toLowerCase().includes(q) || false
        if (!matchNome && !matchFunc && !matchMat) return false
      }
      return true
    })
  }, [documentos, searchTerm])

  // Alertas de documentos próximos do vencimento (<= 30 dias) ou já vencidos
  const { totalVencendo30Dias, totalVencidos } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let vencendo = 0
    let vencidos = 0

    documentos.forEach((d) => {
      if (!d.data_validade) return
      const [ano, mes, dia] = d.data_validade.split('T')[0].split('-').map(Number)
      const valDate = new Date(ano, mes - 1, dia)
      const diffMs = valDate.getTime() - today.getTime()
      const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

      if (diffDias < 0) {
        vencidos++
      } else if (diffDias <= 30) {
        vencendo++
      }
    })

    return { totalVencendo30Dias: vencendo, totalVencidos: vencidos }
  }, [documentos])

  // Handler de seleção de arquivo com validação estrita de formato e tamanho
  const handleFileValidation = (file: File): boolean => {
    const MAX_SIZE = 10 * 1024 * 1024 // 10MB
    const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        title: 'Formato de arquivo inválido',
        description: 'Apenas arquivos em formato PDF ou imagens (JPEG e PNG) são permitidos.',
        variant: 'destructive',
      })
      return false
    }

    if (file.size > MAX_SIZE) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo do documento permitido é de 10 MB.',
        variant: 'destructive',
      })
      return false
    }

    return true
  }

  // Upload de documento
  const handleCreateDocumento = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formFuncionario) {
      toast({
        title: 'Funcionário obrigatório',
        description: 'Selecione o colaborador vinculado ao documento.',
        variant: 'destructive',
      })
      return
    }

    if (!formNome.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o título do documento.',
        variant: 'destructive',
      })
      return
    }

    if (!formArquivo) {
      toast({
        title: 'Arquivo obrigatório',
        description: 'Anexe o arquivo PDF ou imagem do documento.',
        variant: 'destructive',
      })
      return
    }

    try {
      setFormSubmitting(true)
      await documentosService.create({
        funcionario: formFuncionario,
        categoria: formCategoria,
        nome: formNome,
        descricao: formDescricao,
        data_validade: formDataValidade || undefined,
        nivel_acesso: formNivelAcesso,
        arquivo: formArquivo,
        usuario_responsavel: user?.id,
      })

      toast({
        title: 'Documento armazenado com sucesso!',
        description: 'Arquivo salvo com controle de acesso e auditoria.',
      })

      setUploadModalOpen(false)
      // Limpar form
      setFormFuncionario('')
      setFormNome('')
      setFormDescricao('')
      setFormDataValidade('')
      setFormArquivo(null)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao enviar documento',
        description: err.message || 'Falha na comunicação com o servidor.',
        variant: 'destructive',
      })
    } finally {
      setFormSubmitting(false)
    }
  }

  // Edição de documento
  const handleUpdateDocumento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDoc) return

    if (!editNome.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o título do documento.',
        variant: 'destructive',
      })
      return
    }

    try {
      setEditSubmitting(true)
      await documentosService.update(selectedDoc.id, {
        nome: editNome,
        descricao: editDescricao,
        categoria: editCategoria,
        data_validade: editDataValidade || undefined,
        nivel_acesso: editNivelAcesso,
        arquivo: editArquivo || null,
        adminUserId: user?.id,
      })

      toast({
        title: 'Documento atualizado com sucesso!',
        description: 'Alterações registradas nos logs de auditoria.',
      })

      setEditModalOpen(false)
      setSelectedDoc(null)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar documento',
        description: err.message || 'Falha ao salvar modificações.',
        variant: 'destructive',
      })
    } finally {
      setEditSubmitting(false)
    }
  }

  // Visualizar documento de forma segura
  const handleOpenView = async (doc: Documento) => {
    setSelectedDoc(doc)
    setLoadingPreview(true)
    setViewModalOpen(true)

    try {
      const url = await documentosService.getSecureUrl(doc)
      setPreviewUrl(url)
      const ext = doc.arquivo?.toLowerCase().split('.').pop() || ''
      if (ext === 'pdf') {
        setPreviewType('pdf')
      } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        setPreviewType('image')
      } else {
        setPreviewType('other')
      }

      // Registrar auditoria de consulta
      await documentosService.logAcessoVisualizacao(doc, 'view')
    } catch (err) {
      console.error('Erro ao carregar preview do documento:', err)
    } finally {
      setLoadingPreview(false)
    }
  }

  // Download autenticado e seguro
  const handleDownload = async (doc: Documento) => {
    try {
      const url = await documentosService.getSecureUrl(doc)
      if (!url) {
        throw new Error('Arquivo não localizado.')
      }

      // Log de auditoria para download
      await documentosService.logAcessoVisualizacao(doc, 'download')

      // Criar link temporário para download do arquivo
      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = doc.arquivo || `${doc.nome}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(blobUrl)

      toast({
        title: 'Download iniciado',
        description: 'Documento baixado de forma segura e auditada.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao baixar documento',
        description: err.message || 'Falha na autorização do arquivo.',
        variant: 'destructive',
      })
    }
  }

  // Arquivar ou Desarquivar
  const handleToggleArquivo = async (doc: Documento) => {
    try {
      if (doc.ativo !== false) {
        await documentosService.arquivar(doc.id, user?.id)
        toast({
          title: 'Documento arquivado',
          description: 'O documento foi movido para o arquivo inativo.',
        })
      } else {
        await documentosService.desarquivar(doc.id, user?.id)
        toast({
          title: 'Documento reativado',
          description: 'O documento voltou a figurar nos ativos.',
        })
      }
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao alterar status',
        description: err.message || 'Falha ao processar arquivamento.',
        variant: 'destructive',
      })
    }
  }

  const openEditModal = (doc: Documento) => {
    setSelectedDoc(doc)
    setEditNome(doc.nome)
    setEditDescricao(doc.descricao || '')
    setEditCategoria(doc.categoria)
    setEditDataValidade(doc.data_validade ? doc.data_validade.split('T')[0] : '')
    setEditNivelAcesso(doc.nivel_acesso)
    setEditArquivo(null)
    setEditModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* 1. Header com Título e Ação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
            <span className="text-xs font-bold text-[#2563EB] uppercase tracking-wider">
              Etapa 5 • Gestão Documental
            </span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Central de Documentos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Armazenamento seguro, validação de vigência, níveis de acesso restrito e histórico de
            consultas.
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
            Novo Documento
          </Button>
        </div>
      </div>

      {/* 2. Cards de Alerta de Vencimento e Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase block">
              Total de Documentos
            </span>
            <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
              {documentos.length}
            </span>
            <span className="text-[11px] text-slate-500">
              {mostrarArquivados ? 'Incluindo arquivados' : 'Documentos vigentes e ativos'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center">
            <FolderOpen className="w-6 h-6" />
          </div>
        </div>

        <div
          onClick={() => setFiltroVencendo(!filtroVencendo)}
          className={`p-4 rounded-xl border shadow-xs flex items-center justify-between cursor-pointer transition-all ${
            filtroVencendo
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/20'
              : 'bg-white border-slate-200 hover:border-amber-200'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-amber-700 uppercase block">
                A Vencer (30 dias)
              </span>
              {filtroVencendo && (
                <Badge className="bg-amber-600 text-white text-[10px] py-0 px-1.5">Filtrado</Badge>
              )}
            </div>
            <span className="text-2xl font-extrabold text-amber-800 mt-1 block">
              {totalVencendo30Dias}
            </span>
            <span className="text-[11px] text-amber-700">
              Clique para {filtroVencendo ? 'limpar filtro' : 'filtrar vencendo'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-red-600 uppercase block">
              Documentos Vencidos
            </span>
            <span className="text-2xl font-extrabold text-red-700 mt-1 block">{totalVencidos}</span>
            <span className="text-[11px] text-slate-500">Exigem renovação com o colaborador</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Busca por texto */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar por nome ou funcionário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          {/* Filtro Funcionário */}
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

          {/* Filtro Categoria */}
          <div>
            <Select value={selectedCategoria} onValueChange={setSelectedCategoria}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {CATEGORIAS_DOCUMENTOS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro Arquivados */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={mostrarArquivados ? 'secondary' : 'outline'}
              onClick={() => setMostrarArquivados(!mostrarArquivados)}
              className="text-xs h-9 w-full border-slate-200 text-slate-700"
            >
              <Archive className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              {mostrarArquivados ? 'Exibindo Arquivados' : 'Ver Arquivados'}
            </Button>
          </div>
        </div>
      </div>

      {/* 4. Tabela de Documentos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[#2563EB]" />
            <span>Carregando repositório de documentos...</span>
          </div>
        ) : documentosFiltrados.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-[#2563EB] flex items-center justify-center mx-auto mb-3">
              <FolderOpen className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Nenhum documento encontrado</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchTerm || selectedCategoria !== 'todas' || selectedFuncionario !== 'todos'
                ? 'Nenhum resultado corresponde aos filtros aplicados.'
                : 'Cadastre contratos, atestados, termos e documentos admissionais para seus funcionários.'}
            </p>
            <Button
              onClick={() => {
                setUploadModalOpen(true)
              }}
              size="sm"
              className="mt-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Novo Documento
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Documento</th>
                  <th className="py-3 px-4">Funcionário</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Nível de Acesso</th>
                  <th className="py-3 px-4">Envio & Validade</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documentosFiltrados.map((doc) => {
                  const catObj = CATEGORIAS_DOCUMENTOS.find((c) => c.id === doc.categoria)
                  const isPdf = doc.arquivo?.toLowerCase().endsWith('.pdf')
                  const isImage = ['jpg', 'jpeg', 'png', 'webp'].some((ext) =>
                    doc.arquivo?.toLowerCase().endsWith(ext),
                  )

                  // Checar vigência
                  let badgeValidade = null
                  if (doc.data_validade) {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const [ano, mes, dia] = doc.data_validade.split('T')[0].split('-').map(Number)
                    const valDate = new Date(ano, mes - 1, dia)
                    const diffDays = Math.ceil(
                      (valDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
                    )

                    if (diffDays < 0) {
                      badgeValidade = (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3" />
                          Vencido ({formatBRDate(doc.data_validade)})
                        </span>
                      )
                    } else if (diffDays <= 30) {
                      badgeValidade = (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          <Clock className="w-3 h-3" />
                          Vence em {diffDays}d ({formatBRDate(doc.data_validade)})
                        </span>
                      )
                    } else {
                      badgeValidade = (
                        <span className="text-[11px] text-slate-500 font-mono">
                          Vence: {formatBRDate(doc.data_validade)}
                        </span>
                      )
                    }
                  }

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Documento */}
                      <td className="py-3 px-4">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0 mt-0.5">
                            {isPdf ? (
                              <FileText className="w-4 h-4 text-red-600" />
                            ) : isImage ? (
                              <FileImage className="w-4 h-4 text-blue-600" />
                            ) : (
                              <FileText className="w-4 h-4 text-slate-500" />
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{doc.nome}</span>
                            {doc.descricao && (
                              <span className="text-[11px] text-slate-500 block max-w-xs truncate">
                                {doc.descricao}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-mono">
                              {doc.arquivo}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Funcionário */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">
                          {doc.expand?.funcionario?.nome || '—'}
                        </div>
                        {doc.expand?.funcionario?.matricula && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Matrícula: {doc.expand.funcionario.matricula}
                          </div>
                        )}
                      </td>

                      {/* Categoria */}
                      <td className="py-3 px-4">
                        <Badge
                          variant="secondary"
                          className="text-[11px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200"
                        >
                          {catObj?.label || doc.categoria}
                        </Badge>
                      </td>

                      {/* Nível de Acesso */}
                      <td className="py-3 px-4">
                        {doc.nivel_acesso === 'restrito_medico' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            <ShieldAlert className="w-3 h-3 text-rose-600" />
                            Médico Restrito
                          </span>
                        ) : doc.nivel_acesso === 'restrito_rh' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                            <Shield className="w-3 h-3 text-[#2563EB]" />
                            Restrito RH
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <UserCheck className="w-3 h-3 text-emerald-600" />
                            Público Interno
                          </span>
                        )}
                      </td>

                      {/* Envio & Validade */}
                      <td className="py-3 px-4">
                        <div className="text-[11px] text-slate-600">
                          Envio: {formatBRDate(doc.data_envio || doc.created)}
                        </div>
                        <div className="mt-0.5">
                          {badgeValidade || (
                            <span className="text-[11px] text-slate-400 font-mono">
                              Sem vigência
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {doc.ativo === false ? (
                          <Badge variant="outline" className="text-slate-400 border-slate-300">
                            Arquivado
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                            Ativo
                          </Badge>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            onClick={() => handleOpenView(doc)}
                            variant="ghost"
                            size="sm"
                            title="Visualizar documento"
                            className="h-8 w-8 p-0 text-slate-600 hover:text-[#2563EB] hover:bg-blue-50"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          <Button
                            onClick={() => handleDownload(doc)}
                            variant="ghost"
                            size="sm"
                            title="Download seguro"
                            className="h-8 w-8 p-0 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"
                          >
                            <Download className="w-4 h-4" />
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-slate-500 hover:bg-slate-100"
                              >
                                <span className="font-bold">•••</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs">
                              <DropdownMenuItem
                                onClick={() => openEditModal(doc)}
                                className="cursor-pointer"
                              >
                                Atualizar metadados
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleToggleArquivo(doc)}
                                className={`cursor-pointer ${
                                  doc.ativo === false ? 'text-emerald-600' : 'text-amber-600'
                                }`}
                              >
                                {doc.ativo === false ? 'Reativar documento' : 'Arquivar documento'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* 5. Modal Novo Documento */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-blue-100 text-[#2563EB] flex items-center justify-center mb-1">
              <FolderOpen className="w-5 h-5" />
            </div>
            <DialogTitle>Armazenar Novo Documento</DialogTitle>
            <DialogDescription>
              Vincule um documento oficial ao prontuário do colaborador. O arquivo é armazenado em
              ambiente privado seguro com controle estrito de permissões.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateDocumento} className="space-y-4 pt-2">
            {/* Funcionário */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Funcionário Vinculado <span className="text-red-500">*</span>
              </Label>
              <Select value={formFuncionario} onValueChange={setFormFuncionario}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Selecione o colaborador" />
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Categoria */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Categoria do Documento <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formCategoria}
                  onValueChange={(val: any) => {
                    setFormCategoria(val)
                    // Se for atestado médico, sugerir restrito médico
                    if (val === 'atestado_medico') {
                      setFormNivelAcesso('restrito_medico')
                    }
                  }}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_DOCUMENTOS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Nível de Acesso */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Nível de Acesso <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formNivelAcesso}
                  onValueChange={(val: any) => setFormNivelAcesso(val)}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="restrito_rh">Restrito RH (Administradores / RH)</SelectItem>
                    <SelectItem value="restrito_medico">
                      Restrito Médico (Sigiloso / Atestados)
                    </SelectItem>
                    <SelectItem value="publico_interno">
                      Público Interno (Disponível ao Colaborador)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Nome / Título */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Título do Documento <span className="text-red-500">*</span>
              </Label>
              <Input
                type="text"
                placeholder="Ex: Contrato de Trabalho CLT 2026, RG e CPF Digitalizado..."
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                required
                className="text-xs h-9"
              />
            </div>

            {/* Descrição e Data de Validade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Data de Validade (se aplicável)</Label>
                <Input
                  type="date"
                  value={formDataValidade}
                  onChange={(e) => setFormDataValidade(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Observações / Detalhes</Label>
                <Input
                  type="text"
                  placeholder="Ex: Assinado digitalmente"
                  value={formDescricao}
                  onChange={(e) => setFormDescricao(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>

            {/* Anexo de Arquivo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Arquivo Digital (PDF, JPEG, PNG — Máx. 10MB) <span className="text-red-500">*</span>
              </Label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors">
                <Input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) {
                      if (handleFileValidation(f)) {
                        setFormArquivo(f)
                        if (!formNome) {
                          setFormNome(f.name.replace(/\.[^/.]+$/, ''))
                        }
                      } else {
                        e.target.value = ''
                        setFormArquivo(null)
                      }
                    }
                  }}
                  required
                  className="text-xs file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#2563EB] hover:file:bg-blue-100 cursor-pointer"
                />
                {formArquivo && (
                  <p className="text-[11px] text-emerald-600 font-semibold mt-2 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Arquivo pronto: {formArquivo.name} (
                    {(formArquivo.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
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
                disabled={formSubmitting || !formFuncionario || !formNome || !formArquivo}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
              >
                {formSubmitting ? 'Salvando Documento...' : 'Salvar Documento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 6. Modal Edição / Atualização de Documento */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Atualizar Metadados do Documento</DialogTitle>
            <DialogDescription>
              Altere o título, vigência, categoria ou substitua o arquivo anexado.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateDocumento} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Título do Documento <span className="text-red-500">*</span>
              </Label>
              <Input
                type="text"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                required
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Categoria</Label>
                <Select value={editCategoria} onValueChange={(val: any) => setEditCategoria(val)}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_DOCUMENTOS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nível de Acesso</Label>
                <Select
                  value={editNivelAcesso}
                  onValueChange={(val: any) => setEditNivelAcesso(val)}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="restrito_rh">Restrito RH</SelectItem>
                    <SelectItem value="restrito_medico">Restrito Médico</SelectItem>
                    <SelectItem value="publico_interno">Público Interno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Data de Validade</Label>
                <Input
                  type="date"
                  value={editDataValidade}
                  onChange={(e) => setEditDataValidade(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Observações</Label>
                <Input
                  type="text"
                  value={editDescricao}
                  onChange={(e) => setEditDescricao(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Substituir Arquivo (opcional)</Label>
              <Input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f && handleFileValidation(f)) {
                    setEditArquivo(f)
                  } else {
                    e.target.value = ''
                    setEditArquivo(null)
                  }
                }}
                className="text-xs"
              />
              <p className="text-[11px] text-slate-400">
                Deixe vazio para manter o arquivo atual ({selectedDoc?.arquivo}).
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={editSubmitting}
                onClick={() => setEditModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={editSubmitting || !editNome}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
              >
                {editSubmitting ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 7. Modal Visualizador Seguro */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-4">
          <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <DialogTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#2563EB]" />
                {selectedDoc?.nome}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Colaborador: <strong>{selectedDoc?.expand?.funcionario?.nome || '—'}</strong> •
                Nível:{' '}
                <span className="capitalize">{selectedDoc?.nivel_acesso.replace('_', ' ')}</span>
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2 pr-6">
              {selectedDoc && (
                <Button
                  onClick={() => handleDownload(selectedDoc)}
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 text-[#2563EB] border-blue-200 hover:bg-blue-50"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Baixar Arquivo
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center p-2 relative">
            {loadingPreview ? (
              <div className="flex flex-col items-center gap-2 text-xs text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin text-[#2563EB]" />
                <span>Carregando visualização segura...</span>
              </div>
            ) : previewType === 'pdf' ? (
              <iframe
                src={`${previewUrl}#toolbar=0`}
                title={selectedDoc?.nome}
                className="w-full h-full rounded border-0"
              />
            ) : previewType === 'image' ? (
              <img
                src={previewUrl}
                alt={selectedDoc?.nome}
                className="max-w-full max-h-full object-contain rounded shadow-sm"
              />
            ) : (
              <div className="text-center p-6 bg-white rounded-xl shadow-xs">
                <FileText className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-800">
                  Pré-visualização direta não suportada
                </p>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  Clique no botão abaixo para baixar e abrir o arquivo no seu dispositivo.
                </p>
                {selectedDoc && (
                  <Button
                    onClick={() => handleDownload(selectedDoc)}
                    className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs"
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    Baixar Documento
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
