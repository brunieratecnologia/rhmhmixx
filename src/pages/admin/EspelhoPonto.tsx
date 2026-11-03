import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import {
  funcionariosService,
  fechamentoFolhaService,
  atestadosService,
  espelhoPontoService,
  feriadosService,
  empresaService,
} from '@/services/rh'
import type { Funcionario, FechamentoFolha, Feriado, Empresa } from '@/types/rh'
import {
  construirEspelhoMensal,
  DiaEspelhoCalculado,
  ResumoEspelhoMensal,
  minutesToHoursText,
  getSPTimeFromUtc,
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

interface FolhaFuncionarioLote {
  funcionario: Funcionario
  dias: DiaEspelhoCalculado[]
  resumo: ResumoEspelhoMensal
}

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

  // Estado para impressão em lote (Folhas do mês de todos os funcionários ativos)
  const [modoImpressaoLote, setModoImpressaoLote] = useState(false)
  const [folhasLote, setFolhasLote] = useState<FolhaFuncionarioLote[]>([])
  const [carregandoLote, setCarregandoLote] = useState(false)
  const [empresaInfo, setEmpresaInfo] = useState<Empresa | null>(null)

  // Modais
  // 1. Fechamento de Folha Modal
  const [fechamentoModalOpen, setFechamentoModalOpen] = useState(false)
  const [acaoFechamento, setAcaoFechamento] = useState<
    'abrir_fechamento' | 'encerrar_fechamento' | 'reabrir_fechamento'
  >('abrir_fechamento')
  const [obsFechamento, setObsFechamento] = useState('')
  const [processandoFechamento, setProcessandoFechamento] = useState(false)

  // 2. Inclusão / Ajuste de Ponto Faltante, Anulação ou Correção de Horário
  const [ajustePontoModalOpen, setAjustePontoModalOpen] = useState(false)
  const [ajusteDia, setAjusteDia] = useState<DiaEspelhoCalculado | null>(null)
  const [ajusteModo, setAjusteModo] = useState<'incluir' | 'anular' | 'corrigir'>('incluir')
  const [registroParaAnular, setRegistroParaAnular] = useState<string>('')
  const [registroParaCorrigir, setRegistroParaCorrigir] = useState<string>('')
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
  const [feriadosDoAno, setFeriadosDoAno] = useState<Feriado[]>([])

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
        const res = await funcionariosService.list(1, 500, '', 'nome')
        setFuncionarios(res.items)
        if (!selectedFuncId && res.items.length > 0) {
          // Selecionar preferencialmente o primeiro ativo por padrão
          const primeiroAtivo = res.items.find((f) => f.situacao !== 'desligado')
          setSelectedFuncId(primeiroAtivo ? primeiroAtivo.id : res.items[0].id)
        }
      } catch (err) {
        console.error('Erro ao listar funcionários para o espelho:', err)
      }
    }
    loadFuncs()
  }, [])

  // Separação de funcionários ativos e anteriores para agrupamento no seletor
  const funcionariosAtivos = useMemo(() => {
    return (funcionarios || []).filter((f) => f && f.situacao !== 'desligado')
  }, [funcionarios])

  const funcionariosAnteriores = useMemo(() => {
    return (funcionarios || []).filter((f) => f && f.situacao === 'desligado')
  }, [funcionarios])

  // Carregar dados do espelho quando funcionário ou competência mudar
  const carregarEspelho = async () => {
    if (!selectedFuncId) return
    setLoading(true)
    try {
      const [dados, feriadosList] = await Promise.all([
        espelhoPontoService.getDadosEspelho(selectedFuncId, ano, mes),
        feriadosService.listByAno(ano, true).catch(() => [] as Feriado[]),
      ])
      setFuncionarioAtual(dados.funcionario)
      setFechamento(dados.fechamento)
      setFeriadosDoAno(feriadosList)

      const calculado = construirEspelhoMensal({
        ano,
        mes,
        jornadaAtual: dados.funcionario.expand?.jornada_atual || null,
        historicoJornadas: dados.historicoJornadas,
        registrosMes: dados.registros,
        tratamentosMes: dados.tratamentos,
        ausenciasMes: dados.ausencias,
        feriasMes: dados.ferias,
        feriados: feriadosList,
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

  // Exportar / Imprimir PDF Individual (do funcionário selecionado)
  const handlePrintPDF = () => {
    setModoImpressaoLote(false)
    // Garantir que a renderização saia do modo lote antes de chamar window.print()
    setTimeout(() => {
      window.print()
    }, 50)
  }

  // Imprimir Folhas do Mês em Lote (Todos os funcionários ativos da competência)
  const handleImprimirFolhasMesLote = async () => {
    setCarregandoLote(true)
    try {
      toast({
        title: 'Gerando folhas do mês em lote...',
        description:
          'Compilando os dados e apurações de todos os funcionários ativos para impressão.',
      })

      const [dadosLote, feriadosList, emp] = await Promise.all([
        espelhoPontoService.getDadosEspelhoEmMassa(ano, mes, true),
        feriadosService.listByAno(ano, true).catch(() => [] as Feriado[]),
        empresaService.get().catch(() => null),
      ])

      setEmpresaInfo(emp)

      const compilados: FolhaFuncionarioLote[] = []

      for (const func of dadosLote.funcionarios) {
        const d = dadosLote.dadosPorFuncionario.get(func.id)
        if (!d) continue

        const calc = construirEspelhoMensal({
          ano,
          mes,
          jornadaAtual: func.expand?.jornada_atual || null,
          historicoJornadas: d.historicoJornadas,
          registrosMes: d.registros,
          tratamentosMes: d.tratamentos,
          ausenciasMes: d.ausencias,
          feriasMes: d.ferias,
          feriados: feriadosList,
        })

        compilados.push({
          funcionario: func,
          dias: calc.dias,
          resumo: calc.resumo,
        })
      }

      setFolhasLote(compilados)
      setModoImpressaoLote(true)

      // Dar um tempo para o React montar todos os componentes de impressão antes de disparar o diálogo nativo
      setTimeout(() => {
        window.print()
        setCarregandoLote(false)
      }, 350)
    } catch (err: any) {
      console.error('Erro ao gerar impressão em lote das folhas:', err)
      toast({
        title: 'Erro ao gerar folhas para impressão',
        description: err?.message || 'Falha ao compilar folhas dos colaboradores.',
        variant: 'destructive',
      })
      setCarregandoLote(false)
      setModoImpressaoLote(false)
    }
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

  // Salvar Ajuste / Inclusão de Ponto Faltante, Anulação ou Correção de Marcação
  const handleSalvarAjustePonto = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ajusteDia || !selectedFuncId || !ajusteMotivo.trim()) return

    if (funcionarioAtual?.situacao === 'desligado') {
      toast({
        title: 'Operação não permitida',
        description: 'Não é permitido efetuar novos ajustes de ponto para funcionários desligados.',
        variant: 'destructive',
      })
      return
    }

    if (ajusteModo === 'anular' && !registroParaAnular) {
      toast({
        title: 'Selecione a marcação para anular',
        description: 'É necessário indicar qual marcação original será anulada.',
        variant: 'destructive',
      })
      return
    }

    if (ajusteModo === 'corrigir' && !registroParaCorrigir) {
      toast({
        title: 'Selecione a marcação original para corrigir',
        description: 'É necessário indicar qual batida do terminal teve o horário incorreto.',
        variant: 'destructive',
      })
      return
    }

    setSalvandoAjuste(true)
    try {
      if (ajusteModo === 'corrigir') {
        const res = await fechamentoFolhaService.ajustarPonto({
          funcionario: selectedFuncId,
          data_registro: ajusteDia.data,
          hora_registro: ajusteHora,
          tipo: 'correcao',
          tipo_marcacao: ajusteTipoMarcacao,
          justificativa: ajusteMotivo.trim(),
          registro: registroParaCorrigir,
          acao_tipo: 'corrigir',
        })

        toast({
          title: 'Horário de batida corrigido.',
          description:
            res.message ||
            'A marcação foi corrigida com sucesso. O horário corrigido passa a constar nos cálculos do espelho e o registro original permanece preservado no histórico.',
          className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        })
      } else if (ajusteModo === 'anular') {
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
      setRegistroParaCorrigir('')
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

    if (funcionarioAtual?.situacao === 'desligado') {
      toast({
        title: 'Operação não permitida',
        description: 'Não é permitido anexar atestados para funcionários desligados.',
        variant: 'destructive',
      })
      return
    }

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
            className="text-xs h-9 border-slate-200 text-slate-700 hover:bg-slate-50"
            title="Exportar espelho de ponto do colaborador em CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            CSV
          </Button>

          {/* Imprimir / PDF Individual */}
          <Button
            variant="outline"
            onClick={handlePrintPDF}
            disabled={!funcionarioAtual}
            className="text-xs h-9 border-slate-200 text-slate-700 hover:bg-slate-50"
            title="Imprimir folha de ponto do colaborador selecionado"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Imprimir Folha
          </Button>

          {/* Imprimir Folhas do Mês (Todos os funcionários em lote para assinatura) */}
          <Button
            onClick={handleImprimirFolhasMesLote}
            disabled={carregandoLote || funcionariosAtivos.length === 0}
            className="text-xs h-9 font-semibold bg-[#D4AF37] hover:bg-[#b89528] text-slate-950 shadow-xs border border-[#b89528]"
            title="Imprimir folhas de ponto de todos os funcionários ativos da competência para assinatura"
          >
            {carregandoLote ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin mr-1.5" />
                Gerando Folhas...
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5 mr-1.5 text-slate-950" />
                Imprimir Folhas do Mês
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filter / Selector Bar */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 items-center print:hidden">
        {/* Funcionário Selector */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-slate-600">Funcionário</Label>
            {funcionarioAtual?.situacao === 'desligado' && (
              <Badge
                variant="outline"
                className="text-[10px] bg-slate-100 text-slate-700 border-slate-300"
              >
                Desligado (Somente Consulta)
              </Badge>
            )}
          </div>
          <Select value={selectedFuncId} onValueChange={setSelectedFuncId}>
            <SelectTrigger className="text-xs h-9">
              <SelectValue placeholder="Selecione o funcionário" />
            </SelectTrigger>
            <SelectContent>
              {/* Grupo Ativos (padrão) */}
              <div className="px-2 py-1 text-[11px] font-bold text-slate-500 uppercase bg-slate-50">
                Funcionários Ativos ({funcionariosAtivos.length})
              </div>
              {funcionariosAtivos.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.nome} ({f.matricula})
                </SelectItem>
              ))}

              {/* Grupo Histórico / Anteriores para Consulta */}
              {funcionariosAnteriores.length > 0 && (
                <>
                  <div className="px-2 py-1 text-[11px] font-bold text-slate-500 uppercase bg-slate-100 border-t border-slate-200 mt-1">
                    Anteriores / Desligados (Histórico)
                  </div>
                  {funcionariosAnteriores.map((f) => (
                    <SelectItem key={f.id} value={f.id} className="text-slate-600">
                      {f.nome} ({f.matricula}) — Desligado
                    </SelectItem>
                  ))}
                </>
              )}
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
      {isFechamentoFechado ? (
        <div className="p-3.5 bg-slate-100 border border-slate-300 rounded-xl text-xs text-slate-800 flex items-start gap-3 print:hidden">
          <Lock className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
          <p>
            <strong>Competência Encerrada:</strong> A folha deste mês foi finalizada e está travada
            para edições. Caso seja necessário realizar algum ajuste complementar, utilize o botão{' '}
            <em>"Reabrir Fechamento (Admin)"</em> no topo.
          </p>
        </div>
      ) : isFechamentoAberto ? (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-start gap-3 print:hidden">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p>
            <strong>Período de Fechamento Aberto:</strong> Você pode incluir marcações faltantes ou
            anular batidas incorretas diretamente no botão <em>"Ajustar"</em> de cada dia. As
            alterações geram registros complementares auditados (AJ) mantendo os originais intactos.
            Ao concluir a conferência, clique em <em>"Encerrar Fechamento da Folha"</em>.
          </p>
        </div>
      ) : (
        <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-3 print:hidden">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <p>
            <strong>Ajustes Liberados a Qualquer Momento:</strong> O gestor pode registrar marcações
            esquecidas ou anular batidas incorretas imediatamente no botão <em>"Ajustar"</em> de
            cada dia. Os registros originais do terminal permanecem 100% imutáveis e cada inclusão é
            auditada via registro complementar (AJ).
          </p>
        </div>
      )}

      {/* Cabeçalho de Impressão Individual (Visível apenas em impressão/PDF quando NÃO estiver em modo lote) */}
      {!modoImpressaoLote && (
        <div className="hidden print:block border-b-2 border-black pb-3 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-black text-black tracking-tight uppercase">
                {empresaInfo?.razao_social ||
                  empresaInfo?.nome_fantasia ||
                  'MH MIXX AÇAÍ E FRUTAS CONGELADAS'}
              </h1>
              <p className="text-xs text-black font-semibold">
                FOLHA DE PONTO / ESPELHO MENSAL — {MESES[mes - 1].toUpperCase()} / {ano}
              </p>
              {empresaInfo?.cnpj && (
                <p className="text-[10px] text-black">CNPJ: {empresaInfo.cnpj}</p>
              )}
            </div>
            <div className="text-right text-xs text-black">
              <p className="font-bold text-sm">{funcionarioAtual?.nome}</p>
              <p>
                Matrícula: <strong className="font-mono">{funcionarioAtual?.matricula}</strong>
              </p>
              <p>Cargo: {funcionarioAtual?.expand?.cargo?.nome || 'Não definido'}</p>
              <p>Departamento: {funcionarioAtual?.expand?.departamento?.nome || 'Geral'}</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-dashed border-slate-400 flex items-center justify-between text-[10px] text-black">
            <span>
              <strong>Jornada Contratada:</strong>{' '}
              {funcionarioAtual?.expand?.jornada_atual?.nome || 'Jornada Padrão'} (
              {funcionarioAtual?.expand?.jornada_atual?.hora_entrada || '08:00'} às{' '}
              {funcionarioAtual?.expand?.jornada_atual?.hora_saida || '18:00'})
            </span>
            <span>
              Emissão:{' '}
              {new Intl.DateTimeFormat('pt-BR', {
                timeZone: 'America/Sao_Paulo',
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(new Date())}
            </span>
          </div>
        </div>
      )}

      {/* Summary Cards (Ocultos na impressão em lote pois cada folha impressa tem seus próprios totais) */}
      {resumo && !modoImpressaoLote && (
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

      {/* Main Table: Espelho de Ponto Diário (Oculta na impressão quando em modo lote) */}
      <div
        className={`bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden ${modoImpressaoLote ? 'print:hidden' : ''}`}
      >
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
            <table className="w-full text-left text-xs table-auto">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold text-[11px]">
                  <th className="py-2 px-2 w-[72px] whitespace-nowrap">Data</th>
                  <th className="py-2 px-2 w-[90px]">Previsto</th>
                  <th className="py-2 px-2 min-w-[190px]">
                    Marcações Realizadas (Entrada / Intervalos / Saída)
                  </th>
                  <th className="py-2 px-2 w-[65px] text-right whitespace-nowrap">Realizado</th>
                  <th className="py-2 px-2 w-[75px] text-right whitespace-nowrap">Banco Horas</th>
                  <th className="py-2 px-2 w-[65px] text-right whitespace-nowrap">Diferença</th>
                  <th className="py-2 px-2 min-w-[150px]">Ocorrências e Atestados</th>
                  <th className="py-2 px-2 w-[150px] min-w-[145px] text-right print:hidden whitespace-nowrap">
                    Ações
                  </th>
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
                        dia.ehFeriado
                          ? 'bg-amber-50/30'
                          : dia.ehDiaFolga
                            ? 'bg-slate-50/40 text-slate-500'
                            : ''
                      } ${temIncompleto ? 'bg-amber-50/20' : ''}`}
                    >
                      {/* Data e Dia da Semana */}
                      <td className="py-2 px-2 whitespace-nowrap">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="font-mono font-bold text-slate-800 text-xs">
                            {formatBRDate(dia.data).slice(0, 5)}
                          </span>
                          <span
                            className={`text-[9px] font-semibold uppercase px-1 py-0.2 rounded ${
                              dia.ehFeriado
                                ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                                : isFimDeSemana
                                  ? 'bg-slate-200 text-slate-700'
                                  : 'bg-blue-50 text-[#2563EB]'
                            }`}
                          >
                            {dia.diaSemana}
                          </span>
                          {dia.ehFeriado && (
                            <span
                              className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.2 rounded bg-[#D4AF37]/15 text-[#996515] border border-[#D4AF37]/40 shadow-xs"
                              title={dia.feriadoDescricao || 'Feriado'}
                            >
                              Feriado
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Jornada Prevista */}
                      <td className="py-2 px-2 font-mono">
                        {dia.ehFeriado ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-amber-900 text-[11px] flex items-center gap-1">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                              {dia.previstoFormatado}
                            </span>
                            <span className="text-[9px] text-amber-700 font-sans tracking-tight leading-tight">
                              Sem obrigação
                            </span>
                          </div>
                        ) : dia.ehDiaFolga ? (
                          <span className="text-slate-400 italic text-[11px]">Folga</span>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-800 text-[11px] whitespace-nowrap">
                              {dia.previstoFormatado}
                            </span>
                            {dia.cargaPrevistaFormatada && (
                              <span className="text-[9px] text-slate-500 font-sans tracking-tight">
                                {dia.cargaPrevistaFormatada}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Batidas Realizadas */}
                      <td className="py-2 px-2">
                        {dia.todasMarcacoes.length === 0 ? (
                          <span className="text-slate-300 italic text-[11px]">Sem batidas</span>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 flex-wrap font-mono">
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
                                        : m.corrigida
                                          ? `Marcação Corrigida: ${m.horarioOriginal ? `${m.horarioOriginal} → ` : ''}${m.horario}${m.motivoCorrecao ? ` (Motivo: ${m.motivoCorrecao})` : ''}`
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
                                    className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-0.5 ${
                                      ehAnulado
                                        ? 'bg-red-50 text-red-700/80 border-red-200 line-through opacity-75'
                                        : m.corrigida
                                          ? 'bg-amber-100 text-amber-950 border-amber-400 shadow-xs'
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
                                        className="text-[8px] bg-purple-200 text-purple-950 font-bold px-0.5 rounded uppercase tracking-wider"
                                        title="Intervalo automático da jornada"
                                      >
                                        Auto
                                      </span>
                                    )}
                                    {m.corrigida && !ehAnulado && (
                                      <span
                                        className="text-[8px] bg-amber-300 text-amber-950 px-0.5 rounded font-bold uppercase tracking-wider"
                                        title={
                                          m.horarioOriginal
                                            ? `Horário corrigido de ${m.horarioOriginal} para ${m.horario}${m.motivoCorrecao ? ` (${m.motivoCorrecao})` : ''}`
                                            : `Marcação corrigida pelo gestor${m.motivoCorrecao ? `: ${m.motivoCorrecao}` : ''}`
                                        }
                                      >
                                        CORR
                                      </span>
                                    )}
                                    {ehAjuste && !ehAnulado && !m.corrigida && (
                                      <span
                                        className="text-[8px] bg-amber-200 text-amber-900 px-0.5 rounded font-bold"
                                        title="Incluído pelo gestor no fechamento"
                                      >
                                        AJ
                                      </span>
                                    )}
                                    {ehOffline && !ehAnulado && (
                                      <span
                                        className="text-[8px] bg-amber-200 text-amber-950 px-0.5 rounded font-bold uppercase tracking-wider"
                                        title="Registrado offline e sincronizado automaticamente"
                                      >
                                        Off
                                      </span>
                                    )}
                                    {ehAnulado && (
                                      <span
                                        className="text-[8px] bg-red-200 text-red-900 px-0.5 rounded font-bold"
                                        title={m.motivoAnulacao || 'Marcação anulada'}
                                      >
                                        ANUL
                                      </span>
                                    )}
                                  </span>
                                )
                              })}
                            </div>

                            {/* Indicador auditável de intervalo automático */}
                            {dia.intervaloAutomaticoAplicado && dia.intervaloInfo && (
                              <div className="flex items-center gap-1 text-[9px] text-purple-700 font-medium leading-tight">
                                <span className="inline-block w-1 h-1 rounded-full bg-purple-600 shrink-0" />
                                <span>
                                  Auto:{' '}
                                  <strong className="font-mono text-purple-900">
                                    {dia.intervaloInfo.inicio}-{dia.intervaloInfo.retorno}
                                  </strong>{' '}
                                  (-{dia.intervaloInfo.duracaoMinutos}m)
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Horas Trabalhadas */}
                      <td className="py-2 px-2 text-right font-mono font-semibold text-slate-800 text-[11px] whitespace-nowrap">
                        {dia.realizadoFormatado !== '00:00' ? dia.realizadoFormatado : '--'}
                      </td>

                      {/* Banco de Horas (Crédito pós-saída prevista e antecipação >= 30min) */}
                      <td className="py-2 px-2 text-right font-mono whitespace-nowrap">
                        {dia.horasBancoCreditoMinutos > 0 ? (
                          <div className="inline-flex flex-col items-end gap-0.5">
                            <span
                              className="font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 text-[10px]"
                              title={
                                dia.ehDiaFolga || dia.ehFeriado
                                  ? 'Trabalho em folga/feriado -> Crédito integral Banco de Horas'
                                  : [
                                      dia.horasBancoCreditoPosSaidaMinutos
                                        ? `Pós-saída: +${dia.horasBancoCreditoPosSaidaMinutos}m`
                                        : null,
                                      dia.horasBancoCreditoAntecipacaoMinutos
                                        ? `Antecipação ≥30m: +${dia.horasBancoCreditoAntecipacaoMinutos}m`
                                        : null,
                                    ]
                                      .filter(Boolean)
                                      .join(' | ') || 'Crédito de Banco de Horas'
                              }
                            >
                              {dia.horasBancoCreditoFormatado}
                            </span>
                            {dia.horasBancoCreditoAntecipacaoMinutos &&
                              dia.horasBancoCreditoAntecipacaoMinutos > 0 && (
                                <span className="text-[8px] font-sans font-medium text-teal-700 bg-teal-50 px-0.5 rounded border border-teal-200 leading-none">
                                  antec.≥30m
                                </span>
                              )}
                          </div>
                        ) : (
                          <span className="text-slate-300">--</span>
                        )}
                      </td>

                      {/* Diferença */}
                      <td className="py-2 px-2 text-right font-mono font-semibold text-[11px] whitespace-nowrap">
                        {dia.diferencaMinutos > 0 ? (
                          <span className="text-emerald-600">+{dia.diferencaFormatada}</span>
                        ) : dia.diferencaMinutos < 0 && !dia.ehDiaFolga ? (
                          <span className="text-slate-500">{dia.diferencaFormatada}</span>
                        ) : (
                          <span className="text-slate-300">00:00</span>
                        )}
                      </td>

                      {/* Ocorrências e Atestados */}
                      <td className="py-2 px-2">
                        {dia.ocorrencias.length === 0 ? (
                          <span className="text-slate-300 text-[11px]">—</span>
                        ) : (
                          <div className="space-y-0.5">
                            {dia.ocorrencias.map((o, idx) => {
                              const ehAtestado = o.tipo === 'atestado'
                              const ehIncompleto = o.tipo === 'marcacao_incompleta'
                              return (
                                <div
                                  key={idx}
                                  className="flex items-start gap-1 flex-wrap break-words"
                                >
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium inline-flex items-center gap-1 max-w-full text-left leading-tight ${
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
                                      <Paperclip className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                                    )}
                                    {ehIncompleto && (
                                      <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                    )}
                                    <span className="break-words">{o.descricao}</span>
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
                                      className="text-[10px] text-[#2563EB] hover:underline font-semibold inline-flex items-center gap-0.5 shrink-0"
                                    >
                                      Anexo ↗
                                    </a>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </td>

                      {/* Ações (Atestado / Inclusão de Ponto no Fechamento) */}
                      <td className="py-2 px-2 text-right print:hidden whitespace-nowrap">
                        {funcionarioAtual?.situacao === 'desligado' ? (
                          <span className="text-[10px] text-slate-400 italic">Somente Leitura</span>
                        ) : (
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
                              className="h-6 px-1.5 text-[10px] border-slate-200 text-purple-700 hover:bg-purple-50 shrink-0"
                            >
                              <Paperclip className="w-2.5 h-2.5 mr-0.5" />
                              Atestado
                            </Button>

                            {/* Ajustar / Incluir Ponto */}
                            {!isFechamentoFechado && !isPeriodoFuturo ? (
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
                                  setRegistroParaCorrigir('')
                                  setAjustePontoModalOpen(true)
                                }}
                                className="h-6 px-1.5 text-[10px] border-amber-300 text-amber-900 bg-amber-50/80 hover:bg-amber-100 font-semibold shrink-0"
                              >
                                <PlusCircle className="w-2.5 h-2.5 mr-0.5 text-[#D4AF37]" />
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
                                        className="h-6 px-1.5 text-[10px] border-slate-200 text-slate-400 opacity-60 cursor-not-allowed shrink-0"
                                      >
                                        <PlusCircle className="w-2.5 h-2.5 mr-0.5" />
                                        Ajustar
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="top"
                                    className="max-w-xs text-xs space-y-2 p-3 bg-slate-900 text-white border-slate-800 shadow-xl"
                                  >
                                    {isFechamentoFechado ? (
                                      <p>
                                        A folha desta competência foi <strong>encerrada</strong>.
                                        Reabra o fechamento no topo da página para permitir novos
                                        ajustes.
                                      </p>
                                    ) : (
                                      <p>
                                        Não é possível realizar ajustes em competências futuras.
                                      </p>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Rodapé e Linhas de Assinatura para Impressão Individual (Aparece apenas na impressão quando NÃO estiver em modo lote) */}
        {!modoImpressaoLote && (
          <div className="hidden print:block p-4 border-t-2 border-black mt-4 avoid-break-inside text-black text-xs">
            <div className="grid grid-cols-2 gap-4 mb-3 pb-3 border-b border-slate-300">
              <div>
                <p className="font-bold text-[11px] uppercase tracking-wider mb-1">
                  Resumo da Competência
                </p>
                <p>
                  Dias Trabalhados: <strong>{resumo?.totalDiasTrabalhados || 0}</strong> de{' '}
                  {resumo?.totalDiasNoMes || 0} dias
                </p>
                <p>
                  Carga Prevista:{' '}
                  <strong>{resumo ? minutesToHoursText(resumo.previstoTotalMinutos) : '0h'}</strong>
                </p>
                <p>
                  Horas Trabalhadas:{' '}
                  <strong>
                    {resumo ? minutesToHoursText(resumo.realizadoTotalMinutos) : '0h'}
                  </strong>
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-[11px] uppercase tracking-wider mb-1">
                  Apuração de Banco de Horas
                </p>
                <p>
                  Crédito do Mês (após saída / antecipações):{' '}
                  <strong>
                    +{resumo ? minutesToHoursText(resumo.totalBancoCreditoMinutos) : '0h'}
                  </strong>
                </p>
                <p>
                  Saldo Líquido da Competência:{' '}
                  <strong className="font-mono">
                    {resumo && resumo.saldoTotalMinutos >= 0 ? '+' : ''}
                    {resumo ? minutesToHoursText(resumo.saldoTotalMinutos) : '0h'}
                  </strong>
                </p>
                <p className="text-[10px] text-slate-600">
                  Total de ocorrências: {resumo?.totalOcorrencias || 0} ({resumo?.totalAtrasos || 0}{' '}
                  atrasos)
                </p>
              </div>
            </div>

            <p className="text-[10px] text-justify text-slate-700 leading-tight mb-8">
              Reconheço a exatidão das marcações de ponto, horas trabalhadas, ocorrências e saldo do
              banco de horas registrados neste espelho mensal, em cumprimento às normas trabalhistas
              vigentes (CLT e Portaria MTP nº 671/2021).
            </p>

            {/* Linhas de Assinatura */}
            <div className="grid grid-cols-2 gap-12 pt-6">
              <div className="text-center">
                <div className="border-t border-black w-4/5 mx-auto mb-1.5" />
                <p className="font-bold text-xs uppercase">{funcionarioAtual?.nome}</p>
                <p className="text-[10px] text-slate-600">
                  Assinatura do Colaborador — Matrícula: {funcionarioAtual?.matricula}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">Data: ____/____/________</p>
              </div>
              <div className="text-center">
                <div className="border-t border-black w-4/5 mx-auto mb-1.5" />
                <p className="font-bold text-xs uppercase">
                  {empresaInfo?.razao_social ||
                    empresaInfo?.nome_fantasia ||
                    'MH MIXX AÇAÍ E FRUTAS CONGELADAS'}
                </p>
                <p className="text-[10px] text-slate-600">Responsável Recursos Humanos / Gestão</p>
                <p className="text-[10px] text-slate-500 mt-1">Data: ____/____/________</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DOCUMENTO DE IMPRESSÃO EM LOTE (Todas as folhas de ponto do mês — 1 por página por funcionário ativo) */}
      {modoImpressaoLote && folhasLote.length > 0 && (
        <div className="hidden print:block w-full">
          {folhasLote.map((item, idx) => {
            const func = item.funcionario
            const dias = item.dias
            const res = item.resumo
            const isLast = idx === folhasLote.length - 1

            return (
              <div
                key={func.id}
                className={`bg-white text-black p-0 w-full ${!isLast ? 'page-break-after' : ''}`}
                style={{
                  breakAfter: isLast ? 'auto' : 'page',
                  pageBreakAfter: isLast ? 'auto' : 'always',
                }}
              >
                {/* Cabeçalho da Folha de Ponto */}
                <div className="border-b-2 border-black pb-2 mb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="text-base font-black tracking-tight uppercase">
                        {empresaInfo?.razao_social ||
                          empresaInfo?.nome_fantasia ||
                          'MH MIXX AÇAÍ E FRUTAS CONGELADAS'}
                      </h1>
                      <p className="text-xs font-bold">
                        FOLHA DE PONTO / ESPELHO MENSAL — {MESES[mes - 1].toUpperCase()} / {ano}
                      </p>
                      {empresaInfo?.cnpj && (
                        <p className="text-[9px] text-slate-700">CNPJ: {empresaInfo.cnpj}</p>
                      )}
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-bold text-sm leading-tight">{func.nome}</p>
                      <p className="text-[11px]">
                        Matrícula: <strong className="font-mono">{func.matricula}</strong>
                      </p>
                      <p className="text-[10px] text-slate-700">
                        Cargo: {func.expand?.cargo?.nome || 'Geral'}
                      </p>
                      <p className="text-[10px] text-slate-700">
                        Depto: {func.expand?.departamento?.nome || 'Geral'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-dashed border-slate-400 flex items-center justify-between text-[9px] text-slate-700">
                    <span>
                      <strong>Jornada Contratada:</strong>{' '}
                      {func.expand?.jornada_atual?.nome || 'Padrão'} (
                      {func.expand?.jornada_atual?.hora_entrada || '08:00'} às{' '}
                      {func.expand?.jornada_atual?.hora_saida || '18:00'})
                    </span>
                    <span>
                      Emissão:{' '}
                      {new Intl.DateTimeFormat('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(new Date())}
                    </span>
                  </div>
                </div>

                {/* Tabela Diária */}
                <table className="w-full text-left text-[10px] border-collapse mb-3">
                  <thead>
                    <tr className="border-b-2 border-black bg-slate-100 font-bold text-[9px] uppercase">
                      <th className="py-1 px-1 w-[45px]">Data</th>
                      <th className="py-1 px-1 w-[32px]">Dia</th>
                      <th className="py-1 px-1 w-[85px]">Previsto</th>
                      <th className="py-1 px-1">Marcações Realizadas</th>
                      <th className="py-1 px-1 w-[55px] text-right">Realizado</th>
                      <th className="py-1 px-1 w-[60px] text-right">Banco Horas</th>
                      <th className="py-1 px-1 w-[55px] text-right">Diferença</th>
                      <th className="py-1 px-1 w-[160px]">Ocorrências</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {dias.map((d) => {
                      const batidasStr = d.todasMarcacoes
                        .map((m) => {
                          const tag = m.anulado
                            ? '[ANULADA]'
                            : m.corrigida
                              ? '[CORR]'
                              : m.origem === 'tratamento_fechamento'
                                ? '[AJ]'
                                : m.origem === 'intervalo_automatico'
                                  ? '[AUTO]'
                                  : ''
                          return `${m.horario}${tag ? ` ${tag}` : ''}`
                        })
                        .join('  ')

                      const ocorrenciasStr = [
                        ...(d.ehFeriado ? [`Feriado: ${d.feriadoDescricao || 'Feriado'}`] : []),
                        ...d.ocorrencias.map((o) => o.descricao),
                      ].join('; ')

                      return (
                        <tr key={d.data} className="leading-tight">
                          <td className="py-0.5 px-1 font-mono font-semibold">
                            {formatBRDate(d.data).slice(0, 5)}
                          </td>
                          <td className="py-0.5 px-1 uppercase font-semibold text-[9px]">
                            {d.diaSemana}
                          </td>
                          <td className="py-0.5 px-1 font-mono text-[9px]">
                            {d.ehFeriado ? (
                              <span className="italic">Feriado</span>
                            ) : d.ehDiaFolga ? (
                              <span className="italic text-slate-500">Folga</span>
                            ) : (
                              d.previstoFormatado
                            )}
                          </td>
                          <td className="py-0.5 px-1 font-mono text-[9px]">
                            {batidasStr || <span className="text-slate-400 italic">--</span>}
                          </td>
                          <td className="py-0.5 px-1 text-right font-mono font-semibold">
                            {d.realizadoFormatado !== '00:00' ? d.realizadoFormatado : '--'}
                          </td>
                          <td className="py-0.5 px-1 text-right font-mono">
                            {d.horasBancoCreditoMinutos > 0 ? (
                              `+${d.horasBancoCreditoFormatado}`
                            ) : (
                              <span className="text-slate-400">--</span>
                            )}
                          </td>
                          <td className="py-0.5 px-1 text-right font-mono font-semibold">
                            {d.diferencaMinutos > 0
                              ? `+${d.diferencaFormatada}`
                              : d.diferencaMinutos < 0 && !d.ehDiaFolga
                                ? d.diferencaFormatada
                                : '00:00'}
                          </td>
                          <td className="py-0.5 px-1 text-[9px] text-slate-700 truncate max-w-[160px]">
                            {ocorrenciasStr || <span className="text-slate-300">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Resumo dos Totais e Saldo do Banco de Horas */}
                <div className="border border-slate-300 rounded p-2 mb-3 text-[10px] bg-slate-50/50 avoid-break-inside">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-bold uppercase tracking-wider block text-[9px] text-slate-600 mb-0.5">
                        Totais da Competência
                      </span>
                      <p>
                        Dias Trabalhados: <strong>{res.totalDiasTrabalhados}</strong> /{' '}
                        {res.totalDiasNoMes} dias
                      </p>
                      <p>
                        Carga Prevista:{' '}
                        <strong>{minutesToHoursText(res.previstoTotalMinutos)}</strong>
                      </p>
                      <p>
                        Horas Trabalhadas:{' '}
                        <strong>{minutesToHoursText(res.realizadoTotalMinutos)}</strong>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold uppercase tracking-wider block text-[9px] text-slate-600 mb-0.5">
                        Apuração e Saldo do Banco de Horas
                      </span>
                      <p>
                        Crédito do Mês (Pós-saída / Antecipações):{' '}
                        <strong>+{minutesToHoursText(res.totalBancoCreditoMinutos)}</strong>
                      </p>
                      <p className="text-xs">
                        Saldo Líquido do Mês (Faltantes / Sobras):{' '}
                        <strong className="font-mono font-bold">
                          {res.saldoTotalMinutos >= 0 ? '+' : ''}
                          {minutesToHoursText(res.saldoTotalMinutos)}
                        </strong>
                      </p>
                      <p className="text-[9px] text-slate-600">
                        Ocorrências: {res.totalOcorrencias} ({res.totalAtrasos} atrasos)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Termo de Reconhecimento e Assinaturas */}
                <div className="avoid-break-inside pt-1">
                  <p className="text-[9px] text-justify text-slate-700 leading-tight mb-6">
                    Reconheço a exatidão das marcações de ponto, horas trabalhadas, ocorrências e
                    saldo do banco de horas registrados nesta folha de ponto mensal, em estrito
                    cumprimento às normas da CLT e da Portaria MTP nº 671/2021.
                  </p>

                  <div className="grid grid-cols-2 gap-10 pt-4">
                    <div className="text-center">
                      <div className="border-t border-black w-4/5 mx-auto mb-1" />
                      <p className="font-bold text-[10px] uppercase">{func.nome}</p>
                      <p className="text-[9px] text-slate-600">
                        Assinatura do Colaborador — Matrícula: {func.matricula}
                      </p>
                      <p className="text-[9px] text-slate-500 mt-0.5">Data: ____/____/________</p>
                    </div>
                    <div className="text-center">
                      <div className="border-t border-black w-4/5 mx-auto mb-1" />
                      <p className="font-bold text-[10px] uppercase">
                        {empresaInfo?.razao_social ||
                          empresaInfo?.nome_fantasia ||
                          'MH MIXX AÇAÍ E FRUTAS CONGELADAS'}
                      </p>
                      <p className="text-[9px] text-slate-600">
                        Responsável Recursos Humanos / Gestão
                      </p>
                      <p className="text-[9px] text-slate-500 mt-0.5">Data: ____/____/________</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

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

      {/* Modal Ajuste de Ponto (Inclusão, Anulação ou Correção) no Fechamento */}
      <Dialog open={ajustePontoModalOpen} onOpenChange={setAjustePontoModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-1">
              <Clock className="w-5 h-5" />
            </div>
            <DialogTitle>Ajustar Marcações de Ponto</DialogTitle>
            <DialogDescription>
              Colaborador: <strong>{funcionarioAtual?.nome}</strong> — Data:{' '}
              <strong>{ajusteDia ? formatBRDate(ajusteDia.data) : ''}</strong>. Os registros
              originais do terminal permanecem 100% imutáveis. Inclusões, anulações e correções são
              feitas via registros complementares auditados (AJ).
            </DialogDescription>
          </DialogHeader>

          {/* Aviso informativo se o dia for feriado */}
          {ajusteDia?.ehFeriado && (
            <div className="p-3 bg-amber-50/90 border border-[#D4AF37]/40 rounded-lg flex items-start gap-2.5 text-xs text-amber-950">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#D4AF37] text-white font-bold shrink-0 text-[10px]">
                ★
              </span>
              <div>
                <p className="font-bold text-amber-900">
                  Este dia é feriado ({ajusteDia.feriadoDescricao || 'Feriado'})
                </p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Não há jornada prevista para este dia. Caso uma marcação de ponto seja incluída ou
                  corrigida, todas as horas trabalhadas serão creditadas integralmente no Banco de
                  Horas.
                </p>
              </div>
            </div>
          )}

          {/* Alternador de Ação: Corrigir Horário vs Incluir Batida vs Anular Marcação */}
          <div className="grid grid-cols-3 border border-slate-200 rounded-lg p-1 bg-slate-50 gap-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setAjusteModo('corrigir')
                if (ajusteDia && ajusteDia.marcacoesOriginais.length > 0) {
                  const jaAnuladas = new Set(
                    ajusteDia.todasMarcacoes.filter((m) => m.anulado).map((m) => m.id),
                  )
                  const primeiraValida = ajusteDia.marcacoesOriginais.find(
                    (r) => !jaAnuladas.has(r.id),
                  )
                  if (primeiraValida) {
                    setRegistroParaCorrigir(primeiraValida.id)
                    const h = primeiraValida.timestamp_utc
                      ? getSPTimeFromUtc(primeiraValida.timestamp_utc)
                      : primeiraValida.hora_utc.slice(0, 5)
                    setAjusteHora(h)
                  }
                }
              }}
              className={`py-1.5 px-2 rounded-md font-semibold transition-colors flex items-center justify-center gap-1 text-center ${
                ajusteModo === 'corrigir'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>Corrigir Horário</span>
            </button>

            <button
              type="button"
              onClick={() => setAjusteModo('incluir')}
              className={`py-1.5 px-2 rounded-md font-semibold transition-colors flex items-center justify-center gap-1 text-center ${
                ajusteModo === 'incluir'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Incluir Batida</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAjusteModo('anular')
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
              className={`py-1.5 px-2 rounded-md font-semibold transition-colors flex items-center justify-center gap-1 text-center ${
                ajusteModo === 'anular'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Ban className="w-3.5 h-3.5 shrink-0" />
              <span>Anular Errada</span>
            </button>
          </div>

          <form onSubmit={handleSalvarAjustePonto} className="space-y-4 pt-1">
            {ajusteModo === 'corrigir' ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Marcação original do terminal a corrigir <span className="text-red-500">*</span>
                  </Label>
                  {ajusteDia && ajusteDia.marcacoesOriginais.length > 0 ? (
                    <Select
                      value={registroParaCorrigir}
                      onValueChange={(val) => {
                        setRegistroParaCorrigir(val)
                        const reg = ajusteDia.marcacoesOriginais.find((r) => r.id === val)
                        if (reg) {
                          const h = reg.timestamp_utc
                            ? getSPTimeFromUtc(reg.timestamp_utc)
                            : reg.hora_utc.slice(0, 5)
                          setAjusteHora(h)
                        }
                      }}
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
                              Batida original às {horaFormatada}{' '}
                              {jaAnulado ? '(Já Anulada)' : '(Terminal)'}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-slate-500 italic p-2 bg-slate-50 rounded border">
                      Não há marcações do terminal registradas nesta data para corrigir. Use
                      "Incluir Batida" caso o colaborador não tenha batido.
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500">
                    O registro original do terminal permanece intacto no banco de dados e visível no
                    espelho como anulado. Um novo registro complementar é gerado com o horário
                    correto.
                  </p>
                </div>

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
                      Horário Correto (24h) <span className="text-red-500">*</span>
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
                    Motivo Obrigatório da Correção <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="ajusteMotivoInput"
                    required
                    placeholder="Ex: Problemas de lentidão no computador ao iniciar o turno"
                    value={ajusteMotivo}
                    onChange={(e) => setAjusteMotivo(e.target.value)}
                  />
                </div>
              </>
            ) : ajusteModo === 'incluir' ? (
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
                  (ajusteModo === 'corrigir' && !registroParaCorrigir) ||
                  (ajusteModo === 'anular' && !registroParaAnular)
                }
                className={
                  ajusteModo === 'corrigir'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : ajusteModo === 'anular'
                      ? 'bg-rose-700 hover:bg-rose-800 text-white'
                      : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white'
                }
              >
                {salvandoAjuste
                  ? 'Processando...'
                  : ajusteModo === 'corrigir'
                    ? 'Confirmar Correção de Horário'
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
