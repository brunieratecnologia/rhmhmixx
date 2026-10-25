import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { funcionariosService, departamentosService } from '@/services/rh'
import type { Funcionario, Departamento } from '@/types/rh'
import { formatBRDate, maskCPF } from '@/lib/formatters'
import pb from '@/lib/pocketbase/client'
import {
  Users,
  UserPlus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Plus,
  Eye,
  SlidersHorizontal,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { terminalService } from '@/services/rh'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function FuncionariosList() {
  const navigate = useNavigate()

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [loading, setLoading] = useState(true)

  // Active Tab: 'ativos' (quadro ativo / em férias / afastados) vs 'desligados' (Funcionários Anteriores)
  const [activeTab, setActiveTab] = useState<'ativos' | 'desligados'>('ativos')

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedSituacao, setSelectedSituacao] = useState<string>('todos')
  const { toast } = useToast()
  const [selectedDepartamento, setSelectedDepartamento] = useState<string>('todos')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  // Modal de atribuição de PIN padrão em massa
  const [pinMassaModalOpen, setPinMassaModalOpen] = useState(false)
  const [executandoPinMassa, setExecutandoPinMassa] = useState(false)
  const [resultadoPinMassa, setResultadoPinMassa] = useState<{
    success: boolean
    totalProcessados: number
    atualizadosCount: number
    atualizados: { id: string; nome: string; matricula: string; pinGerado: string }[]
    jaPossuemPinCount: number
    semDataNascimentoCount: number
    semDataNascimento: { id: string; nome: string; matricula: string }[]
    colisoesCount: number
    colisoes: {
      id: string
      nome: string
      matricula: string
      pinTentado: string
      conflitoCom: string
    }[]
  } | null>(null)

  const stats = useMemo(() => {
    const total = funcionarios.length
    const ativos = funcionarios.filter((f) => f.situacao === 'ativo').length
    const afastados = funcionarios.filter((f) => f.situacao === 'afastado').length
    const ferias = funcionarios.filter((f) => f.situacao === 'em_ferias').length
    const quadroAtivo = funcionarios.filter((f) => f.situacao !== 'desligado').length
    const desligados = funcionarios.filter((f) => f.situacao === 'desligado').length
    return { total, ativos, afastados, ferias, quadroAtivo, desligados }
  }, [funcionarios])

  // Pagination
  const [page, setPage] = useState(1)
  const perPage = 10

  // Debounce search term 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchTerm])

  const loadData = async () => {
    try {
      const [funcsRes, depsRes] = await Promise.all([
        funcionariosService.list(1, 1000, '', 'nome'),
        departamentosService.list(),
      ])
      setFuncionarios(funcsRes.items)
      setDepartamentos(depsRes)
    } catch (err) {
      console.error('Erro ao carregar funcionários:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    // Subscribe to realtime updates
    let unsub: (() => void) | undefined
    pb.collection('funcionarios')
      .subscribe('*', () => {
        loadData()
      })
      .then((u) => {
        unsub = u
      })
      .catch(() => {})

    return () => {
      if (unsub) unsub()
    }
  }, [])

  // Filtered employees
  const filteredFuncionarios = useMemo(() => {
    return funcionarios.filter((f) => {
      // Regra 1: Na aba principal ('ativos'), funcionários desligados NÃO aparecem (vão para 'desligados')
      if (activeTab === 'ativos') {
        if (f.situacao === 'desligado') {
          return false
        }
      } else {
        // Aba 'desligados' (Funcionários Anteriores) mostra APENAS os desligados
        if (f.situacao !== 'desligado') {
          return false
        }
      }

      // Search filter (name, matricula, cpf, cargo, situacao)
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase().trim()
        const nomeMatch = f.nome?.toLowerCase().includes(query)
        const matMatch = f.matricula?.toLowerCase().includes(query)
        const cpfMatch = f.cpf?.replace(/\D/g, '').includes(query.replace(/\D/g, ''))
        const cargoMatch = f.expand?.cargo?.nome?.toLowerCase().includes(query)
        const sitMatch = f.situacao?.toLowerCase().includes(query)
        if (!nomeMatch && !matMatch && !cpfMatch && !cargoMatch && !sitMatch) {
          return false
        }
      }

      // Situacao filter (apenas aplicável na aba de ativos quando não for 'todos')
      if (activeTab === 'ativos') {
        if (selectedSituacao !== 'todos' && f.situacao !== selectedSituacao) {
          return false
        }
      }

      // Departamento filter
      if (selectedDepartamento !== 'todos' && f.departamento !== selectedDepartamento) {
        return false
      }

      return true
    })
  }, [funcionarios, activeTab, debouncedSearch, selectedSituacao, selectedDepartamento])

  // Paginated items
  const totalPages = Math.ceil(filteredFuncionarios.length / perPage) || 1
  const paginatedFuncionarios = useMemo(() => {
    const start = (page - 1) * perPage
    return filteredFuncionarios.slice(start, start + perPage)
  }, [filteredFuncionarios, page, perPage])

  const totalAtivos = useMemo(() => {
    return funcionarios.filter((f) => f.situacao === 'ativo').length
  }, [funcionarios])

  const ativosSemPin = useMemo(() => {
    return funcionarios.filter((f) => f.situacao !== 'desligado' && !f.pin_hash).length
  }, [funcionarios])

  const handleExecutarPinPadraoMassa = async () => {
    setExecutandoPinMassa(true)
    try {
      const res = await terminalService.aplicarPinPadraoEmMassa()
      setResultadoPinMassa(res)
      await loadData()
      if (res.atualizadosCount > 0) {
        toast({
          title: 'PIN padrão aplicado com sucesso',
          description: `${res.atualizadosCount} colaborador(es) receberam o PIN padrão (DDMMAA).`,
          className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        })
      } else if (res.colisoesCount > 0) {
        toast({
          title: 'Atenção a colisões de PIN',
          description: 'Houve conflito de PINs iguais entre colaboradores ativos.',
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Processo concluído',
          description: 'Nenhum colaborador precisava de definição de PIN padrão.',
        })
      }
    } catch (err: any) {
      console.error('Erro ao aplicar PIN padrão em massa:', err)
      toast({
        title: 'Erro ao processar PINs',
        description: err?.message || 'Falha na comunicação com o backend.',
        variant: 'destructive',
      })
    } finally {
      setExecutandoPinMassa(false)
    }
  }

  const getSituacaoPill = (sit: string) => {
    switch (sit) {
      case 'ativo':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
            Ativo
          </span>
        )
      case 'afastado':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
            Afastado
          </span>
        )
      case 'em_ferias':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-900 border border-purple-300">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600 mr-1.5" />
            Em Férias
          </span>
        )
      case 'desligado':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
            Desligado
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            {sit}
          </span>
        )
    }
  }

  return (
    <div className="space-y-5">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Funcionários</h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                {stats.quadroAtivo} no quadro ativo
              </span>
              {stats.desligados > 0 && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                  {stats.desligados} desligado{stats.desligados > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Gerencie cadastros, informações contratuais e dados dos colaboradores
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setResultadoPinMassa(null)
                setPinMassaModalOpen(true)
              }}
              className="border-amber-300/80 bg-amber-50/70 hover:bg-amber-100/80 text-amber-950 text-xs sm:text-sm h-10 px-3 font-semibold shrink-0"
            >
              <KeyRound className="w-4 h-4 mr-1.5 text-[#D4AF37]" />
              Atribuir PIN Padrão (DDMMAA)
              {ativosSemPin > 0 && (
                <span className="ml-1.5 bg-amber-200 text-amber-900 font-bold text-[10px] px-1.5 py-0.2 rounded-full border border-amber-300">
                  {ativosSemPin} sem PIN
                </span>
              )}
            </Button>

            <Button
              onClick={() => navigate('/admin/funcionarios/novo')}
              className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold text-xs sm:text-sm h-10 px-4 shadow-sm shrink-0 border-0 hover:brightness-110"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Novo Funcionário
            </Button>
          </div>
        </div>

        {/* Navigation Tabs: Quadro Ativo vs Funcionários Anteriores (Desligados) */}
        <div className="mt-5 border-b border-slate-200">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('ativos')
                setPage(1)
              }}
              className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'ativos'
                  ? 'border-[#D4AF37] text-slate-900 bg-amber-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Users className="w-4 h-4 text-[#D4AF37]" />
              Funcionários Ativos
              <span
                className={`ml-1 text-[11px] px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'ativos'
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {stats.quadroAtivo}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('desligados')
                setPage(1)
              }}
              className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'desligados'
                  ? 'border-[#D4AF37] text-slate-900 bg-amber-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Users className="w-4 h-4 text-slate-400" />
              Funcionários Anteriores (Desligados)
              <span
                className={`ml-1 text-[11px] px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'desligados'
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {stats.desligados}
              </span>
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="pt-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder={
                activeTab === 'ativos'
                  ? 'Buscar funcionário ativo por nome, matrícula, CPF ou cargo...'
                  : 'Buscar funcionário anterior por nome, matrícula, CPF...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 border-slate-200 text-xs sm:text-sm"
            />
          </div>

          {/* Mobile Filter Toggle */}
          <div className="md:hidden">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              className="w-full h-10 border-slate-200 text-xs font-medium justify-between"
            >
              <span className="flex items-center">
                <SlidersHorizontal className="w-3.5 h-3.5 mr-2 text-slate-500" />
                Filtros
              </span>
              {((activeTab === 'ativos' && selectedSituacao !== 'todos') ||
                selectedDepartamento !== 'todos') && (
                <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
              )}
            </Button>
          </div>

          {/* Desktop Filters / Expanded Mobile Filters */}
          <div
            className={`flex flex-col sm:flex-row gap-3 ${
              mobileFiltersOpen ? 'flex' : 'hidden md:flex'
            }`}
          >
            {/* Situacao (Apenas para aba ativos) */}
            {activeTab === 'ativos' && (
              <div className="w-full sm:w-44">
                <Select
                  value={selectedSituacao}
                  onValueChange={(val) => {
                    setSelectedSituacao(val)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="h-10 text-xs border-slate-200">
                    <SelectValue placeholder="Situação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos do quadro</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="afastado">Afastado</SelectItem>
                    <SelectItem value="em_ferias">Em Férias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Departamento */}
            <div className="w-full sm:w-48">
              <Select
                value={selectedDepartamento}
                onValueChange={(val) => {
                  setSelectedDepartamento(val)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-10 text-xs border-slate-200">
                  <SelectValue placeholder="Departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os departamentos</SelectItem>
                  {departamentos.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Employees Table Card */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        {filteredFuncionarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              {activeTab === 'desligados'
                ? 'Nenhum funcionário anterior registrado.'
                : 'Nenhum funcionário encontrado.'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {activeTab === 'desligados'
                ? 'Os colaboradores que tiverem desligamento homologado aparecerão nesta seção histórica mantendo todo o histórico de ponto, férias e ficha acessível.'
                : funcionarios.length === 0
                  ? 'Comece cadastrando os colaboradores da empresa no sistema de Recursos Humanos.'
                  : 'Nenhum resultado corresponde aos critérios de busca ou filtros selecionados.'}
            </p>
            {activeTab === 'ativos' && funcionarios.length === 0 ? (
              <Button
                onClick={() => navigate('/admin/funcionarios/novo')}
                className="mt-5 bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold text-xs h-10 px-4 border-0 hover:brightness-110"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Cadastrar o primeiro funcionário
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('')
                  setSelectedSituacao('todos')
                  setSelectedDepartamento('todos')
                }}
                className="mt-4 text-xs"
              >
                Limpar filtros
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop / Tablet Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold text-xs">
                    <th className="py-3.5 px-4">Funcionário</th>
                    <th className="py-3.5 px-4">CPF</th>
                    <th className="py-3.5 px-4">Cargo</th>
                    <th className="py-3.5 px-4">Departamento</th>
                    <th className="py-3.5 px-4">Situação</th>
                    <th className="py-3.5 px-4">
                      {activeTab === 'desligados' ? 'Desligamento' : 'Admissão'}
                    </th>
                    <th className="py-3.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedFuncionarios.map((func) => {
                    const avatarUrl = func.fotografia
                      ? pb.files.getURL(func, func.fotografia)
                      : null
                    const initial = func.nome ? func.nome.charAt(0).toUpperCase() : 'F'

                    return (
                      <tr
                        key={func.id}
                        className="hover:bg-[#F0F6FF] transition-colors duration-150 group"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={func.nome}
                                className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-[#D4AF37]/20 text-amber-900 border border-[#D4AF37]/30 flex items-center justify-center font-bold text-xs shrink-0">
                                {initial}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{func.nome}</p>
                              <p className="text-[11px] text-slate-500 font-mono">
                                Matrícula: {func.matricula}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">{maskCPF(func.cpf)}</td>
                        <td className="py-3 px-4 text-slate-700">
                          {func.expand?.cargo?.nome || '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {func.expand?.departamento?.nome || '-'}
                        </td>
                        <td className="py-3 px-4">{getSituacaoPill(func.situacao)}</td>
                        <td className="py-3 px-4 text-slate-600">
                          {activeTab === 'desligados'
                            ? func.data_desligamento
                              ? formatBRDate(func.data_desligamento)
                              : 'Desligado'
                            : formatBRDate(func.data_admissao)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link to={`/admin/funcionarios/${func.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs border-slate-200 text-slate-700 hover:text-[#D4AF37] hover:bg-amber-50"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              Ver histórico / ficha
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Card View */}
            <div className="sm:hidden divide-y divide-slate-100">
              {paginatedFuncionarios.map((func) => {
                const initial = func.nome ? func.nome.charAt(0).toUpperCase() : 'F'
                return (
                  <div key={func.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#D4AF37]/20 text-amber-900 border border-[#D4AF37]/30 flex items-center justify-center font-bold text-xs shrink-0">
                          {initial}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-slate-900">{func.nome}</p>
                          <p className="text-xs text-slate-500 font-mono">
                            Matrícula: {func.matricula}
                          </p>
                        </div>
                      </div>
                      {getSituacaoPill(func.situacao)}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Cargo</span>
                        <span className="font-medium text-slate-800">
                          {func.expand?.cargo?.nome || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">
                          Departamento
                        </span>
                        <span className="font-medium text-slate-800">
                          {func.expand?.departamento?.nome || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">CPF</span>
                        <span className="font-mono text-slate-700">{maskCPF(func.cpf)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">
                          {activeTab === 'desligados' ? 'Desligamento' : 'Admissão'}
                        </span>
                        <span className="text-slate-700">
                          {activeTab === 'desligados'
                            ? func.data_desligamento
                              ? formatBRDate(func.data_desligamento)
                              : 'Desligado'
                            : formatBRDate(func.data_admissao)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Link to={`/admin/funcionarios/${func.id}`} className="block">
                        <Button variant="outline" className="w-full h-8 text-xs border-slate-200">
                          Ver histórico / ficha
                        </Button>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span>
                Página {page} de {totalPages} ({filteredFuncionarios.length} registros)
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="h-8 px-2.5 border-slate-200"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="h-8 px-2.5 border-slate-200"
                >
                  Próxima
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
      {/* Modal Atribuição de PIN Padrão em Massa */}
      <Dialog open={pinMassaModalOpen} onOpenChange={setPinMassaModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 text-[#D4AF37] flex items-center justify-center mb-2">
              <KeyRound className="w-5 h-5" />
            </div>
            <DialogTitle>Atribuição de PIN Padrão em Massa</DialogTitle>
            <DialogDescription>
              Define automaticamente o PIN padrão baseado na data de nascimento (6 dígitos: DDMMAA)
              para todos os colaboradores ativos que ainda não possuem PIN cadastrado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5 text-xs text-amber-950">
              <p className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                Regra do PIN Padrão MH MIXX:
              </p>
              <p className="text-slate-700">
                O PIN de 6 dígitos é derivado da data de nascimento (ex.: nascido em 13/10/1970 →
                PIN <strong>131070</strong>). O terminal autentica exclusivamente pelo PIN (sem
                necessidade de matrícula).
              </p>
              <p className="text-slate-700 font-semibold pt-1">
                Colaboradores ativos atualmente sem PIN:{' '}
                <span className="text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded font-bold">
                  {ativosSemPin}
                </span>
              </p>
            </div>

            {/* Resultado do processamento */}
            {resultadoPinMassa && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <span className="text-emerald-700 font-bold block text-lg">
                      {resultadoPinMassa.atualizadosCount}
                    </span>
                    <span className="text-slate-600 text-[11px]">PINs Atribuídos</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-slate-700 font-bold block text-lg">
                      {resultadoPinMassa.jaPossuemPinCount}
                    </span>
                    <span className="text-slate-600 text-[11px]">Já Possuíam PIN</span>
                  </div>
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
                    <span className="text-red-700 font-bold block text-lg">
                      {resultadoPinMassa.colisoesCount}
                    </span>
                    <span className="text-slate-600 text-[11px]">Colisões</span>
                  </div>
                </div>

                {/* Colisões se houver */}
                {resultadoPinMassa.colisoesCount > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 text-red-800 font-bold">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Colisões detectadas (PIN não aplicado):</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      Como a unicidade de PIN é obrigatória no terminal, o PIN padrão não pôde ser
                      atribuído aos colaboradores abaixo para evitar duplicidade:
                    </p>
                    <ul className="divide-y divide-red-200 border-t border-red-200 pt-1 text-[11px] space-y-1">
                      {resultadoPinMassa.colisoes.map((c, i) => (
                        <li key={i} className="pt-1 text-red-900">
                          <strong>{c.nome}</strong> (Matr. {c.matricula}) — Tentou PIN{' '}
                          {c.pinTentado}, colide com {c.conflitoCom}.
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Sem data de nascimento */}
                {resultadoPinMassa.semDataNascimentoCount > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs text-amber-950">
                    <p className="font-semibold">
                      Sem data de nascimento preenchida no cadastro (
                      {resultadoPinMassa.semDataNascimentoCount}):
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {resultadoPinMassa.semDataNascimento
                        .map((s) => `${s.nome} (${s.matricula})`)
                        .join(', ')}
                    </p>
                  </div>
                )}

                {/* Lista dos atualizados */}
                {resultadoPinMassa.atualizadosCount > 0 && (
                  <div className="max-h-44 overflow-y-auto border border-emerald-200 rounded-xl p-3 bg-emerald-50/40 space-y-1.5 text-xs">
                    <span className="font-bold text-emerald-900 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Colaboradores atualizados:
                    </span>
                    <ul className="text-[11px] text-slate-700 divide-y divide-emerald-100">
                      {resultadoPinMassa.atualizados.map((a) => (
                        <li key={a.id} className="py-1 flex items-center justify-between">
                          <span>
                            <strong>{a.nome}</strong> (Matrícula: {a.matricula})
                          </span>
                          <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-300 text-emerald-800 font-bold">
                            PIN: {a.pinGerado}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100 flex items-center justify-between sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={executandoPinMassa}
              onClick={() => setPinMassaModalOpen(false)}
            >
              {resultadoPinMassa ? 'Fechar' : 'Cancelar'}
            </Button>
            <Button
              type="button"
              disabled={executandoPinMassa || ativosSemPin === 0}
              onClick={handleExecutarPinPadraoMassa}
              className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold border-0 hover:brightness-110"
            >
              {executandoPinMassa
                ? 'Processando PINs...'
                : `Aplicar PIN Padrão (${ativosSemPin} sem PIN)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
