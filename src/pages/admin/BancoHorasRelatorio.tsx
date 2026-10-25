import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  carregarDadosRelatorioBancoHoras,
  gerarCsvBancoHoras,
  RelatorioBancoHorasGeral,
  FuncionarioBancoHorasResumo,
  ExtratoItemBancoHoras,
} from '@/services/bancoHorasRelatorioService'
import { formatBRDate } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import {
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  UserX,
  Search,
  Filter,
  Download,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Building2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  X,
  Sparkles,
  ArrowUpDown,
  History,
  ShieldCheck,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

type SortField = 'saldoTotal' | 'saldoPeriodo' | 'creditos' | 'debitos' | 'nome' | 'matricula'
type SortOrder = 'asc' | 'desc'

export default function BancoHorasRelatorio() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast } = useToast()

  const now = new Date()
  const initialAno = parseInt(searchParams.get('ano') || String(now.getFullYear()), 10)
  const initialMes = parseInt(searchParams.get('mes') || String(now.getMonth() + 1), 10)

  const [ano, setAno] = useState<number>(initialAno)
  const [mes, setMes] = useState<number>(initialMes)
  const [loading, setLoading] = useState<boolean>(true)
  const [relatorio, setRelatorio] = useState<RelatorioBancoHorasGeral | null>(null)

  // Filtros e busca
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDepto, setSelectedDepto] = useState('todos')
  const [activeTab, setActiveTab] = useState<'ativos' | 'desligados'>('ativos')

  // Ordenação
  const [sortField, setSortField] = useState<SortField>('saldoTotal')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Modal de Extrato Individual
  const [extratoModalOpen, setExtratoModalOpen] = useState(false)
  const [funcionarioSelecionado, setFuncionarioSelecionado] =
    useState<FuncionarioBancoHorasResumo | null>(null)
  const [extratoFiltroCompetencia, setExtratoFiltroCompetencia] = useState<'mes_atual' | 'todas'>(
    'mes_atual',
  )

  // Carregar relatório do backend
  const carregarRelatorio = async () => {
    setLoading(true)
    try {
      const data = await carregarDadosRelatorioBancoHoras(ano, mes)
      setRelatorio(data)
    } catch (err: any) {
      console.error('Erro ao carregar relatório de banco de horas:', err)
      toast({
        title: 'Erro ao carregar relatório',
        description: err?.message || 'Falha ao buscar dados do banco de horas.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarRelatorio()
    setSearchParams({
      ano: String(ano),
      mes: String(mes),
    })
  }, [ano, mes])

  // Navegação de mês
  const handleMesAnterior = () => {
    if (mes === 1) {
      setMes(12)
      setAno(ano - 1)
    } else {
      setMes(mes - 1)
    }
  }

  const handleProximoMes = () => {
    if (mes === 12) {
      setMes(1)
      setAno(ano + 1)
    } else {
      setMes(mes + 1)
    }
  }

  // Lista única de departamentos para o filtro dropdown
  const departamentosDisponiveis = useMemo(() => {
    if (!relatorio) return []
    const setDeptos = new Set<string>()
    for (const f of relatorio.funcionarios) {
      if (f.departamentoNome && f.departamentoNome !== 'Não definido') {
        setDeptos.add(f.departamentoNome)
      }
    }
    return Array.from(setDeptos).sort()
  }, [relatorio])

  // Filtragem e ordenação dos funcionários
  const funcionariosFiltrados = useMemo(() => {
    if (!relatorio) return []

    return relatorio.funcionarios
      .filter((f) => {
        // Separação mandatória da regra do projeto: Desligados fora da lista principal
        const ehDesligado = f.situacao === 'desligado'
        if (activeTab === 'ativos' && ehDesligado) return false
        if (activeTab === 'desligados' && !ehDesligado) return false

        // Filtro por departamento
        if (selectedDepto !== 'todos' && f.departamentoNome !== selectedDepto) {
          return false
        }

        // Busca por texto (nome, matrícula, cargo)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const matchNome = f.nome.toLowerCase().includes(q)
          const matchMatricula = f.matricula.toLowerCase().includes(q)
          const matchCargo = f.cargoNome.toLowerCase().includes(q)
          if (!matchNome && !matchMatricula && !matchCargo) return false
        }

        return true
      })
      .sort((a, b) => {
        let valA: number | string = 0
        let valB: number | string = 0

        switch (sortField) {
          case 'saldoTotal':
            valA = a.saldoTotalMinutos
            valB = b.saldoTotalMinutos
            break
          case 'saldoPeriodo':
            valA = a.saldoPeriodoMinutos
            valB = b.saldoPeriodoMinutos
            break
          case 'creditos':
            valA = a.creditosPeriodoMinutos
            valB = b.creditosPeriodoMinutos
            break
          case 'debitos':
            valA = a.debitosPeriodoMinutos
            valB = b.debitosPeriodoMinutos
            break
          case 'matricula':
            valA = a.matricula
            valB = b.matricula
            break
          case 'nome':
            valA = a.nome
            valB = b.nome
            break
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
        }

        return sortOrder === 'asc'
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number)
      })
  }, [relatorio, activeTab, selectedDepto, searchQuery, sortField, sortOrder])

  // Alternar ordenação
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder(field === 'nome' || field === 'matricula' ? 'asc' : 'desc')
    }
  }

  // Exportação CSV com BOM para Excel no padrão brasileiro (ponto-e-vírgula)
  const handleExportCSV = () => {
    if (!relatorio) return
    const csvContent = gerarCsvBancoHoras(relatorio, funcionariosFiltrados)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `relatorio_banco_horas_mhmixx_${ano}_${String(mes).padStart(2, '0')}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: 'Exportação concluída',
      description: 'O arquivo CSV compatível com Excel pt-BR foi baixado com sucesso.',
      className: 'bg-emerald-950 text-emerald-100 border-emerald-800',
    })
  }

  // Filtragem dos itens de extrato no modal do colaborador selecionado
  const extratoItensFiltrados = useMemo(() => {
    if (!funcionarioSelecionado) return []
    const padMes = String(mes).padStart(2, '0')
    const startStr = `${ano}-${padMes}-01`
    const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
    const endStr = `${ano}-${padMes}-${String(ultimoDia).padStart(2, '0')}`

    if (extratoFiltroCompetencia === 'mes_atual') {
      return funcionarioSelecionado.extrato.filter((i) => i.data >= startStr && i.data <= endStr)
    }

    return funcionarioSelecionado.extrato
  }, [funcionarioSelecionado, extratoFiltroCompetencia, ano, mes])

  return (
    <div className="space-y-6">
      {/* Top Header com Título e Seletor de Competência */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#D4AF37]/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/30 text-[#D4AF37]">
              <Clock className="w-5 h-5 text-[#D4AF37]" />
            </span>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-amber-50">
                Relatório de Banco de Horas
              </h2>
              <p className="text-xs text-slate-400">
                Extrato corporativo e consolidado dos créditos e débitos de horas extras da MH MIXX
              </p>
            </div>
          </div>
        </div>

        {/* Controles de Navegação da Competência e Ação de Exportar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Navegador de Mês / Ano */}
          <div className="flex items-center bg-[#070B11] border border-[#D4AF37]/30 rounded-xl p-1 shadow-xs">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleMesAnterior}
              className="h-8 w-8 text-slate-300 hover:text-[#D4AF37] hover:bg-[#151D2C]"
              title="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="flex items-center gap-2 px-3 py-1 font-mono text-xs font-semibold text-amber-100">
              <CalendarDays className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>
                {MESES[mes - 1]} de {ano}
              </span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleProximoMes}
              className="h-8 w-8 text-slate-300 hover:text-[#D4AF37] hover:bg-[#151D2C]"
              title="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={carregarRelatorio}
            disabled={loading}
            className="h-10 text-xs border-[#D4AF37]/30 bg-[#0F1624] text-amber-200 hover:bg-[#151D2C] hover:text-[#D4AF37]"
            title="Atualizar dados reais do sistema"
          >
            <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            size="sm"
            onClick={handleExportCSV}
            disabled={loading || !relatorio || funcionariosFiltrados.length === 0}
            className="h-10 text-xs font-bold bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 border-0 hover:brightness-110 shadow-md"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* 2. Cards de Resumo Corporativo no Topo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total de Créditos do Período */}
        <div className="relative overflow-hidden rounded-2xl bg-[#0F1624] border border-[#D4AF37]/20 p-4 sm:p-5 shadow-lg group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Créditos do Período
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400">
              {loading ? '---' : relatorio?.totalCreditosFormatado || '+00:00'}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              Horas pós-saída da jornada e dias de folga
            </p>
          </div>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 2: Total de Débitos do Período */}
        <div className="relative overflow-hidden rounded-2xl bg-[#0F1624] border border-[#D4AF37]/20 p-4 sm:p-5 shadow-lg group hover:border-red-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Débitos do Período
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-red-400">
              {loading ? '---' : relatorio?.totalDebitosFormatado || '-00:00'}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">Atrasos acima de 10m e compensações</p>
          </div>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-red-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 3: Saldo Geral da Empresa */}
        <div className="relative overflow-hidden rounded-2xl bg-[#0F1624] border border-[#D4AF37]/20 p-4 sm:p-5 shadow-lg group hover:border-[#D4AF37]/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Saldo Geral da Empresa
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span
              className={`text-2xl sm:text-3xl font-extrabold font-mono ${
                !relatorio || relatorio.saldoGeralEmpresaMinutos >= 0
                  ? 'text-emerald-400'
                  : 'text-red-400'
              }`}
            >
              {loading ? '---' : relatorio?.saldoGeralEmpresaFormatado || '00:00'}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              Balanço líquido de horas na competência
            </p>
          </div>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-[#D4AF37]/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 4: Funcionários com Saldo Negativo */}
        <div className="relative overflow-hidden rounded-2xl bg-[#0F1624] border border-[#D4AF37]/20 p-4 sm:p-5 shadow-lg group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Saldos Devedores
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-300">
                {loading ? '---' : relatorio?.funcionariosSaldoNegativoCount || 0}
              </span>
              <span className="text-xs text-slate-400">
                / {relatorio?.totalFuncionariosAtivos || 0} ativos
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Colaboradores com saldo acumulado negativo
            </p>
          </div>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
        </div>
      </div>

      {/* 3. Filtros, Abas (Ativos x Desligados) e Busca */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-[#0F1624]/90 p-3 rounded-2xl border border-[#D4AF37]/20">
        {/* Abas: Funcionários Ativos vs Funcionários Anteriores (Desligados) */}
        <Tabs
          value={activeTab}
          onValueChange={(val: any) => setActiveTab(val)}
          className="w-full lg:w-auto"
        >
          <TabsList className="bg-[#070B11] border border-[#D4AF37]/20 p-1 rounded-xl h-10 w-full sm:w-auto">
            <TabsTrigger
              value="ativos"
              className="text-xs font-semibold px-4 py-1.5 rounded-lg data-[state=active]:bg-[#1A2233] data-[state=active]:text-[#E5C07B] data-[state=active]:border data-[state=active]:border-[#D4AF37]/30 text-slate-400"
            >
              Funcionários Ativos (
              {relatorio?.funcionarios.filter((f) => f.situacao !== 'desligado').length || 0})
            </TabsTrigger>
            <TabsTrigger
              value="desligados"
              className="text-xs font-semibold px-4 py-1.5 rounded-lg data-[state=active]:bg-[#1A2233] data-[state=active]:text-[#E5C07B] data-[state=active]:border data-[state=active]:border-[#D4AF37]/30 text-slate-400"
            >
              Funcionários Anteriores (
              {relatorio?.funcionarios.filter((f) => f.situacao === 'desligado').length || 0})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Controles de Busca e Filtro de Departamento */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Filtro por Departamento */}
          <div className="min-w-[190px]">
            <Select value={selectedDepto} onValueChange={setSelectedDepto}>
              <SelectTrigger className="h-10 text-xs bg-[#070B11] border-[#D4AF37]/25 text-amber-100">
                <Building2 className="w-3.5 h-3.5 mr-1.5 text-[#D4AF37]" />
                <SelectValue placeholder="Departamento" />
              </SelectTrigger>
              <SelectContent className="bg-[#0F1624] border-[#D4AF37]/30 text-amber-50">
                <SelectItem value="todos">Todos os Departamentos</SelectItem>
                {departamentosDisponiveis.map((dep) => (
                  <SelectItem key={dep} value={dep}>
                    {dep}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campo de Busca */}
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Buscar colaborador ou matrícula..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 pl-9 text-xs bg-[#070B11] border-[#D4AF37]/25 text-amber-50 placeholder:text-slate-500 rounded-xl focus-visible:ring-[#D4AF37]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Tabela Consolidada de Banco de Horas */}
      <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#0F1624] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#D4AF37]/20 bg-[#070B11] text-slate-300 font-semibold select-none">
                <th
                  onClick={() => handleSort('matricula')}
                  className="py-3 px-4 cursor-pointer hover:text-[#D4AF37] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Matrícula</span>
                    {sortField === 'matricula' ? (
                      sortOrder === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5 text-[#D4AF37]" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-[#D4AF37]" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('nome')}
                  className="py-3 px-4 cursor-pointer hover:text-[#D4AF37] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Colaborador</span>
                    {sortField === 'nome' ? (
                      sortOrder === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5 text-[#D4AF37]" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-[#D4AF37]" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">Departamento / Cargo</th>
                <th className="py-3 px-4">Jornada</th>
                <th
                  onClick={() => handleSort('creditos')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-emerald-400 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Créditos Mês</span>
                    {sortField === 'creditos' ? (
                      sortOrder === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('debitos')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-red-400 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Débitos Mês</span>
                    {sortField === 'debitos' ? (
                      sortOrder === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5 text-red-400" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-red-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('saldoPeriodo')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-[#D4AF37] transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Saldo Período</span>
                    {sortField === 'saldoPeriodo' ? (
                      sortOrder === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5 text-[#D4AF37]" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-[#D4AF37]" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('saldoTotal')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-[#D4AF37] transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="font-bold text-[#D4AF37]">Saldo Total Atual</span>
                    {sortField === 'saldoTotal' ? (
                      sortOrder === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5 text-[#D4AF37]" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-[#D4AF37]" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4 text-center">Extrato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D4AF37]/10">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RotateCcw className="w-6 h-6 animate-spin mx-auto text-[#D4AF37] mb-2" />
                    <p className="text-xs font-semibold">
                      Calculando banco de horas com o motor oficial do espelho de ponto...
                    </p>
                  </td>
                </tr>
              ) : funcionariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Info className="w-7 h-7 mx-auto text-slate-500 mb-2" />
                    <p className="text-sm font-semibold text-slate-300">
                      Nenhum colaborador encontrado com os filtros aplicados
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Tente limpar a pesquisa ou selecionar outro departamento.
                    </p>
                  </td>
                </tr>
              ) : (
                funcionariosFiltrados.map((funcResumo) => {
                  const saldoTotalNeg = funcResumo.saldoTotalMinutos < 0
                  const saldoPeriodoNeg = funcResumo.saldoPeriodoMinutos < 0

                  return (
                    <tr
                      key={funcResumo.funcionario.id}
                      onClick={() => {
                        setFuncionarioSelecionado(funcResumo)
                        setExtratoModalOpen(true)
                      }}
                      className="hover:bg-[#151D2C]/80 cursor-pointer transition-colors group"
                    >
                      {/* Matrícula */}
                      <td className="py-3 px-4 font-mono font-bold text-amber-200">
                        {funcResumo.matricula}
                      </td>

                      {/* Nome e Indicadores */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-amber-50 group-hover:text-[#E5C07B] transition-colors">
                          {funcResumo.nome}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {funcResumo.totalAtrasosPeriodo > 0 && (
                            <span className="inline-flex items-center text-[10px] text-amber-400/90 font-medium bg-amber-950/60 border border-amber-600/30 px-1.5 py-0.2 rounded">
                              <AlertTriangle className="w-2.5 h-2.5 mr-1 text-amber-400" />
                              {funcResumo.totalAtrasosPeriodo} atraso(s) &gt;10m
                            </span>
                          )}
                          {funcResumo.situacao === 'em_ferias' && (
                            <span className="text-[10px] text-purple-300 bg-purple-950/60 border border-purple-600/30 px-1.5 py-0.2 rounded">
                              Em férias
                            </span>
                          )}
                          {funcResumo.situacao === 'desligado' && (
                            <span className="text-[10px] text-rose-300 bg-rose-950/60 border border-rose-600/30 px-1.5 py-0.2 rounded">
                              Desligado
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Departamento / Cargo */}
                      <td className="py-3 px-4">
                        <span className="text-slate-300 font-medium block">
                          {funcResumo.departamentoNome}
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          {funcResumo.cargoNome}
                        </span>
                      </td>

                      {/* Jornada */}
                      <td className="py-3 px-4">
                        <span className="text-[11px] text-slate-400 font-mono">
                          {funcResumo.jornadaNome}
                        </span>
                      </td>

                      {/* Créditos Mês */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        {funcResumo.creditosPeriodoMinutos > 0
                          ? funcResumo.creditosPeriodoFormatado
                          : '00:00'}
                      </td>

                      {/* Débitos Mês */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-red-400">
                        {funcResumo.debitosPeriodoMinutos > 0
                          ? funcResumo.debitosPeriodoFormatado
                          : '00:00'}
                      </td>

                      {/* Saldo do Período */}
                      <td
                        className={`py-3 px-4 text-right font-mono font-bold ${
                          saldoPeriodoNeg ? 'text-red-400' : 'text-emerald-400'
                        }`}
                      >
                        {funcResumo.saldoPeriodoFormatado}
                      </td>

                      {/* Saldo Total Atual (+HH:MM em verde / -HH:MM em vermelho) */}
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg font-mono font-extrabold text-xs shadow-xs ${
                            saldoTotalNeg
                              ? 'bg-red-950/70 text-red-300 border border-red-500/40'
                              : funcResumo.saldoTotalMinutos > 0
                                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/40'
                                : 'bg-slate-900 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {funcResumo.saldoTotalFormatado}
                        </span>
                      </td>

                      {/* Botão de Ver Extrato */}
                      <td className="py-3 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setFuncionarioSelecionado(funcResumo)
                            setExtratoModalOpen(true)
                          }}
                          className="h-7 text-[11px] text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:text-[#E5C07B]"
                        >
                          <History className="w-3.5 h-3.5 mr-1" />
                          Extrato
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Modal / Painel de Extrato Individual Lançamento a Lançamento */}
      <Dialog open={extratoModalOpen} onOpenChange={setExtratoModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-[#0F1624] text-amber-50 border-[#D4AF37]/30 shadow-2xl p-0">
          {/* Header do Extrato */}
          <div className="p-5 border-b border-[#D4AF37]/20 bg-[#070B11]/90">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-[#7C3AED]/20 border border-[#7C3AED]/30 text-[#D4AF37]">
                    <History className="w-4 h-4" />
                  </span>
                  <DialogTitle className="text-base font-bold text-amber-50">
                    Extrato de Banco de Horas
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs text-slate-400 mt-1">
                  Colaborador:{' '}
                  <strong className="text-amber-100">{funcionarioSelecionado?.nome}</strong> •
                  Matrícula:{' '}
                  <span className="font-mono text-amber-300">
                    {funcionarioSelecionado?.matricula}
                  </span>{' '}
                  • {funcionarioSelecionado?.departamentoNome}
                </DialogDescription>
              </div>

              {/* Saldo Geral no Header do Modal */}
              <div className="flex items-center gap-3 bg-[#0F1624] border border-[#D4AF37]/30 px-3.5 py-2 rounded-xl">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Saldo Acumulado
                  </span>
                  <span
                    className={`text-lg font-mono font-black ${
                      (funcionarioSelecionado?.saldoTotalMinutos || 0) < 0
                        ? 'text-red-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {funcionarioSelecionado?.saldoTotalFormatado}
                  </span>
                </div>
              </div>
            </div>

            {/* Filtros da Competência no Extrato */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#D4AF37]/10">
              <span className="text-xs text-slate-400 font-medium">
                Filtrar lançamentos por período:
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={extratoFiltroCompetencia === 'mes_atual' ? 'default' : 'outline'}
                  onClick={() => setExtratoFiltroCompetencia('mes_atual')}
                  className={`h-7 text-xs ${
                    extratoFiltroCompetencia === 'mes_atual'
                      ? 'bg-[#D4AF37] text-slate-950 font-bold hover:bg-[#E5C07B]'
                      : 'border-[#D4AF37]/30 bg-[#070B11] text-amber-200'
                  }`}
                >
                  Competência {MESES[mes - 1]}/{ano}
                </Button>
                <Button
                  size="sm"
                  variant={extratoFiltroCompetencia === 'todas' ? 'default' : 'outline'}
                  onClick={() => setExtratoFiltroCompetencia('todas')}
                  className={`h-7 text-xs ${
                    extratoFiltroCompetencia === 'todas'
                      ? 'bg-[#D4AF37] text-slate-950 font-bold hover:bg-[#E5C07B]'
                      : 'border-[#D4AF37]/30 bg-[#070B11] text-amber-200'
                  }`}
                >
                  Histórico Completo
                </Button>
              </div>
            </div>
          </div>

          {/* Lista de Lançamentos */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {extratoItensFiltrados.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-[#D4AF37]/20 rounded-xl bg-[#070B11]/50">
                <Info className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-300">
                  Nenhum lançamento de banco de horas encontrado para este período.
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Créditos são gerados automaticamente quando o colaborador trabalha após a saída
                  prevista ou em dias de folga.
                </p>
              </div>
            ) : (
              <div className="border border-[#D4AF37]/20 rounded-xl overflow-hidden bg-[#070B11]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#D4AF37]/20 bg-[#121824] text-slate-300 font-semibold">
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3">Origem</th>
                      <th className="py-2.5 px-3">Descrição / Ocorrência</th>
                      <th className="py-2.5 px-3 text-right">Lançamento</th>
                      <th className="py-2.5 px-3 text-right">Saldo Corrente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4AF37]/10">
                    {extratoItensFiltrados.map((item) => {
                      const isCredito = item.tipo === 'credito'

                      return (
                        <tr key={item.id} className="hover:bg-[#151D2C]/60 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-amber-200 whitespace-nowrap">
                            {formatBRDate(item.data)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.origem === 'trabalho_pos_saida'
                                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                                  : item.origem === 'antecipacao_entrada'
                                    ? 'bg-teal-950/80 text-teal-300 border border-teal-500/30'
                                    : item.origem === 'dia_folga'
                                      ? 'bg-purple-950/80 text-purple-300 border border-purple-500/30'
                                      : item.origem === 'atraso_tolerancia'
                                        ? 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                                        : item.origem === 'ajuste_admin'
                                          ? 'bg-blue-950/80 text-blue-300 border border-blue-500/30'
                                          : 'bg-red-950/80 text-red-300 border border-red-500/30'
                              }`}
                            >
                              {item.origemLabel}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            <div>{item.descricao}</div>
                            {item.atrasoOcorrencia && (
                              <div className="text-[10px] text-amber-400 mt-0.5 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>{item.atrasoOcorrencia}</span>
                              </div>
                            )}
                            {item.responsavelNome && (
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Responsável: {item.responsavelNome}
                              </div>
                            )}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap ${
                              isCredito ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {item.horasFormatadas}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-amber-100 whitespace-nowrap">
                            {item.saldoAcumuladoFormatado}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer do Modal */}
          <div className="p-4 border-t border-[#D4AF37]/20 bg-[#070B11] flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Total de lançamentos:{' '}
              <strong className="text-amber-200">{extratoItensFiltrados.length}</strong>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExtratoModalOpen(false)}
              className="border-[#D4AF37]/30 text-amber-200 hover:bg-[#151D2C]"
            >
              Fechar Extrato
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
