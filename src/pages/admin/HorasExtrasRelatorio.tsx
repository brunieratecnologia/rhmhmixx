import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  carregarDadosRelatorioHorasExtras,
  gerarCsvHorasExtras,
  gerarCsvExtratoIndividual,
  RelatorioHorasExtras,
  FuncionarioHorasExtras,
  ItemLancamentoHoraExtra,
} from '@/services/horasExtrasRelatorioService'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { formatBRDate, formatBRCurrency } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Download,
  RotateCcw,
  Search,
  Building2,
  AlertTriangle,
  History,
  FileSpreadsheet,
  CheckCircle2,
  Users,
  DollarSign,
  Info,
  CalendarDays,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'

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

export function HorasExtrasRelatorio() {
  const { user } = useAuth()
  const { toast } = useToast()

  const isAdmin = user?.role === 'admin'

  // Competência padrão: mês atual no horário de SP
  const hoje = useMemo(() => new Date(), [])
  const [ano, setAno] = useState<number>(hoje.getFullYear())
  const [mes, setMes] = useState<number>(hoje.getMonth() + 1) // 1 a 12

  const [loading, setLoading] = useState<boolean>(true)
  const [relatorio, setRelatorio] = useState<RelatorioHorasExtras | null>(null)

  // Filtros de visualização
  const [activeTab, setActiveTab] = useState<'ativos' | 'desligados'>('ativos')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [selectedDepto, setSelectedDepto] = useState<string>('todos')
  const [filtroApenasComHE, setFiltroApenasComHE] = useState<boolean>(false)

  // Ordenação
  const [ordenacao, setOrdenacao] = useState<'nome' | 'he_periodo' | 'vencido' | 'valor'>(
    'he_periodo',
  )
  const [ordemDesc, setOrdemDesc] = useState<boolean>(true)

  // Modal de Extrato Individual
  const [funcionarioSelecionado, setFuncionarioSelecionado] =
    useState<FuncionarioHorasExtras | null>(null)
  const [extratoModalOpen, setExtratoModalOpen] = useState<boolean>(false)
  const [extratoFiltroTipo, setExtratoFiltroTipo] = useState<'todos' | 'vencidos' | 'periodo'>(
    'todos',
  )

  // Carregar dados completos
  const carregarRelatorio = useCallback(async () => {
    setLoading(true)
    try {
      const dados = await carregarDadosRelatorioHorasExtras(ano, mes, isAdmin)
      setRelatorio(dados)
    } catch (error) {
      console.error('Erro ao carregar relatório de horas extras:', error)
      toast({
        title: 'Erro ao carregar relatório',
        description:
          'Não foi possível carregar os dados de horas extras. Verifique a conexão com o servidor.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [ano, mes, isAdmin, toast])

  useEffect(() => {
    carregarRelatorio()
  }, [carregarRelatorio])

  // Controles de navegação de competência
  const handleMesAnterior = () => {
    if (mes === 1) {
      setAno((prev) => prev - 1)
      setMes(12)
    } else {
      setMes((prev) => prev - 1)
    }
  }

  const handleProximoMes = () => {
    if (mes === 12) {
      setAno((prev) => prev + 1)
      setMes(1)
    } else {
      setMes((prev) => prev + 1)
    }
  }

  // Lista de departamentos para o filtro
  const departamentosDisponiveis = useMemo(() => {
    if (!relatorio) return []
    const deptos = new Set<string>()
    relatorio.funcionarios.forEach((f) => {
      if (f.departamentoNome && f.departamentoNome !== 'Não definido') {
        deptos.add(f.departamentoNome)
      }
    })
    return Array.from(deptos).sort()
  }, [relatorio])

  // Filtragem e ordenação da tabela
  const funcionariosFiltrados = useMemo(() => {
    if (!relatorio) return []

    return relatorio.funcionarios
      .filter((f) => {
        // Aba de ativos vs desligados
        if (activeTab === 'ativos' && f.situacao === 'desligado') return false
        if (activeTab === 'desligados' && f.situacao !== 'desligado') return false

        // Filtro de busca textual
        if (searchTerm.trim()) {
          const termo = searchTerm.toLowerCase().trim()
          const matchNome = f.nome.toLowerCase().includes(termo)
          const matchMatricula = f.matricula.toLowerCase().includes(termo)
          const matchCargo = f.cargoNome.toLowerCase().includes(termo)
          if (!matchNome && !matchMatricula && !matchCargo) return false
        }

        // Filtro por departamento
        if (selectedDepto !== 'todos' && f.departamentoNome !== selectedDepto) {
          return false
        }

        // Filtro apenas colaboradores com HE ou créditos vencidos
        if (
          filtroApenasComHE &&
          f.horasExtrasPeriodoMinutos === 0 &&
          f.creditoVencidoMinutos === 0
        ) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        let diff = 0
        if (ordenacao === 'nome') {
          diff = a.nome.localeCompare(b.nome)
        } else if (ordenacao === 'he_periodo') {
          diff = a.horasExtrasPeriodoMinutos - b.horasExtrasPeriodoMinutos
        } else if (ordenacao === 'vencido') {
          diff = a.creditoVencidoMinutos - b.creditoVencidoMinutos
        } else if (ordenacao === 'valor') {
          diff = (a.valorEstimadoPagar || 0) - (b.valorEstimadoPagar || 0)
        }
        return ordemDesc ? -diff : diff
      })
  }, [relatorio, activeTab, searchTerm, selectedDepto, filtroApenasComHE, ordenacao, ordemDesc])

  // Exportar Consolidado CSV
  const handleExportCSV = () => {
    if (!relatorio || funcionariosFiltrados.length === 0) return

    const csvContent = gerarCsvHorasExtras(relatorio, funcionariosFiltrados)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `relatorio_horas_extras_mhmixx_${ano}_${String(mes).padStart(2, '0')}.csv`,
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

  // Exportar Extrato Individual CSV
  const handleExportIndividualCSV = (func: FuncionarioHorasExtras) => {
    const csvContent = gerarCsvExtratoIndividual(func, ano, mes, isAdmin)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `extrato_he_${func.matricula}_${ano}_${String(mes).padStart(2, '0')}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: 'Extrato exportado',
      description: `Arquivo CSV do colaborador ${func.nome} baixado com sucesso.`,
      className: 'bg-emerald-950 text-emerald-100 border-emerald-800',
    })
  }

  // Extrato filtrado do modal
  const extratoItensFiltrados = useMemo(() => {
    if (!funcionarioSelecionado) return []
    if (extratoFiltroTipo === 'vencidos') {
      return funcionarioSelecionado.extrato.filter((i) => i.vencido)
    }
    if (extratoFiltroTipo === 'periodo') {
      return funcionarioSelecionado.extrato.filter((i) => !i.vencido)
    }
    return funcionarioSelecionado.extrato
  }, [funcionarioSelecionado, extratoFiltroTipo])

  return (
    <div className="space-y-6">
      {/* 1. Header do Relatório */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#D4AF37]/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/30 text-[#D4AF37]">
              <Clock className="w-5 h-5 text-[#D4AF37]" />
            </span>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-amber-50">
                Relatório de Horas Extras
              </h2>
              <p className="text-xs text-slate-400">
                Apuração corporativa de horas extras, créditos expirados (&gt;6 meses) a pagar com
                +50% e valor sugerido em R$
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
            title="Atualizar dados reais"
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

      {/* 2. Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total de Horas Extras do Período */}
        <div className="relative overflow-hidden rounded-2xl bg-[#0F1624] border border-[#D4AF37]/20 p-4 sm:p-5 shadow-lg group hover:border-[#D4AF37]/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              HE Apuradas no Período
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[#E5C07B]">
              {loading ? '---' : relatorio?.totalHorasExtrasFormatado || '00:00'}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              Trabalho pós-saída, antecipações e folgas da competência
            </p>
          </div>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-[#D4AF37]/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 2: Créditos Vencidos (>6 meses) a Pagar HE +50% */}
        <div className="relative overflow-hidden rounded-2xl bg-[#0F1624] border border-[#D4AF37]/20 p-4 sm:p-5 shadow-lg group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              A Pagar como HE (+50%)
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-400">
              {loading ? '---' : relatorio?.totalCreditoVencidoFormatado || '00:00'}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              Créditos de BH vencidos sem compensação (FIFO)
            </p>
          </div>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 3: Funcionários com HE */}
        <div className="relative overflow-hidden rounded-2xl bg-[#0F1624] border border-[#D4AF37]/20 p-4 sm:p-5 shadow-lg group hover:border-[#7C3AED]/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Colaboradores com HE
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#7C3AED]/15 border border-[#7C3AED]/30 flex items-center justify-center text-[#A78BFA]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-purple-300">
                {loading ? '---' : relatorio?.totalFuncionariosComHE || 0}
              </span>
              <span className="text-xs text-slate-400">
                / {relatorio?.totalFuncionariosAtivos || 0} ativos
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Com HE apurada no mês ou crédito expirado
            </p>
          </div>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-[#7C3AED]/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 4: Valor Total Estimado a Pagar em R$ (visível apenas para admin) */}
        <div className="relative overflow-hidden rounded-2xl bg-[#0F1624] border border-[#D4AF37]/20 p-4 sm:p-5 shadow-lg group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Total Estimado a Pagar
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400">
              {loading
                ? '---'
                : isAdmin
                  ? relatorio?.valorTotalEstimadoPagar !== undefined
                    ? formatBRCurrency(relatorio.valorTotalEstimadoPagar)
                    : 'R$ 0,00'
                  : 'Restrito ao Admin'}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              {isAdmin
                ? 'HE +50% calculada sobre salário contratual (divisor 200/220)'
                : 'Salários e valores monetários disponíveis apenas para Administrador'}
            </p>
          </div>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
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

        {/* Controles de Busca, Filtro de Departamento e Ordenação */}
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
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Buscar colaborador, matrícula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 pl-8 text-xs bg-[#070B11] border-[#D4AF37]/25 text-amber-50 placeholder:text-slate-500 focus-visible:ring-[#D4AF37]/40"
            />
          </div>

          {/* Checkbox Apenas com HE */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFiltroApenasComHE((prev) => !prev)}
            className={`h-10 text-xs border-[#D4AF37]/30 ${
              filtroApenasComHE
                ? 'bg-[#D4AF37]/20 text-[#E5C07B] border-[#D4AF37]'
                : 'bg-[#070B11] text-slate-400 hover:text-amber-100'
            }`}
          >
            Apenas com HE
          </Button>
        </div>
      </div>

      {/* 4. Tabela Consolidada de Horas Extras */}
      <div className="rounded-2xl border border-[#D4AF37]/25 bg-[#0F1624] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#D4AF37]/20 bg-[#070B11]/80 text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Matrícula</th>
                <th
                  className="py-3 px-4 cursor-pointer hover:text-[#D4AF37] select-none"
                  onClick={() => {
                    if (ordenacao === 'nome') setOrdemDesc(!ordemDesc)
                    else {
                      setOrdenacao('nome')
                      setOrdemDesc(false)
                    }
                  }}
                >
                  Colaborador {ordenacao === 'nome' && (ordemDesc ? '↓' : '↑')}
                </th>
                <th className="py-3 px-4">Departamento / Cargo</th>
                <th className="py-3 px-4">Jornada</th>
                <th
                  className="py-3 px-4 text-right cursor-pointer hover:text-[#D4AF37] select-none"
                  onClick={() => {
                    if (ordenacao === 'he_periodo') setOrdemDesc(!ordemDesc)
                    else {
                      setOrdenacao('he_periodo')
                      setOrdemDesc(true)
                    }
                  }}
                >
                  HE Período {ordenacao === 'he_periodo' && (ordemDesc ? '↓' : '↑')}
                </th>
                <th
                  className="py-3 px-4 text-right cursor-pointer hover:text-amber-400 select-none"
                  onClick={() => {
                    if (ordenacao === 'vencido') setOrdemDesc(!ordemDesc)
                    else {
                      setOrdenacao('vencido')
                      setOrdemDesc(true)
                    }
                  }}
                >
                  A Pagar (+50%) {ordenacao === 'vencido' && (ordemDesc ? '↓' : '↑')}
                </th>
                {isAdmin && (
                  <th
                    className="py-3 px-4 text-right cursor-pointer hover:text-emerald-400 select-none"
                    onClick={() => {
                      if (ordenacao === 'valor') setOrdemDesc(!ordemDesc)
                      else {
                        setOrdenacao('valor')
                        setOrdemDesc(true)
                      }
                    }}
                  >
                    Valor Estimado (R$) {ordenacao === 'valor' && (ordemDesc ? '↓' : '↑')}
                  </th>
                )}
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D4AF37]/10">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RotateCcw className="w-6 h-6 animate-spin text-[#D4AF37]" />
                      <span>Carregando e apurando horas extras da MH MIXX...</span>
                    </div>
                  </td>
                </tr>
              ) : funcionariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="py-12 text-center text-slate-400">
                    <Info className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <p className="font-semibold text-slate-300">
                      Nenhum colaborador encontrado com os filtros atuais.
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Tente limpar a pesquisa ou selecionar outro departamento.
                    </p>
                  </td>
                </tr>
              ) : (
                funcionariosFiltrados.map((func) => {
                  const temHE = func.horasExtrasPeriodoMinutos > 0
                  const temVencido = func.creditoVencidoMinutos > 0

                  return (
                    <tr
                      key={func.funcionario.id}
                      onClick={() => {
                        setFuncionarioSelecionado(func)
                        setExtratoModalOpen(true)
                      }}
                      className="hover:bg-[#151D2C]/80 cursor-pointer transition-colors group"
                    >
                      {/* Matrícula */}
                      <td className="py-3 px-4 font-mono font-bold text-amber-200">
                        {func.matricula}
                      </td>

                      {/* Nome e Indicadores */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-amber-50 group-hover:text-[#E5C07B] transition-colors">
                          {func.nome}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {temVencido && (
                            <span className="inline-flex items-center text-[10px] text-amber-300 font-bold bg-amber-950/80 border border-amber-500/40 px-1.5 py-0.2 rounded">
                              <AlertTriangle className="w-2.5 h-2.5 mr-1 text-amber-400" />
                              Vencido a pagar +50%
                            </span>
                          )}
                          {func.situacao === 'em_ferias' && (
                            <span className="text-[10px] text-purple-300 bg-purple-950/60 border border-purple-600/30 px-1.5 py-0.2 rounded">
                              Em férias
                            </span>
                          )}
                          {func.situacao === 'desligado' && (
                            <span className="text-[10px] text-rose-300 bg-rose-950/60 border border-rose-600/30 px-1.5 py-0.2 rounded">
                              Desligado
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Departamento / Cargo */}
                      <td className="py-3 px-4">
                        <span className="text-slate-300 font-medium block">
                          {func.departamentoNome}
                        </span>
                        <span className="text-[11px] text-slate-500 block">{func.cargoNome}</span>
                      </td>

                      {/* Jornada */}
                      <td className="py-3 px-4">
                        <span className="text-[11px] text-slate-400 font-mono">
                          {func.jornadaNome}
                        </span>
                      </td>

                      {/* HE do Período */}
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span className={temHE ? 'text-[#E5C07B]' : 'text-slate-500'}>
                          {func.horasExtrasPeriodoFormatado}
                        </span>
                      </td>

                      {/* Créditos Vencidos (>6 meses) */}
                      <td className="py-3 px-4 text-right">
                        {temVencido ? (
                          <span className="inline-block px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-amber-950/70 text-amber-300 border border-amber-500/40">
                            {func.creditoVencidoFormatado}
                          </span>
                        ) : (
                          <span className="font-mono text-slate-500">00:00</span>
                        )}
                      </td>

                      {/* Valor Estimado a Pagar (visível apenas para admin) */}
                      {isAdmin && (
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          {func.valorEstimadoPagar && func.valorEstimadoPagar > 0 ? (
                            <span className="text-emerald-400">
                              {formatBRCurrency(func.valorEstimadoPagar)}
                            </span>
                          ) : (
                            <span className="text-slate-600">---</span>
                          )}
                        </td>
                      )}

                      {/* Botão de Extrato Individual */}
                      <td className="py-3 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setFuncionarioSelecionado(func)
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

      {/* 5. Modal / Painel de Extrato Individual com FIFO */}
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
                    Extrato de Horas Extras e Compensações
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

              {/* Ação de Exportar CSV do Extrato */}
              {funcionarioSelecionado && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportIndividualCSV(funcionarioSelecionado)}
                  className="h-8 text-xs border-[#D4AF37]/30 bg-[#0F1624] text-[#E5C07B] hover:bg-[#151D2C]"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  CSV Individual
                </Button>
              )}
            </div>

            {/* Resumo no Header do Modal */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 pt-3 border-t border-[#D4AF37]/15">
              <div className="bg-[#0F1624] border border-[#D4AF37]/20 p-2.5 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  HE no Período
                </span>
                <span className="text-base font-mono font-bold text-[#E5C07B]">
                  {funcionarioSelecionado?.horasExtrasPeriodoFormatado || '00:00'}
                </span>
              </div>
              <div className="bg-[#0F1624] border border-[#D4AF37]/20 p-2.5 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Crédito Vencido (&gt;6m)
                </span>
                <span className="text-base font-mono font-bold text-amber-400">
                  {funcionarioSelecionado?.creditoVencidoFormatado || '00:00'}
                </span>
              </div>
              {isAdmin && (
                <div className="bg-[#0F1624] border border-[#D4AF37]/20 p-2.5 rounded-xl col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Valor Sugerido (+50%)
                  </span>
                  <span className="text-base font-mono font-bold text-emerald-400">
                    {funcionarioSelecionado?.valorEstimadoPagar !== undefined
                      ? formatBRCurrency(funcionarioSelecionado.valorEstimadoPagar)
                      : '---'}
                  </span>
                </div>
              )}
            </div>

            {/* Filtros no Extrato */}
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#D4AF37]/10">
              <span className="text-xs text-slate-400 font-medium">Filtrar lançamentos:</span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant={extratoFiltroTipo === 'todos' ? 'default' : 'outline'}
                  onClick={() => setExtratoFiltroTipo('todos')}
                  className={`h-6 text-[11px] ${
                    extratoFiltroTipo === 'todos'
                      ? 'bg-[#D4AF37] text-slate-950 font-bold hover:bg-[#E5C07B]'
                      : 'border-[#D4AF37]/30 bg-[#070B11] text-amber-200'
                  }`}
                >
                  Todos ({funcionarioSelecionado?.extrato.length || 0})
                </Button>
                <Button
                  size="sm"
                  variant={extratoFiltroTipo === 'vencidos' ? 'default' : 'outline'}
                  onClick={() => setExtratoFiltroTipo('vencidos')}
                  className={`h-6 text-[11px] ${
                    extratoFiltroTipo === 'vencidos'
                      ? 'bg-[#D4AF37] text-slate-950 font-bold hover:bg-[#E5C07B]'
                      : 'border-[#D4AF37]/30 bg-[#070B11] text-amber-200'
                  }`}
                >
                  Vencidos ({funcionarioSelecionado?.extrato.filter((i) => i.vencido).length || 0})
                </Button>
                <Button
                  size="sm"
                  variant={extratoFiltroTipo === 'periodo' ? 'default' : 'outline'}
                  onClick={() => setExtratoFiltroTipo('periodo')}
                  className={`h-6 text-[11px] ${
                    extratoFiltroTipo === 'periodo'
                      ? 'bg-[#D4AF37] text-slate-950 font-bold hover:bg-[#E5C07B]'
                      : 'border-[#D4AF37]/30 bg-[#070B11] text-amber-200'
                  }`}
                >
                  No Período (
                  {funcionarioSelecionado?.extrato.filter((i) => !i.vencido).length || 0})
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
                  Nenhum lançamento de hora extra encontrado para este filtro.
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Créditos de horas extras são gerados após a jornada, antecipação ≥30m ou em
                  folgas.
                </p>
              </div>
            ) : (
              <div className="border border-[#D4AF37]/20 rounded-xl overflow-hidden bg-[#070B11]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#D4AF37]/20 bg-[#121824] text-slate-300 font-semibold">
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3">Origem</th>
                      <th className="py-2.5 px-3">Descrição da Ocorrência</th>
                      <th className="py-2.5 px-3 text-right">Horas</th>
                      <th className="py-2.5 px-3">Status</th>
                      {isAdmin && <th className="py-2.5 px-3 text-right">Valor Sugerido</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4AF37]/10">
                    {extratoItensFiltrados.map((item) => {
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-[#151D2C]/60 transition-colors ${
                            item.vencido ? 'bg-amber-950/20' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono text-amber-200 whitespace-nowrap">
                            {formatBRDate(item.data)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.origem === 'credito_expirado'
                                  ? 'bg-amber-950/90 text-amber-300 border border-amber-500/40'
                                  : item.origem === 'trabalho_pos_saida'
                                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                                    : item.origem === 'antecipacao_entrada'
                                      ? 'bg-teal-950/80 text-teal-300 border border-teal-500/30'
                                      : 'bg-purple-950/80 text-purple-300 border border-purple-500/30'
                              }`}
                            >
                              {item.origemLabel}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            <div>{item.descricao}</div>
                            {item.dataLimiteCompensacao && (
                              <div className="text-[10px] text-amber-400 mt-0.5">
                                Limite de compensação de 6 meses expirado em:{' '}
                                <strong>{formatBRDate(item.dataLimiteCompensacao)}</strong>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-[#E5C07B] whitespace-nowrap">
                            {item.horasFormatadas}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {item.vencido ? (
                              <span className="inline-flex items-center text-[10px] text-amber-300 font-bold bg-amber-950/80 border border-amber-500/40 px-1.5 py-0.5 rounded">
                                <AlertTriangle className="w-2.5 h-2.5 mr-1 text-amber-400" />
                                Vencido — a pagar HE +50%
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[10px] text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                <CheckCircle2 className="w-2.5 h-2.5 mr-1 text-emerald-400" />
                                Apurado no período
                              </span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                              {item.valorEstimado !== undefined
                                ? formatBRCurrency(item.valorEstimado)
                                : '---'}
                            </td>
                          )}
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
              Total de itens:{' '}
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

export default HorasExtrasRelatorio
