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
} from 'lucide-react'
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

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedSituacao, setSelectedSituacao] = useState<string>('todos')
  const [selectedDepartamento, setSelectedDepartamento] = useState<string>('todos')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const stats = useMemo(() => {
    const total = funcionarios.length
    const ativos = funcionarios.filter((f) => f.situacao === 'ativo').length
    const afastados = funcionarios.filter((f) => f.situacao === 'afastado').length
    const ferias = funcionarios.filter((f) => f.situacao === 'em_ferias').length
    const desligados = funcionarios.filter((f) => f.situacao === 'desligado').length
    return { total, ativos, afastados, ferias, desligados }
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

      // Situacao filter
      if (selectedSituacao !== 'todos' && f.situacao !== selectedSituacao) {
        return false
      }

      // Departamento filter
      if (selectedDepartamento !== 'todos' && f.departamento !== selectedDepartamento) {
        return false
      }

      return true
    })
  }, [funcionarios, debouncedSearch, selectedSituacao, selectedDepartamento])

  // Paginated items
  const totalPages = Math.ceil(filteredFuncionarios.length / perPage) || 1
  const paginatedFuncionarios = useMemo(() => {
    const start = (page - 1) * perPage
    return filteredFuncionarios.slice(start, start + perPage)
  }, [filteredFuncionarios, page, perPage])

  const totalAtivos = useMemo(() => {
    return funcionarios.filter((f) => f.situacao === 'ativo').length
  }, [funcionarios])

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
                {stats.ativos} ativos
              </span>{' '}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Gerencie cadastros, informações contratuais e dados dos colaboradores
            </p>
          </div>
          <Button
            onClick={() => navigate('/admin/funcionarios/novo')}
            className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold text-xs sm:text-sm h-10 px-4 shadow-sm shrink-0 border-0 hover:brightness-110"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Funcionário
          </Button>{' '}
        </div>

        {/* Filters and Search Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Buscar por nome, matrícula, CPF ou cargo..."
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
              {(selectedSituacao !== 'todos' || selectedDepartamento !== 'todos') && (
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
            {/* Situacao */}
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
                  <SelectItem value="todos">Todas as situações</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="afastado">Afastado</SelectItem>
                  <SelectItem value="em_ferias">Em Férias</SelectItem>
                  <SelectItem value="desligado">Desligado</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
            <h3 className="text-base font-bold text-slate-800">Nenhum funcionário encontrado.</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {funcionarios.length === 0
                ? 'Comece cadastrando os colaboradores da empresa no sistema de Recursos Humanos.'
                : 'Nenhum resultado corresponde aos critérios de busca ou filtros selecionados.'}
            </p>
            {funcionarios.length === 0 ? (
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
                    <th className="py-3.5 px-4">Admissão</th>
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
                          {formatBRDate(func.data_admissao)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link to={`/admin/funcionarios/${func.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs border-slate-200 text-slate-700 hover:text-[#D4AF37] hover:bg-amber-50"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              Ver ficha
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
                        <span className="text-slate-400 block text-[10px] uppercase">Admissão</span>
                        <span className="text-slate-700">{formatBRDate(func.data_admissao)}</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Link to={`/admin/funcionarios/${func.id}`} className="block">
                        <Button variant="outline" className="w-full h-8 text-xs border-slate-200">
                          Ver ficha completa
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
    </div>
  )
}
