import React, { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  funcionariosService,
  fechamentoFolhaService,
  atestadosService,
  espelhoPontoService,
} from '@/services/rh'
import type { Funcionario, FechamentoFolha } from '@/types/rh'
import {
  construirEspelhoMensal,
  DiaEspelhoCalculado,
  ResumoEspelhoMensal,
  minutesToHoursText,
} from '@/lib/calculoHoras'
import { executarTestesIntervaloAutomatico } from '@/lib/calculoHoras.test'
import { formatBRDate } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Printer,
  Lock,
  Unlock,
  AlertTriangle,
  FileText,
  PlusCircle,
  Clock,
  ShieldCheck,
  Building2,
  Paperclip,
  Trash2,
  Ban,
  HelpCircle,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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

export default function EspelhoPonto() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, role } = useAuth()
  const { toast } = useToast()

  const now = new Date()
  const initialFuncId = searchParams.get('funcionarioId') || ''
  const initialAno = parseInt(searchParams.get('ano') || String(now.getFullYear()), 10)
  const initialMes = parseInt(searchParams.get('mes') || String(now.getMonth() + 1), 10)

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [selectedFuncId, setSelectedFuncId] = useState<string>(initialFuncId)
  const [ano, setAno] = useState<number>(initialAno)
  const [mes, setMes] = useState<number>(initialMes)

  const [funcionarioAtual, setFuncionarioAtual] = useState<Funcionario | null>(null)
  const [fechamento, setFechamento] = useState<FechamentoFolha | null>(null)
  const [diasEspelho, setDiasEspelho] = useState<DiaEspelhoCalculado[]>([])
  const [resumo, setResumo] = useState<ResumoEspelhoMensal | null>(null)
  const [loading, setLoading] = useState(false)

  // Modais
  // 1. Fechamento de Folha Modal
  const [fechamentoModalOpen, setFechamentoModalOpen] = useState(false)
  const [acaoFechamento, setAcaoFechamento] = useState<
    'abrir_fechamento' | 'encerrar_fechamento' | 'reabrir_fechamento'
  >('abrir_fechamento')
  const [obsFechamento, setObsFechamento] = useState('')
  const [processandoFechamento, setProcessandoFechamento] = useState(false)

  // 2. Inclusão / Ajuste de Ponto Faltante ou Anulação no Fechamento
  const [ajustePontoModalOpen, setAjustePontoModalOpen] = useState(false)
  const [ajusteDia, setAjusteDia] = useState<DiaEspelhoCalculado | null>(null)
  const [ajusteModo, setAjusteModo] = useState<'incluir' | 'anular'>('incluir')
  const [registroParaAnular, setRegistroParaAnular] = useState<string>('')
  const [ajusteHora, setAjusteHora] = useState('08:00')
  const [ajusteTipoMarcacao, setAjusteTipoMarcacao] = useState<
    'entrada' | 'inicio_intervalo' | 'retorno_intervalo' | 'saida' | 'outro'
  >('entrada')
  const [ajusteMotivo, setAjusteMotivo] = useState('')
  const [salvandoAjuste, setSalvandoAjuste] = useState(false)

  // 3. Registro de Atestado Médico Modal
  const [atestadoModalOpen, setAtestadoModalOpen] = useState(false)
  const [atestadoDia, setAtestadoDia] = useState<DiaEspelhoCalculado | null>(null)
  const [atestadoDataFim, setAtestadoDataFim] = useState('')
  const [atestadoMotivo, setAtestadoMotivo] = useState('')
  const [atestadoArquivo, setAtestadoArquivo] = useState<File | null>(null)
  const [salvandoAtestado, setSalvandoAtestado] = useState(false)

  // Execução de validação dos testes de regressão do cálculo de ponto e intervalo automático
  useEffect(() => {
    try {
      const suite = executarTestesIntervaloAutomatico()
      if (!suite.todosPassaram) {
        console.warn(
          '[EspelhoPonto] Testes de intervalo automático reportaram falhas:',
          suite.resultados,
        )
      }
    } catch (err) {
      console.error('[EspelhoPonto] Erro ao validar suite de intervalo:', err)
    }
  }, [])

  // Carregar lista de funcionários
  useEffect(() => {
    async function loadFuncs() {
      try {
        const res = await funcionariosService.list(1, 200, '', 'nome')
        setFuncionarios(res.items)
        if (!selectedFuncId && res.items.length > 0) {
          setSelectedFuncId(res.items[0].id)
        }
      } catch (err) {
        console.error('Erro ao listar funcionários para o espelho:', err)
      }
    }
    loadFuncs()
  }, [])

  // Carregar dados do espelho quando funcionário ou competência mudar
  const carregarEspelho = async () => {
    if (!selectedFuncId) return
    setLoading(true)
    try {
      const dados = await espelhoPontoService.getDadosEspelho(selectedFuncId, ano, mes)
      setFuncionarioAtual(dados.funcionario)
      setFechamento(dados.fechamento)

      const calculado = construirEspelhoMensal({
        ano,
        mes,
        jornadaAtual: dados.funcionario.expand?.jornada_atual || null,
        historicoJornadas: dados.historicoJornadas,
        registrosMes: dados.registros,
        tratamentosMes: dados.tratamentos,
        ausenciasMes: dados.ausencias,
        feriasMes: dados.ferias,
      })

      setDiasEspelho(calculado.dias)
      setResumo(calculado.resumo)

      // Atualiza URL search params
      setSearchParams({
        funcionarioId: selectedFuncId,
        ano: String(ano),
        mes: String(mes),
      })
    } catch (err: any) {
      console.error('Erro ao carregar dados do espelho:', err)
      toast({
        title: 'Erro ao carregar espelho de ponto',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedFuncId) {
      carregarEspelho()
    }
  }, [selectedFuncId, ano, mes])

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

  // Exportar CSV
  const handleExportCSV = () => {
    if (!funcionarioAtual || diasEspelho.length === 0) return

    const rows: string[][] = [
      ['ESPELHO DE PONTO MENSAL - SISTEMA DE RECURSOS HUMANOS'],
      ['Colaborador:', funcionarioAtual.nome, 'Matrícula:', funcionarioAtual.matricula],
      [
        'Cargo:',
        funcionarioAtual.expand?.cargo?.nome || 'Não definido',
        'Competência:',
        `${MESES[mes - 1]}/${ano}`,
      ],
      [],
      [
        'Data',
        'Dia Sem.',
        'Jornada Prevista',
        'Marcações Realizadas',
        'Trabalhado',
        'Diferença',
        'Ocorrências / Justificativas',
      ],
    ]

    for (const d of diasEspelho) {
      const batidasStr = d.todasMarcacoes
        .map((m) => {
          const origemLabel =
            m.origem === 'tratamento_fechamento'
              ? 'Aj. Fechamento'
              : m.origem === 'intervalo_automatico'
                ? 'Intervalo Auto'
                : 'Terminal'
          return `${m.horario} (${origemLabel})`
        })
        .join(' | ')

      const ocorrenciasStr = [
        ...(d.intervaloAutomaticoAplicado
          ? [
              `Intervalo automático aplicado (${d.intervaloInfo?.inicio || ''} às ${d.intervaloInfo?.retorno || ''})`,
            ]
          : []),
        ...d.ocorrencias.map((o) => o.descricao),
      ].join('; ')

      rows.push([
        formatBRDate(d.data),
        d.diaSemanaLabel,
        d.previstoFormatado,
        batidasStr || '--',
        d.realizadoFormatado,
        d.diferencaFormatada,
        ocorrenciasStr || 'Normal',
      ])
    }

    if (resumo) {
      rows.push([])
      rows.push(['RESUMO DA COMPETÊNCIA'])
      rows.push(['Total de Dias Trabalhados:', String(resumo.totalDiasTrabalhados)])
      rows.push(['Total Previsto:', minutesToHoursText(resumo.previstoTotalMinutos)])
      rows.push(['Total Realizado:', minutesToHoursText(resumo.realizadoTotalMinutos)])
      rows.push(['Saldo do Mês:', minutesToHoursText(resumo.saldoTotalMinutos)])
      rows.push(['Horas Extras:', minutesToHoursText(resumo.horasExtrasMinutos)])
      rows.push(['Horas Faltas:', minutesToHoursText(resumo.horasFaltasMinutos)])
    }

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      rows.map((r) => r.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(';')).join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `espelho_ponto_${funcionarioAtual.matricula}_${ano}_${String(mes).padStart(2, '0')}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Exportar / Imprimir PDF
  const handlePrintPDF = () => {
    window.print()
  }

  // Controle de Fechamento da Folha
  const handleGerenciarFechamento = async () => {
    setProcessandoFechamento(true)
    try {
      const res = await fechamentoFolhaService.alterarStatus({
        competencia_ano: ano,
        competencia_mes: mes,
        acao: acaoFechamento,
        observacoes: obsFechamento,
      })
      toast({
        title: 'Status do fechamento atualizado',
        description: res.message,
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      })
      setFechamentoModalOpen(false)
      setObsFechamento('')
      carregarEspelho()
    } catch (err: any) {
      toast({
        title: 'Erro ao alterar fechamento',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setProcessandoFechamento(false)
    }
  }

  // Salvar Ajuste / Inclusão de Ponto Faltante ou Anulação de Marcação
  const handleSalvarAjustePonto = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ajusteDia || !selectedFuncId || !ajusteMotivo.trim()) return

    if (ajusteModo === 'anular' && !registroParaAnular) {
      toast({
        title: 'Selecione a marcação para anular',
        description: 'É necessário indicar qual marcação original será anulada.',
        variant: 'destructive',
      })
      return
    }

    setSalvandoAjuste(true)
    try {
      if (ajusteModo === 'anular') {
        // Encontrar horário do registro selecionado para salvar no tratamento
        const regAlvo = ajusteDia.marcacoesOriginais.find((r) => r.id === registroParaAnular)
        const horaAlvo = regAlvo
          ? regAlvo.timestamp_utc
            ? regAlvo.timestamp_utc.slice(11, 16)
            : regAlvo.hora_utc.slice(0, 5)
          : ajusteHora

        await fechamentoFolhaService.ajustarPonto({
          funcionario: selectedFuncId,
          data_registro: ajusteDia.data,
          hora_registro: horaAlvo,
          tipo: 'anulacao',
          justificativa: ajusteMotivo.trim(),
          registro: registroParaAnular,
          acao_tipo: 'anular',
        })

        toast({
          title: 'Marcação anulada com sucesso.',
          description:
            'A marcação foi anulada por registro complementar auditado (AJ). O registro original permanece intacto no histórico imutável.',
          className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        })
      } else {
        await fechamentoFolhaService.ajustarPonto({
          funcionario: selectedFuncId,
          data_registro: ajusteDia.data,
          hora_registro: ajusteHora,
          tipo: 'correcao',
          tipo_marcacao: ajusteTipoMarcacao,
          justificativa: ajusteMotivo.trim(),
          acao_tipo: 'incluir',
        })

        toast({
          title: 'Marcação complementar incluída.',
          description:
            'O registro foi auditado e anexado ao espelho como tratamento de fechamento. O registro original permanece intacto.',
          className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        })
      }

      setAjustePontoModalOpen(false)
      setAjusteMotivo('')
      setRegistroParaAnular('')
      carregarEspelho()
    } catch (err: any) {
      toast({
        title: 'Ajuste bloqueado',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setSalvandoAjuste(false)
    }
  }

  // Atalho para abrir o fechamento diretamente
  const handleAbrirFechamentoRapido = () => {
    setAcaoFechamento('abrir_fechamento')
    setObsFechamento('Abertura de fechamento para ajustes de ponto no espelho')
    setFechamentoModalOpen(true)
  }

  // Salvar Atestado Médico
  const handleSalvarAtestado = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!atestadoDia || !selectedFuncId || !atestadoArquivo) return

    setSalvandoAtestado(true)
    try {
      await atestadosService.uploadAtestado({
        funcionarioId: selectedFuncId,
        dataInicio: atestadoDia.data,
        dataFim: atestadoDataFim || atestadoDia.data,
        justificativa: atestadoMotivo.trim() || 'Atestado médico apresentado pelo colaborador',
        arquivo: atestadoArquivo,
        adminUserId: user?.id,
      })

      toast({
        title: 'Atestado médico anexado.',
        description:
          'O documento foi gravado em armazenamento privado e a ocorrência justificada no espelho.',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      })

      setAtestadoModalOpen(false)
      setAtestadoArquivo(null)
      setAtestadoMotivo('')
      carregarEspelho()
    } catch (err: any) {
      toast({
        title: 'Erro ao anexar atestado',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setSalvandoAtestado(false)
    }
  }

  const isFechamentoAberto = fechamento?.status === 'aberto_fechamento'
  const isFechamentoFechado = fechamento?.status === 'fechado'
  const isPeriodoFuturo =
    ano > now.getFullYear() || (ano === now.getFullYear() && mes > now.getMonth() + 1)

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Espelho de Ponto</h2>
            {isFechamentoAberto && (
              <span className="bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <Unlock className="w-3.5 h-3.5" />
                Fechamento do Mês Aberto (Ajustes Liberados)
              </span>
            )}
            {isFechamentoFechado && (
              <span className="bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Folha Encerrada (Travada)
              </span>
            )}
            {!isFechamentoAberto && !isFechamentoFechado && (
              <span className="bg-blue-50 text-[#2563EB] border border-blue-200 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Mês Corrente (Em Andamento)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Visão administrativa do ponto, previsto vs realizado, ocorrências e fechamento mensal
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Botão de Fechamento do Mês */}
          <Button
            onClick={() => {
              if (isFechamentoFechado) {
                setAcaoFechamento('reabrir_fechamento')
              } else if (isFechamentoAberto) {
                setAcaoFechamento('encerrar_fechamento')
              } else {
                setAcaoFechamento('abrir_fechamento')
              }
              setObsFechamento('')
              setFechamentoModalOpen(true)
            }}
            disabled={isPeriodoFuturo}
            className={`text-xs h-9 font-semibold ${
              isFechamentoAberto
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : isFechamentoFechado
                  ? 'bg-slate-800 hover:bg-slate-900 text-white'
                  : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white'
            }`}
          >
            {isFechamentoAberto ? (
              <>
                <Lock className="w-3.5 h-3.5 mr-1.5" />
                Encerrar Fechamento da Folha
              </>
            ) : isFechamentoFechado ? (
              <>
                <Unlock className="w-3.5 h-3.5 mr-1.5" />
                Reabrir Fechamento (Admin)
              </>
            ) : (
              <>
                <Unlock className="w-3.5 h-3.5 mr-1.5" />
                Abrir Fechamento do Mês
              </>
            )}
          </Button>

          {/* Exportar CSV */}
          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={!funcionarioAtual}
            className="text-xs h-9 border-slate-200 text-slate-700"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            CSV
          </Button>

          {/* Imprimir / PDF */}
          <Button
            variant="outline"
            onClick={handlePrintPDF}
            disabled={!funcionarioAtual}
            className="text-xs h-9 border-slate-200 text-slate-700"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* Filter / Selector Bar */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 items-center print:hidden">
        {/* Funcionário Selector */}
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-slate-600">Funcionário</Label>
          <Select value={selectedFuncId} onValueChange={setSelectedFuncId}>
            <SelectTrigger className="text-xs h-9">
              <SelectValue placeholder="Selecione o funcionário" />
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

        {/* Competência Selector (Mês / Ano) */}
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-slate-600">Mês de Referência</Label>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMesAnterior}
              className="h-9 w-9 p-0 border-slate-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 text-center font-bold text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg py-1.5">
              {MESES[mes - 1]} de {ano}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleProximoMes}
              className="h-9 w-9 p-0 border-slate-200"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Informações da Jornada */}
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-0.5">
          <span className="font-semibold text-slate-700 block">Jornada Vinculada</span>
          <p className="text-slate-600 truncate">
            {funcionarioAtual?.expand?.jornada_atual?.nome || 'Sem jornada configurada'}
            {funcionarioAtual?.expand?.jornada_atual && (
              <span className="text-slate-400 ml-1">
                ({funcionarioAtual.expand.jornada_atual.hora_entrada} às{' '}
                {funcionarioAtual.expand.jornada_atual.hora_saida})
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Banner de Aviso de Regra do Usuário */}
      {!isFechamentoAberto && (
        <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-3 print:hidden">
          <ShieldCheck className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
          <p>
            <strong>Regra de Integridade do Ponto:</strong> Os registros originais do terminal são
            estritamente imutáveis. A edição ou inclusão de marcações faltantes esquecidas pelo
            colaborador é permitida pelo gestor <strong>apenas no fechamento do mês</strong> através
            do botão <em>"Abrir Fechamento do Mês"</em>. Fora do fechamento, a inclusão permanece
            bloqueada.
          </p>
        </div>
      )}

      {isFechamentoAberto && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-start gap-3 print:hidden">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p>
            <strong>Período de Fechamento Aberto:</strong> Você pode incluir marcações faltantes e
            justificar ocorrências diretamente na tabela abaixo clicando em{' '}
            <em>"+ Ajustar / Incluir"</em> no dia correspondente. Toda alteração gerará registro
            complementar auditado mantendo o original intacto. Ao finalizar, encerre o fechamento.
          </p>
        </div>
      )}

      {/* Cabeçalho de Impressão (Visível apenas em impressão/PDF) */}
      <div className="hidden print:block border-b border-slate-300 pb-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">ESPELHO DE PONTO MENSAL</h1>
            <p className="text-xs text-slate-600">
              Competência: {MESES[mes - 1]} / {ano}
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold">{funcionarioAtual?.nome}</p>
            <p className="text-slate-600">Matrícula: {funcionarioAtual?.matricula}</p>
            <p className="text-slate-600">Cargo: {funcionarioAtual?.expand?.cargo?.nome}</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {resumo && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase block">
              Dias Trabalhados
            </span>
            <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">
              {resumo.totalDiasTrabalhados}
              <span className="text-xs text-slate-400 font-normal ml-1">
                /{resumo.totalDiasNoMes}
              </span>
            </p>
          </div>

          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase block">
              Horas Previstas
            </span>
            <p className="text-xl font-bold font-mono text-slate-800 mt-0.5">
              {minutesToHoursText(resumo.previstoTotalMinutos)}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase block">
              Horas Realizadas
            </span>
            <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">
              {minutesToHoursText(resumo.realizadoTotalMinutos)}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3 shadow-xs">
            <span className="text-[11px] font-semibold text-amber-700 uppercase block">
              Crédito Banco Horas
            </span>
            <p
              className="text-xl font-bold font-mono text-amber-700 mt-0.5"
              title="Horas trabalhadas após a saída prevista (ou em folgas)"
            >
              +{minutesToHoursText(resumo.totalBancoCreditoMinutos)}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3 shadow-xs">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase block">
              Saldo do Mês
            </span>
            <p
              className={`text-xl font-bold font-mono mt-0.5 ${
                resumo.saldoTotalMinutos >= 0 ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {resumo.saldoTotalMinutos >= 0 ? '+' : ''}
              {minutesToHoursText(resumo.saldoTotalMinutos)}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-[#E2E8F0] p-3 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase block">
              Ocorrências
            </span>
            <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">
              {resumo.totalOcorrencias}
              {resumo.totalAtrasos > 0 && (
                <span className="text-[11px] text-red-600 font-semibold ml-1">
                  ({resumo.totalAtrasos} atr.)
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Main Table: Espelho de Ponto Diário */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-[#2563EB]" />
            Marcações e Apuração Diária — {MESES[mes - 1]} / {ano}
          </h3>
          <span className="text-xs text-slate-400">
            Horários no fuso America/Sao_Paulo (Horário de Brasília)
          </span>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Calculando espelho de ponto...</p>
          </div>
        ) : diasEspelho.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            Nenhum dado encontrado para a competência selecionada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold text-[11px]">
                  <th className="py-3 px-3 w-28">Data</th>
                  <th className="py-3 px-3 w-24">Previsto</th>
                  <th className="py-3 px-4 min-w-[260px]">
                    Marcações Realizadas (Entrada / Intervalos / Saída)
                  </th>
                  <th className="py-3 px-3 w-20 text-right">Realizado</th>
                  <th className="py-3 px-3 w-24 text-right">Banco Horas</th>
                  <th className="py-3 px-3 w-20 text-right">Diferença</th>
                  <th className="py-3 px-3 min-w-[220px]">Ocorrências e Atestados</th>
                  <th className="py-3 px-3 w-28 text-right print:hidden">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {diasEspelho.map((dia) => {
                  const isFimDeSemana = dia.diaSemana === 'sab' || dia.diaSemana === 'dom'
                  const temOcorrenciaAlerta = dia.ocorrencias.some((o) => o.severidade === 'alerta')
                  const temIncompleto = dia.ocorrencias.some(
                    (o) => o.tipo === 'marcacao_incompleta',
                  )

                  return (
                    <tr
                      key={dia.data}
                      className={`hover:bg-slate-50/90 transition-colors ${
                        dia.ehDiaFolga ? 'bg-slate-50/40 text-slate-500' : ''
                      } ${temIncompleto ? 'bg-amber-50/20' : ''}`}
                    >
                      {/* Data e Dia da Semana */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-800">
                            {formatBRDate(dia.data).slice(0, 5)}
                          </span>
                          <span
                            className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                              isFimDeSemana
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-blue-50 text-[#2563EB]'
                            }`}
                          >
                            {dia.diaSemana}
                          </span>
                        </div>
                      </td>

                      {/* Jornada Prevista */}
                      <td className="py-2.5 px-3 font-mono">
                        {dia.ehDiaFolga ? (
                          <span className="text-slate-400 italic text-xs">Folga</span>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-800 text-xs">
                              {dia.previstoFormatado}
                            </span>
                            {dia.cargaPrevistaFormatada && (
                              <span className="text-[10px] text-slate-500 font-sans tracking-tight">
                                {dia.cargaPrevistaFormatada}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Batidas Realizadas */}
                      <td className="py-2.5 px-4">
                        {dia.todasMarcacoes.length === 0 ? (
                          <span className="text-slate-300 italic text-[11px]">Sem batidas</span>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap font-mono">
                              {dia.todasMarcacoes.map((m, idx) => {
                                const ehAjuste = m.origem === 'tratamento_fechamento'
                                const ehAuto = m.origem === 'intervalo_automatico'
                                const ehAnulado = Boolean(m.anulado)
                                const ehOffline = Boolean(m.offline_sync)
                                return (
                                  <span
                                    key={idx}
                                    title={
                                      ehAnulado
                                        ? `Marcação Anulada: ${m.motivoAnulacao || 'Desconsiderada por registro complementar'}`
                                        : `${m.tipo.replace('_', ' ')} (${
                                            ehAuto
                                              ? 'Intervalo Automático derivado da jornada'
                                              : ehAjuste
                                                ? 'Ajuste Fechamento Folha'
                                                : ehOffline
                                                  ? 'Registrado Offline no Terminal e Sincronizado'
                                                  : 'Terminal Coletivo Imutável'
                                          })`
                                    }
                                    className={`px-2 py-0.5 rounded text-xs font-semibold border flex items-center gap-1 ${
                                      ehAnulado
                                        ? 'bg-red-50 text-red-700/80 border-red-200 line-through opacity-75'
                                        : ehAuto
                                          ? 'bg-purple-50 text-purple-900 border-purple-300 shadow-xs'
                                          : ehAjuste
                                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                                            : ehOffline
                                              ? 'bg-amber-50/80 text-amber-950 border-amber-300/80 shadow-xs'
                                              : 'bg-slate-100 text-slate-800 border-slate-200'
                                    }`}
                                  >
                                    {m.horario}
                                    {ehAuto && (
                                      <span
                                        className="text-[9px] bg-purple-200 text-purple-950 font-bold px-1 rounded uppercase tracking-wider"
                                        title="Intervalo automático da jornada"
                                      >
                                        Auto
                                      </span>
                                    )}
                                    {ehAjuste && !ehAnulado && (
                                      <span
                                        className="text-[9px] bg-amber-200 text-amber-900 px-1 rounded font-bold"
                                        title="Incluído pelo gestor no fechamento"
                                      >
                                        AJ
                                      </span>
                                    )}
                                    {ehOffline && !ehAnulado && (
                                      <span
                                        className="text-[9px] bg-amber-200 text-amber-950 px-1 rounded font-bold uppercase tracking-wider"
                                        title="Registrado offline e sincronizado automaticamente"
                                      >
                                        Offline
                                      </span>
                                    )}
                                    {ehAnulado && (
                                      <span
                                        className="text-[9px] bg-red-200 text-red-900 px-1 rounded font-bold"
                                        title={m.motivoAnulacao || 'Marcação anulada'}
                                      >
                                        ANULADA
                                      </span>
                                    )}
                                  </span>
                                )
                              })}
                            </div>

                            {/* Indicador auditável de intervalo automático */}
                            {dia.intervaloAutomaticoAplicado && dia.intervaloInfo && (
                              <div className="flex items-center gap-1 text-[10px] text-purple-700 font-medium">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
                                <span>
                                  Intervalo automático da jornada:{' '}
                                  <strong className="font-mono text-purple-900">
                                    {dia.intervaloInfo.inicio} às {dia.intervaloInfo.retorno}
                                  </strong>{' '}
                                  (-{dia.intervaloInfo.duracaoMinutos}m)
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Horas Trabalhadas */}
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                        {dia.realizadoFormatado !== '00:00' ? dia.realizadoFormatado : '--'}
                      </td>

                      {/* Banco de Horas (Crédito pós-saída prevista) */}
                      <td className="py-2.5 px-3 text-right font-mono">
                        {dia.horasBancoCreditoMinutos > 0 ? (
                          <span
                            className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[11px]"
                            title="Tempo trabalhado além da saída prevista -> Banco de Horas"
                          >
                            {dia.horasBancoCreditoFormatado}
                          </span>
                        ) : (
                          <span className="text-slate-300">--</span>
                        )}
                      </td>

                      {/* Diferença */}
                      <td className="py-2.5 px-3 text-right font-mono font-semibold">
                        {dia.diferencaMinutos > 0 ? (
                          <span className="text-emerald-600">+{dia.diferencaFormatada}</span>
                        ) : dia.diferencaMinutos < 0 && !dia.ehDiaFolga ? (
                          <span className="text-slate-500">{dia.diferencaFormatada}</span>
                        ) : (
                          <span className="text-slate-300">00:00</span>
                        )}
                      </td>

                      {/* Ocorrências e Atestados */}
                      <td className="py-2.5 px-3">
                        {dia.ocorrencias.length === 0 ? (
                          <span className="text-slate-300 text-[11px]">—</span>
                        ) : (
                          <div className="space-y-1">
                            {dia.ocorrencias.map((o, idx) => {
                              const ehAtestado = o.tipo === 'atestado'
                              const ehIncompleto = o.tipo === 'marcacao_incompleta'
                              return (
                                <div key={idx} className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 ${
                                      ehAtestado
                                        ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                        : ehIncompleto
                                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                          : o.severidade === 'alerta'
                                            ? 'bg-red-50 text-red-700 border border-red-200'
                                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                                    }`}
                                  >
                                    {ehAtestado && (
                                      <Paperclip className="w-3 h-3 text-purple-600" />
                                    )}
                                    {ehIncompleto && (
                                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                                    )}
                                    {o.descricao}
                                  </span>

                                  {/* Link para visualização do arquivo do atestado se houver */}
                                  {o.atestadoArquivo && o.atestadoId && (
                                    <a
                                      href={pb.files.getURL(
                                        { id: o.atestadoId, collectionId: 'documentos' },
                                        o.atestadoArquivo,
                                      )}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[11px] text-[#2563EB] hover:underline font-semibold flex items-center gap-0.5"
                                    >
                                      Ver Anexo ↗
                                    </a>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </td>

                      {/* Ações (Atestado / Inclusão de Ponto no Fechamento) */}
                      <td className="py-2.5 px-3 text-right print:hidden">
                        <div className="flex items-center justify-end gap-1">
                          {/* Anexar Atestado */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAtestadoDia(dia)
                              setAtestadoDataFim(dia.data)
                              setAtestadoMotivo('')
                              setAtestadoArquivo(null)
                              setAtestadoModalOpen(true)
                            }}
                            title="Anexar Atestado Médico"
                            className="h-7 px-2 text-[11px] border-slate-200 text-purple-700 hover:bg-purple-50"
                          >
                            <Paperclip className="w-3 h-3 mr-1" />
                            Atestado
                          </Button>

                          {/* Ajustar / Incluir Ponto (Habilitado durante fechamento do mês) */}
                          {isFechamentoAberto ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setAjusteDia(dia)
                                setAjusteModo('incluir')
                                setAjusteHora('08:00')
                                setAjusteTipoMarcacao('entrada')
                                setAjusteMotivo('')
                                setRegistroParaAnular('')
                                setAjustePontoModalOpen(true)
                              }}
                              className="h-7 px-2 text-[11px] border-amber-300 text-amber-800 bg-amber-50/70 hover:bg-amber-100 font-semibold"
                            >
                              <PlusCircle className="w-3 h-3 mr-1 text-amber-600" />
                              Ajustar
                            </Button>
                          ) : (
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span tabIndex={0} className="inline-block">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled
                                      className="h-7 px-2 text-[11px] border-slate-200 text-slate-400 opacity-60 cursor-not-allowed"
                                    >
                                      <PlusCircle className="w-3 h-3 mr-1" />
                                      Ajustar
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="top"
                                  className="max-w-xs text-xs space-y-2 p-3 bg-slate-900 text-white border-slate-800 shadow-xl"
                                >
                                  <p>
                                    O botão <strong>Ajustar</strong> fica ativo apenas durante o
                                    período de <strong>Fechamento da Folha</strong> deste mês.
                                  </p>
                                  {!isPeriodoFuturo && !isFechamentoFechado && (
                                    <button
                                      type="button"
                                      onClick={handleAbrirFechamentoRapido}
                                      className="text-amber-300 hover:underline font-semibold block text-[11px] text-left pt-1 border-t border-slate-700"
                                    >
                                      → Abrir Fechamento do Mês agora
                                    </button>
                                  )}
                                  {isFechamentoFechado && (
                                    <p className="text-amber-200 text-[11px]">
                                      A folha deste mês está encerrada. Administradores podem
                                      reabrir no topo da página.
                                    </p>
                                  )}
                                  {isPeriodoFuturo && (
                                    <p className="text-amber-200 text-[11px]">
                                      Meses futuros não podem ser abertos para fechamento.
                                    </p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
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

      {/* Modal Fechamento da Folha */}
      <Dialog open={fechamentoModalOpen} onOpenChange={setFechamentoModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#2563EB] flex items-center justify-center mb-1">
              <Lock className="w-5 h-5" />
            </div>
            <DialogTitle>Fechamento Mensal da Folha de Ponto</DialogTitle>
            <DialogDescription>
              Competência:{' '}
              <strong>
                {MESES[mes - 1]} de {ano}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1 text-xs text-slate-700">
            {acaoFechamento === 'abrir_fechamento' && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <p className="font-semibold text-blue-900">
                  Deseja abrir o período de Fechamento da Folha de {MESES[mes - 1]}/{ano}?
                </p>
                <p className="text-slate-600">
                  Ao abrir o fechamento, os gestores poderão incluir pontos esquecidos pelos
                  colaboradores como registros complementares rastreáveis.
                </p>
              </div>
            )}

            {acaoFechamento === 'encerrar_fechamento' && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-2 text-amber-950">
                <p className="font-semibold text-amber-900">
                  Confirmar Encerramento Definitivo da Folha de {MESES[mes - 1]}/{ano}?
                </p>
                <p>
                  Após o encerramento, a competência fica <strong>travada para edições</strong> e
                  nenhuma inclusão ou alteração de ponto poderá ser realizada.
                </p>
              </div>
            )}

            {acaoFechamento === 'reabrir_fechamento' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2 text-red-950">
                <p className="font-semibold text-red-900">
                  Reabertura Administrativa de Competência Fechada
                </p>
                <p>
                  Esta ação é restrita a administradores e registrará log de auditoria sensível.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="obsFechamentoInput" className="text-xs font-semibold">
                Observações do Fechamento (opcional)
              </Label>
              <Input
                id="obsFechamentoInput"
                placeholder="Ex: Folha conferida e validada pelo gestor"
                value={obsFechamento}
                onChange={(e) => setObsFechamento(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={processandoFechamento}
              onClick={() => setFechamentoModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={processandoFechamento}
              onClick={handleGerenciarFechamento}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
            >
              {processandoFechamento ? 'Processando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Ajuste de Ponto (Inclusão ou Anulação) no Fechamento */}
      <Dialog open={ajustePontoModalOpen} onOpenChange={setAjustePontoModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-1">
              <Clock className="w-5 h-5" />
            </div>
            <DialogTitle>Ajustar Marcações de Ponto (Fechamento)</DialogTitle>
            <DialogDescription>
              Colaborador: <strong>{funcionarioAtual?.nome}</strong> — Data:{' '}
              <strong>{ajusteDia ? formatBRDate(ajusteDia.data) : ''}</strong>. Os registros
              originais permanecem imutáveis. Correções são feitas via registros complementares
              auditados (AJ).
            </DialogDescription>
          </DialogHeader>

          {/* Alternador de Ação: Incluir Batida Faltante vs Anular Marcação Errada */}
          <div className="flex border border-slate-200 rounded-lg p-1 bg-slate-50 gap-1 text-xs">
            <button
              type="button"
              onClick={() => setAjusteModo('incluir')}
              className={`flex-1 py-1.5 px-3 rounded-md font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                ajusteModo === 'incluir'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Incluir Batida Esquecida
            </button>
            <button
              type="button"
              onClick={() => {
                setAjusteModo('anular')
                // Se houver marcações originais, pré-seleciona a primeira que não estiver já anulada
                if (ajusteDia && ajusteDia.marcacoesOriginais.length > 0) {
                  const jaAnuladas = new Set(
                    ajusteDia.todasMarcacoes.filter((m) => m.anulado).map((m) => m.id),
                  )
                  const primeiraValida = ajusteDia.marcacoesOriginais.find(
                    (r) => !jaAnuladas.has(r.id),
                  )
                  if (primeiraValida) {
                    setRegistroParaAnular(primeiraValida.id)
                  }
                }
              }}
              className={`flex-1 py-1.5 px-3 rounded-md font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                ajusteModo === 'anular'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Ban className="w-3.5 h-3.5" />
              Anular Marcação Errada
            </button>
          </div>

          <form onSubmit={handleSalvarAjustePonto} className="space-y-4 pt-1">
            {ajusteModo === 'incluir' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Tipo da Marcação</Label>
                    <Select
                      value={ajusteTipoMarcacao}
                      onValueChange={(val: any) => setAjusteTipoMarcacao(val)}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entrada">Entrada</SelectItem>
                        <SelectItem value="inicio_intervalo">Início Intervalo</SelectItem>
                        <SelectItem value="retorno_intervalo">Retorno Intervalo</SelectItem>
                        <SelectItem value="saida">Saída</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ajusteHoraInput" className="text-xs font-semibold">
                      Horário (24h) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="ajusteHoraInput"
                      type="time"
                      required
                      value={ajusteHora}
                      onChange={(e) => setAjusteHora(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ajusteMotivoInput" className="text-xs font-semibold">
                    Motivo / Justificativa do Esquecimento <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="ajusteMotivoInput"
                    required
                    placeholder="Ex: Colaborador esqueceu de registrar o retorno do intervalo"
                    value={ajusteMotivo}
                    onChange={(e) => setAjusteMotivo(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Selecione a marcação original a anular <span className="text-red-500">*</span>
                  </Label>
                  {ajusteDia && ajusteDia.marcacoesOriginais.length > 0 ? (
                    <Select
                      value={registroParaAnular}
                      onValueChange={(val) => setRegistroParaAnular(val)}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Selecione o registro..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ajusteDia.marcacoesOriginais.map((reg) => {
                          const horaFormatada = reg.timestamp_utc
                            ? new Intl.DateTimeFormat('pt-BR', {
                                timeZone: 'America/Sao_Paulo',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false,
                              }).format(new Date(reg.timestamp_utc))
                            : reg.hora_utc
                          const jaAnulado = ajusteDia.todasMarcacoes.some(
                            (m) => m.id === reg.id && m.anulado,
                          )
                          return (
                            <SelectItem
                              key={reg.id}
                              value={reg.id}
                              disabled={jaAnulado}
                              className="font-mono text-xs"
                            >
                              Batida às {horaFormatada} {jaAnulado ? '(Já Anulada)' : '(Terminal)'}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-slate-500 italic p-2 bg-slate-50 rounded border">
                      Não há marcações originais do terminal para anular nesta data.
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500">
                    O registro original do terminal NUNCA é excluído. Ele é anulado por um registro
                    complementar e deixará de contar nas horas do espelho.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="anulacaoMotivoInput" className="text-xs font-semibold">
                    Motivo da Anulação <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="anulacaoMotivoInput"
                    required
                    placeholder="Ex: Batida duplicada em duplicidade ou marcação acidental"
                    value={ajusteMotivo}
                    onChange={(e) => setAjusteMotivo(e.target.value)}
                  />
                </div>
              </>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={salvandoAjuste}
                onClick={() => setAjustePontoModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  salvandoAjuste ||
                  !ajusteMotivo.trim() ||
                  (ajusteModo === 'anular' && !registroParaAnular)
                }
                className={
                  ajusteModo === 'anular'
                    ? 'bg-rose-700 hover:bg-rose-800 text-white'
                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                }
              >
                {salvandoAjuste
                  ? 'Processando...'
                  : ajusteModo === 'anular'
                    ? 'Confirmar Anulação'
                    : 'Salvar Marcação Complementar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Atestado Médico */}
      <Dialog open={atestadoModalOpen} onOpenChange={setAtestadoModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-1">
              <Paperclip className="w-5 h-5" />
            </div>
            <DialogTitle>Anexar Atestado Médico</DialogTitle>
            <DialogDescription>
              Vincule o atestado médico do colaborador <strong>{funcionarioAtual?.nome}</strong>{' '}
              para justificar a ausência no dia{' '}
              <strong>{atestadoDia ? formatBRDate(atestadoDia.data) : ''}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarAtestado} className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Data Início</Label>
                <Input
                  disabled
                  value={atestadoDia ? formatBRDate(atestadoDia.data) : ''}
                  className="bg-slate-50 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="atestadoDataFimInput" className="text-xs font-semibold">
                  Data Término (se mais de 1 dia)
                </Label>
                <Input
                  id="atestadoDataFimInput"
                  type="date"
                  value={atestadoDataFim}
                  onChange={(e) => setAtestadoDataFim(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="atestadoArquivoInput" className="text-xs font-semibold">
                Arquivo do Atestado (PDF ou Foto JPG/PNG) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="atestadoArquivoInput"
                type="file"
                required
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  setAtestadoArquivo(file)
                }}
                className="text-xs"
              />
              <p className="text-[11px] text-slate-500">
                Armazenamento seguro restrito ao RH (sem acesso público).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="atestadoObsInput" className="text-xs font-semibold">
                Observações / CID (opcional)
              </Label>
              <Input
                id="atestadoObsInput"
                placeholder="Ex: Consulta médica comprovada / 1 dia de repouso"
                value={atestadoMotivo}
                onChange={(e) => setAtestadoMotivo(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={salvandoAtestado}
                onClick={() => setAtestadoModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoAtestado || !atestadoArquivo}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {salvandoAtestado ? 'Enviando...' : 'Gravar Atestado'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
