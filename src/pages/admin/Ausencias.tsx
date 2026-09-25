import React, { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { funcionariosService, ausenciasService, atestadosService } from '@/services/rh'
import type { Funcionario, Ausencia } from '@/types/rh'
import { formatBRDate } from '@/lib/formatters'
import { calcularDiasEntreDatas } from '@/lib/calculoFerias'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import {
  UserX,
  FileText,
  Plus,
  Search,
  Filter,
  Paperclip,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Calendar,
  AlertCircle,
  FileCheck,
  Download,
  Trash2,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

const CATEGORIAS_CONFIG: Record<
  Ausencia['categoria'],
  { label: string; cor: string; badgeClass: string }
> = {
  falta: {
    label: 'Falta Injustificada',
    cor: 'text-red-700 bg-red-50 border-red-200',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
  },
  atraso_justificado: {
    label: 'Atraso Justificado',
    cor: 'text-amber-700 bg-amber-50 border-amber-200',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  atestado: {
    label: 'Atestado Médico',
    cor: 'text-blue-700 bg-blue-50 border-blue-200',
    badgeClass: 'bg-blue-100 text-[#1E3A8A] border-blue-200',
  },
  afastamento: {
    label: 'Afastamento Previdenciário/INSS',
    cor: 'text-purple-700 bg-purple-50 border-purple-200',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  licenca: {
    label: 'Licença Legal / Maternidade / Gala',
    cor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  folga_compensatoria: {
    label: 'Folga Compensatória (BH)',
    cor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
}

const SITUACOES_CONFIG: Record<
  NonNullable<Ausencia['situacao']>,
  { label: string; badgeClass: string }
> = {
  informada: {
    label: 'Informada',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
  },
  justificada: {
    label: 'Justificada',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  abonada: {
    label: 'Abonada',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  nao_justificada: {
    label: 'Não Justificada',
    badgeClass: 'bg-red-100 text-red-800 border-red-300',
  },
}

export default function AusenciasPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [ausencias, setAusencias] = useState<Ausencia[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todas')
  const [situacaoFilter, setSituacaoFilter] = useState<string>('todas')
  const [funcionarioFilter, setFuncionarioFilter] = useState<string>(
    searchParams.get('funcionarioId') || 'todos',
  )
  const [dataInicioFilter, setDataInicioFilter] = useState<string>('')
  const [dataFimFilter, setDataFimFilter] = useState<string>('')

  // Modal de Criação / Edição
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAusencia, setEditingAusencia] = useState<Ausencia | null>(null)
  const [saving, setSaving] = useState(false)

  // Form State
  const [formFuncId, setFormFuncId] = useState('')
  const [formCategoria, setFormCategoria] = useState<Ausencia['categoria']>('atestado')
  const [formDataInicio, setFormDataInicio] = useState('')
  const [formDataFim, setFormDataFim] = useState('')
  const [formJustificativa, setFormJustificativa] = useState('')
  const [formSituacao, setFormSituacao] = useState<Ausencia['situacao']>('justificada')
  const [formImpactaAquisitivo, setFormImpactaAquisitivo] = useState<boolean>(false)
  const [formObservacoes, setFormObservacoes] = useState('')
  const [formArquivo, setFormArquivo] = useState<File | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [funcsRes, ausenciasRes] = await Promise.all([
        funcionariosService.list(1, 200, '', 'nome'),
        ausenciasService.listAll('', '-data_inicio'),
      ])
      setFuncionarios(funcsRes.items)
      setAusencias(ausenciasRes)
    } catch (err: any) {
      console.error('Erro ao carregar ausências:', err)
      toast({
        title: 'Erro ao carregar dados de ausências',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    const unsubs: (() => void)[] = []
    ;['ausencias', 'funcionarios', 'documentos'].forEach((col) => {
      pb.collection(col)
        .subscribe('*', () => {
          loadData()
        })
        .then((u) => unsubs.push(u))
        .catch(() => {})
    })

    return () => {
      unsubs.forEach((u) => u())
    }
  }, [])

  // Auto-ajustar impacto aquisitivo se for falta não justificada
  useEffect(() => {
    if (formCategoria === 'falta' && formSituacao === 'nao_justificada') {
      setFormImpactaAquisitivo(true)
    } else if (formCategoria === 'atestado' || formCategoria === 'folga_compensatoria') {
      setFormImpactaAquisitivo(false)
    }
  }, [formCategoria, formSituacao])

  // Indicadores do topo
  const resumoAusencias = useMemo(() => {
    const hojeStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())

    let ausenciasHoje = 0
    let atestadosValidos = 0
    let faltasInjustificadas = 0
    let afastamentosAtivos = 0

    for (const a of ausencias) {
      const ini = a.data_inicio.split('T')[0]
      const fim = a.data_fim ? a.data_fim.split('T')[0] : ini

      if (hojeStr >= ini && hojeStr <= fim) {
        ausenciasHoje++
        if (a.categoria === 'afastamento') {
          afastamentosAtivos++
        }
      }

      if (a.categoria === 'atestado') {
        atestadosValidos++
      }

      if (
        a.categoria === 'falta' &&
        (a.situacao === 'nao_justificada' || a.situacao === 'informada')
      ) {
        faltasInjustificadas++
      }
    }

    return {
      ausenciasHoje,
      atestadosValidos,
      faltasInjustificadas,
      afastamentosAtivos,
    }
  }, [ausencias])

  // Filtros aplicados
  const ausenciasFiltradas = useMemo(() => {
    return ausencias.filter((a) => {
      const funcNome = a.expand?.funcionario?.nome?.toLowerCase() || ''
      const funcMat = a.expand?.funcionario?.matricula?.toLowerCase() || ''

      // Busca texto
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const matchNome = funcNome.includes(term)
        const matchMat = funcMat.includes(term)
        const matchJust = a.justificativa?.toLowerCase().includes(term) || false
        if (!matchNome && !matchMat && !matchJust) return false
      }

      // Filtro de Funcionário
      if (funcionarioFilter !== 'todos' && a.funcionario !== funcionarioFilter) {
        return false
      }

      // Filtro de Categoria
      if (categoriaFilter !== 'todas' && a.categoria !== categoriaFilter) {
        return false
      }

      // Filtro de Situação
      if (situacaoFilter !== 'todas' && a.situacao !== situacaoFilter) {
        return false
      }

      // Filtro Período Início / Fim
      const aIni = a.data_inicio.split('T')[0]
      if (dataInicioFilter && aIni < dataInicioFilter) return false
      if (dataFimFilter && aIni > dataFimFilter) return false

      return true
    })
  }, [
    ausencias,
    searchTerm,
    funcionarioFilter,
    categoriaFilter,
    situacaoFilter,
    dataInicioFilter,
    dataFimFilter,
  ])

  // Abrir Modal para Nova Ausência
  const handleOpenNewModal = (funcId?: string) => {
    setEditingAusencia(null)
    setFormFuncId(funcId || (funcionarios[0]?.id ?? ''))
    setFormCategoria('atestado')

    const hojeStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())

    setFormDataInicio(hojeStr)
    setFormDataFim(hojeStr)
    setFormJustificativa('')
    setFormSituacao('justificada')
    setFormImpactaAquisitivo(false)
    setFormObservacoes('')
    setFormArquivo(null)
    setModalOpen(true)
  }

  // Abrir Modal para Edição
  const handleOpenEditModal = (a: Ausencia) => {
    setEditingAusencia(a)
    setFormFuncId(a.funcionario)
    setFormCategoria(a.categoria)
    setFormDataInicio(a.data_inicio.split('T')[0])
    setFormDataFim(a.data_fim ? a.data_fim.split('T')[0] : a.data_inicio.split('T')[0])
    setFormJustificativa(a.justificativa || '')
    setFormSituacao(a.situacao || 'informada')
    setFormImpactaAquisitivo(Boolean(a.impacta_aquisitivo))
    setFormObservacoes(a.observacoes || '')
    setFormArquivo(null)
    setModalOpen(true)
  }

  // Salvar Ausência
  const handleSubmitAusencia = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formFuncId || !formDataInicio) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Colaborador e Data de Início são obrigatórios.',
        variant: 'destructive',
      })
      return
    }

    if (formDataFim && formDataFim < formDataInicio) {
      toast({
        title: 'Período inconsistente',
        description: 'A data final não pode ser anterior à data de início.',
        variant: 'destructive',
      })
      return
    }

    // Se for atestado médico, avisar se estiver sem anexo
    if (formCategoria === 'atestado' && !formArquivo && !editingAusencia?.documentos) {
      const confirmSemAnexo = window.confirm(
        'Você está registrando um Atestado Médico sem anexar o comprovante digital. Deseja prosseguir mesmo assim?',
      )
      if (!confirmSemAnexo) return
    }

    setSaving(true)
    try {
      if (editingAusencia) {
        await ausenciasService.update(editingAusencia.id, {
          funcionario: formFuncId,
          categoria: formCategoria,
          situacao: formSituacao,
          data_inicio: formDataInicio,
          data_fim: formDataFim || formDataInicio,
          justificativa: formJustificativa,
          impacta_aquisitivo: formImpactaAquisitivo,
          observacoes: formObservacoes,
          arquivo: formArquivo,
          adminUserId: user?.id,
        })
        toast({
          title: 'Ausência atualizada com sucesso',
          className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        })
      } else {
        await ausenciasService.create({
          funcionario: formFuncId,
          categoria: formCategoria,
          situacao: formSituacao,
          data_inicio: formDataInicio,
          data_fim: formDataFim || formDataInicio,
          justificativa: formJustificativa,
          impacta_aquisitivo: formImpactaAquisitivo,
          observacoes: formObservacoes,
          arquivo: formArquivo,
          usuario_responsavel: user?.id,
        })
        toast({
          title: 'Ausência registrada com sucesso',
          className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        })
      }

      setModalOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar ausência',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Deletar Ausência
  const handleDeleteAusencia = async (id: string) => {
    if (!window.confirm('Deseja realmente remover este registro de ausência?')) {
      return
    }
    try {
      await ausenciasService.delete(id)
      toast({ title: 'Registro removido com sucesso' })
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao remover registro',
        description: err?.message,
        variant: 'destructive',
      })
    }
  }

  // Obter link do arquivo do documento anexo
  const handleDownloadDocumento = (doc: any) => {
    if (!doc || !doc.arquivo) return
    const url = atestadosService.getFileUrl(doc, doc.arquivo)
    window.open(url, '_blank')
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Controle de Ausências
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Faltas, atestados médicos, afastamentos, licenças e folgas compensatórias
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleOpenNewModal()}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold h-9 px-3.5 shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Registrar Nova Ausência
          </Button>
        </div>
      </div>

      {/* Indicadores de Alto Nível */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Ausentes Hoje</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {resumoAusencias.ausenciasHoje}
          </p>
          <span className="text-[11px] text-slate-500 block mt-0.5">
            Com ocorrência registrada para a data
          </span>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">
              Atestados Médicos
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {resumoAusencias.atestadosValidos}
          </p>
          <span className="text-[11px] text-slate-500 block mt-0.5">
            Atestados recebidos e anexados
          </span>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-700 uppercase">
              Afastamentos / INSS
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-purple-700 mt-2">
            {resumoAusencias.afastamentosAtivos}
          </p>
          <span className="text-[11px] text-slate-500 block mt-0.5">
            Colaboradores afastados atualmente
          </span>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-600 uppercase">
              Faltas Injustificadas
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-red-600 mt-2">
            {resumoAusencias.faltasInjustificadas}
          </p>
          <span className="text-[11px] text-slate-500 block mt-0.5">
            Impactam o período aquisitivo CLT
          </span>
        </div>
      </div>

      {/* Tabela de Ausências com Filtros */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden space-y-4">
        {/* Barra de Filtros */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar colaborador, matrícula ou motivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtro Funcionário */}
            <Select value={funcionarioFilter} onValueChange={setFuncionarioFilter}>
              <SelectTrigger className="text-xs h-9 w-[180px]">
                <SelectValue placeholder="Todos os colaboradores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Colaboradores</SelectItem>
                {funcionarios.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro Categoria */}
            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger className="text-xs h-9 w-[170px]">
                <SelectValue placeholder="Todas categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas Categorias</SelectItem>
                <SelectItem value="falta">Falta</SelectItem>
                <SelectItem value="atraso_justificado">Atraso Justificado</SelectItem>
                <SelectItem value="atestado">Atestado Médico</SelectItem>
                <SelectItem value="afastamento">Afastamento / INSS</SelectItem>
                <SelectItem value="licenca">Licença Legal</SelectItem>
                <SelectItem value="folga_compensatoria">Folga Compensatória</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro Situação */}
            <Select value={situacaoFilter} onValueChange={setSituacaoFilter}>
              <SelectTrigger className="text-xs h-9 w-[140px]">
                <SelectValue placeholder="Todas situações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas Situações</SelectItem>
                <SelectItem value="informada">Informada</SelectItem>
                <SelectItem value="justificada">Justificada</SelectItem>
                <SelectItem value="abonada">Abonada</SelectItem>
                <SelectItem value="nao_justificada">Não Justificada</SelectItem>
              </SelectContent>
            </Select>

            {/* Período */}
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={dataInicioFilter}
                onChange={(e) => setDataInicioFilter(e.target.value)}
                className="text-xs h-9 w-[130px]"
                title="A partir de"
              />
              <span className="text-xs text-slate-400">até</span>
              <Input
                type="date"
                value={dataFimFilter}
                onChange={(e) => setDataFimFilter(e.target.value)}
                className="text-xs h-9 w-[130px]"
                title="Até data"
              />
            </div>

            {(searchTerm ||
              funcionarioFilter !== 'todos' ||
              categoriaFilter !== 'todas' ||
              situacaoFilter !== 'todas' ||
              dataInicioFilter ||
              dataFimFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('')
                  setFuncionarioFilter('todos')
                  setCategoriaFilter('todas')
                  setSituacaoFilter('todas')
                  setDataInicioFilter('')
                  setDataFimFilter('')
                }}
                className="text-xs h-9 text-slate-500 hover:text-slate-900"
              >
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Tabela de Ausências */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Carregando registros de ausências...</p>
          </div>
        ) : ausenciasFiltradas.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500">
            Nenhuma ausência encontrada para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Colaborador</th>
                  <th className="py-3 px-3">Categoria</th>
                  <th className="py-3 px-3">Período / Duração</th>
                  <th className="py-3 px-3">Situação</th>
                  <th className="py-3 px-3">Justificativa / Motivo</th>
                  <th className="py-3 px-3 text-center">Impacto CLT</th>
                  <th className="py-3 px-3 text-center">Comprovante</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ausenciasFiltradas.map((a) => {
                  const catCfg = CATEGORIAS_CONFIG[a.categoria] || {
                    label: a.categoria,
                    badgeClass: 'bg-slate-100 text-slate-700',
                  }
                  const sitCfg =
                    (a.situacao && SITUACOES_CONFIG[a.situacao]) || SITUACOES_CONFIG['informada']

                  const dIni = a.data_inicio.split('T')[0]
                  const dFim = a.data_fim ? a.data_fim.split('T')[0] : dIni
                  const dias = calcularDiasEntreDatas(dIni, dFim)

                  const docAnexo = a.expand?.documentos

                  return (
                    <tr key={a.id} className="hover:bg-slate-50/90 transition-colors">
                      <td className="py-3 px-4">
                        <Link
                          to={`/admin/funcionarios/${a.funcionario}?tab=ferias`}
                          className="font-bold text-slate-900 hover:text-[#2563EB] hover:underline block"
                        >
                          {a.expand?.funcionario?.nome || 'Colaborador'}
                        </Link>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Matrícula: {a.expand?.funcionario?.matricula || '—'}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <Badge className={`${catCfg.badgeClass} font-medium text-[11px]`}>
                          {catCfg.label}
                        </Badge>
                      </td>

                      <td className="py-3 px-3 font-mono">
                        <span className="font-semibold text-slate-800">
                          {formatBRDate(dIni)}
                          {dFim !== dIni ? ` a ${formatBRDate(dFim)}` : ''}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          {dias === 1 ? '1 dia' : `${dias} dias`}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <Badge className={`${sitCfg.badgeClass} font-semibold text-[11px]`}>
                          {sitCfg.label}
                        </Badge>
                      </td>

                      <td className="py-3 px-3 max-w-xs text-slate-700">
                        {a.justificativa ? (
                          <p className="truncate" title={a.justificativa}>
                            {a.justificativa}
                          </p>
                        ) : (
                          <span className="text-slate-300">Sem justificativa descrita</span>
                        )}
                        {a.observacoes && (
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            Obs: {a.observacoes}
                          </p>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        {a.impacta_aquisitivo ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Desconta Aquisitivo
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-mono">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        {docAnexo?.arquivo ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadDocumento(docAnexo)}
                            className="h-7 px-2 text-[11px] border-slate-200 text-[#2563EB] hover:bg-blue-50"
                            title="Ver documento sigiloso anexo"
                          >
                            <Paperclip className="w-3.5 h-3.5 mr-1" />
                            Anexo
                          </Button>
                        ) : (
                          <span className="text-slate-300 text-[11px]">Nenhum</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditModal(a)}
                            className="h-7 px-2 text-[11px] border-slate-200 text-slate-700"
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAusencia(a.id)}
                            className="h-7 px-2 text-[11px] text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* ============================================================ */}
      {/* MODAL: CADASTRO / EDIÇÃO DE AUSÊNCIA                        */}
      {/* ============================================================ */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#2563EB] flex items-center justify-center mb-1">
              <UserX className="w-5 h-5" />
            </div>
            <DialogTitle>
              {editingAusencia ? 'Editar Registro de Ausência' : 'Registrar Ausência / Ocorrência'}
            </DialogTitle>
            <DialogDescription>
              Lance atestados, faltas, afastamentos ou licenças. Não serão aplicados descontos
              automáticos em folha; a ocorrência é refletida no espelho de ponto e no dashboard.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitAusencia} className="space-y-4 pt-1">
            {/* Colaborador */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Colaborador <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formFuncId}
                onValueChange={setFormFuncId}
                disabled={Boolean(editingAusencia)}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Selecione o colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {funcionarios.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome} ({f.matricula})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Categoria da Ausência */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Categoria da Ocorrência <span className="text-red-500">*</span>
              </Label>
              <Select value={formCategoria} onValueChange={(val: any) => setFormCategoria(val)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="falta">Falta (Injustificada)</SelectItem>
                  <SelectItem value="atraso_justificado">Atraso Justificado</SelectItem>
                  <SelectItem value="atestado">Atestado Médico</SelectItem>
                  <SelectItem value="afastamento">Afastamento / INSS</SelectItem>
                  <SelectItem value="licenca">Licença Legal (Maternidade, Gala, Óbito)</SelectItem>
                  <SelectItem value="folga_compensatoria">
                    Folga Compensatória (Banco de Horas)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Datas Início e Fim */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dataInicioAusenciaInput" className="text-xs font-semibold">
                  Data de Início <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="dataInicioAusenciaInput"
                  type="date"
                  required
                  value={formDataInicio}
                  onChange={(e) => setFormDataInicio(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dataFimAusenciaInput" className="text-xs font-semibold">
                  Data de Fim (ou mesmo dia) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="dataFimAusenciaInput"
                  type="date"
                  required
                  value={formDataFim}
                  onChange={(e) => setFormDataFim(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Situação */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Situação da Ausência</Label>
              <Select value={formSituacao} onValueChange={(val: any) => setFormSituacao(val)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="informada">Informada</SelectItem>
                  <SelectItem value="justificada">Justificada</SelectItem>
                  <SelectItem value="abonada">Abonada (não desconta ponto/banco)</SelectItem>
                  <SelectItem value="nao_justificada">Não Justificada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Justificativa / Motivo */}
            <div className="space-y-1.5">
              <Label htmlFor="justificativaInput" className="text-xs font-semibold">
                Justificativa / Motivo detalhado <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="justificativaInput"
                required
                placeholder="Descreva o motivo formal da ausência ou dados do CID / profissional de saúde..."
                value={formJustificativa}
                onChange={(e) => setFormJustificativa(e.target.value)}
                className="text-xs"
                rows={2}
              />
            </div>

            {/* Upload de Comprovante / Atestado Médico */}
            <div className="space-y-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="arquivoComprovante"
                  className="text-xs font-semibold flex items-center gap-1.5"
                >
                  <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                  Anexar Comprovante / Atestado Digital
                </Label>
                {formCategoria === 'atestado' && (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-amber-700 bg-amber-50 border-amber-200"
                  >
                    <Lock className="w-2.5 h-2.5 mr-1" /> Sigilo Médico
                  </Badge>
                )}
              </div>
              <Input
                id="arquivoComprovante"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setFormArquivo(e.target.files?.[0] || null)}
                className="text-xs bg-white file:text-xs file:font-semibold file:border-0 file:bg-blue-50 file:text-blue-700 file:rounded-md file:px-2 file:mr-2"
              />
              <p className="text-[10px] text-slate-500">
                PDF ou Imagem (máx 10MB). Arquivos sigilosos com permissão restrita de visualização.
              </p>
            </div>

            {/* Checkbox Impacta Período Aquisitivo CLT */}
            <div className="flex items-start space-x-2 pt-1">
              <Checkbox
                id="impactaAquisitivo"
                checked={formImpactaAquisitivo}
                onCheckedChange={(checked) => setFormImpactaAquisitivo(Boolean(checked))}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="impactaAquisitivo"
                  className="text-xs font-medium leading-none cursor-pointer text-slate-800"
                >
                  Registrar como falta que afeta o cálculo do período aquisitivo de férias (Art. 130
                  CLT)
                </label>
                <p className="text-[10px] text-slate-500">
                  Faltas não justificadas reduzem progressivamente os dias de férias adquiridos. O
                  desconto não é feito em dinheiro no salário.
                </p>
              </div>
            </div>

            {/* Observações Internas */}
            <div className="space-y-1.5">
              <Label htmlFor="obsAusenciaInput" className="text-xs font-semibold">
                Observações do RH (opcional)
              </Label>
              <Input
                id="obsAusenciaInput"
                placeholder="Anotações internas do RH..."
                value={formObservacoes}
                onChange={(e) => setFormObservacoes(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
              >
                {saving
                  ? 'Salvando...'
                  : editingAusencia
                    ? 'Salvar Alterações'
                    : 'Confirmar Registro'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
