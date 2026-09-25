import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  funcionariosService,
  historicoService,
  historicoJornadasService,
  feriasService,
  ausenciasService,
  documentosService,
} from '@/services/rh'
import type {
  Funcionario,
  HistoricoFuncionario,
  HistoricoJornada,
  Ferias,
  Ausencia,
  Documento,
} from '@/types/rh'
import pb from '@/lib/pocketbase/client'
import { formatBRDate, formatBRCurrency, maskCPF, maskPhone } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  Edit3,
  UserX,
  UserCheck,
  User,
  Briefcase,
  FileCheck2,
  FolderOpen,
  CalendarDays,
  History,
  AlertTriangle,
  Plus,
  ShieldCheck,
  Building2,
  Mail,
  Phone,
  MapPin,
  Clock,
  KeyRound,
  Lock,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { terminalService, jornadasService, bancoHorasService } from '@/services/rh'
import type { Jornada, BancoHorasLancamento } from '@/types/rh'
import { minutesToHoursText } from '@/lib/calculoHoras'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'

export default function FuncionarioFicha() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user, role } = useAuth()

  const [funcionario, setFuncionario] = useState<Funcionario | null>(null)
  const [loading, setLoading] = useState(true)
  const [todasJornadas, setTodasJornadas] = useState<Jornada[]>([])
  const [bancoHorasLancamentos, setBancoHorasLancamentos] = useState<BancoHorasLancamento[]>([])
  const [bancoHorasSaldo, setBancoHorasSaldo] = useState<{
    minutos: number
    horasFormatadas: string
    totalCredito: number
    totalDebito: number
  }>({ minutos: 0, horasFormatadas: '00:00', totalCredito: 0, totalDebito: 0 })

  // Troca de Jornada Modal
  const [trocaJornadaModalOpen, setTrocaJornadaModalOpen] = useState(false)
  const [novaJornadaId, setNovaJornadaId] = useState('')
  const [dataInicioJornada, setDataInicioJornada] = useState(new Date().toISOString().split('T')[0])
  const [salvandoJornada, setSalvandoJornada] = useState(false)

  // Lançamento Banco de Horas Modal
  const [bhModalOpen, setBhModalOpen] = useState(false)
  const [bhTipo, setBhTipo] = useState<'credito' | 'debito' | 'ajuste_manual'>('credito')
  const [bhHoras, setBhHoras] = useState('01:00')
  const [bhDataRef, setBhDataRef] = useState(new Date().toISOString().split('T')[0])
  const [bhMotivo, setBhMotivo] = useState('')
  const [salvandoBh, setSalvandoBh] = useState(false)

  // Tab State
  type TabType =
    | 'pessoais'
    | 'profissionais'
    | 'jornada'
    | 'contratuais'
    | 'documentos'
    | 'banco_horas'
    | 'ferias'
    | 'historico'
  const [activeTab, setActiveTab] = useState<TabType>('pessoais')

  // Related Subsections Data
  const [historicoList, setHistoricoList] = useState<HistoricoFuncionario[]>([])
  const [historicoJornadas, setHistoricoJornadas] = useState<HistoricoJornada[]>([])
  const [feriasList, setFeriasList] = useState<Ferias[]>([])
  const [ausenciasList, setAusenciasList] = useState<Ausencia[]>([])
  const [documentosList, setDocumentosList] = useState<Documento[]>([])
  const [uploadDocModalOpen, setUploadDocModalOpen] = useState(false)
  const [docNome, setDocNome] = useState('')
  const [docDescricao, setDocDescricao] = useState('')
  const [docCategoria, setDocCategoria] = useState<Documento['categoria']>('contrato_trabalho')
  const [docValidade, setDocValidade] = useState('')
  const [docNivelAcesso, setDocNivelAcesso] = useState<Documento['nivel_acesso']>('restrito_rh')
  const [docArquivo, setDocArquivo] = useState<File | null>(null)
  const [salvandoDoc, setSalvandoDoc] = useState(false)

  // Modals
  const [desligarModalOpen, setDesligarModalOpen] = useState(false)
  const [motivoDesligamento, setMotivoDesligamento] = useState('')
  const [desligando, setDesligando] = useState(false)

  const [reativarModalOpen, setReativarModalOpen] = useState(false)
  const [reativando, setReativando] = useState(false)

  // Alteração Salarial Modal
  const [altSalarialModalOpen, setAltSalarialModalOpen] = useState(false)
  const [novoSalario, setNovoSalario] = useState<number | ''>('')
  const [dataAlteracao, setDataAlteracao] = useState(new Date().toISOString().split('T')[0])
  const [motivoAlteracao, setMotivoAlteracao] = useState('')
  const [salvandoSalario, setSalvandoSalario] = useState(false)

  // PIN Modal
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [novoPin, setNovoPin] = useState('')
  const [confirmaPin, setConfirmaPin] = useState('')
  const [salvandoPin, setSalvandoPin] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)

  const isAdmin = role === 'admin'

  const loadData = async () => {
    if (!id) return
    try {
      const func = await funcionariosService.getById(id)
      setFuncionario(func)

      const [hist, jorHist, jorList, bhList, bhSaldo] = await Promise.all([
        historicoService.listByFuncionario(id),
        historicoJornadasService.listByFuncionario(id),
        jornadasService.list(),
        bancoHorasService.listByFuncionario(id),
        bancoHorasService.getSaldoFuncionario(id),
      ])
      setHistoricoList(hist)
      setHistoricoJornadas(jorHist)
      setTodasJornadas(jorList)
      setBancoHorasLancamentos(bhList)
      setBancoHorasSaldo(bhSaldo)

      // Load Ferias, Ausencias and Documentos with expand
      try {
        const [ferRes, ausRes, docRes] = await Promise.all([
          feriasService.listByFuncionario(id),
          ausenciasService.listByFuncionario(id),
          documentosService.list({ funcionarioId: id }),
        ])
        setFeriasList(ferRes)
        setAusenciasList(ausRes)
        setDocumentosList(docRes)
      } catch {
        /* intentionally ignored */
      }
    } catch (err: any) {
      console.error('Erro ao carregar funcionário:', err)
      toast({
        title: 'Funcionário não encontrado',
        description: 'Não foi possível carregar os dados deste funcionário.',
        variant: 'destructive',
      })
      navigate('/admin/funcionarios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleDesligar = async () => {
    if (!id) return
    setDesligando(true)
    try {
      await funcionariosService.desligar(id, motivoDesligamento, user?.id)
      toast({
        title: 'Funcionário desligado.',
        description: 'O histórico foi preservado e a situação atualizada para desligado.',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      })
      setDesligarModalOpen(false)
      setMotivoDesligamento('')
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao desligar funcionário',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setDesligando(false)
    }
  }

  const handleReativar = async () => {
    if (!id) return
    setReativando(true)
    try {
      await funcionariosService.reativar(id, user?.id)
      toast({
        title: 'Funcionário reativado.',
        description: 'A situação foi atualizada para ativo com sucesso.',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      })
      setReativarModalOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao reativar funcionário',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setReativando(false)
    }
  }

  const handleSalvarPin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setPinError(null)

    if (!/^\d{4,6}$/.test(novoPin)) {
      setPinError('O PIN deve conter exclusivamente de 4 a 6 dígitos numéricos.')
      return
    }

    if (novoPin !== confirmaPin) {
      setPinError('A confirmação do PIN não confere com o novo PIN digitado.')
      return
    }

    setSalvandoPin(true)
    try {
      await terminalService.updatePin(id, novoPin)
      toast({
        title: 'PIN atualizado com sucesso.',
        description: 'O funcionário já pode utilizar este PIN no Terminal Coletivo de Ponto.',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      })
      setPinModalOpen(false)
      setNovoPin('')
      setConfirmaPin('')
      loadData()
    } catch (err: any) {
      setPinError(err?.message || 'Erro ao atualizar PIN do funcionário.')
    } finally {
      setSalvandoPin(false)
    }
  }

  const handleSalvarSalario = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || novoSalario === '') return
    setSalvandoSalario(true)
    try {
      await pb.collection('funcionarios').update(id, {
        salario_contratual: Number(novoSalario),
      })

      await historicoService.create({
        funcionario: id,
        tipo: 'alteracao_salarial',
        descricao: `Alteração salarial para ${formatBRCurrency(Number(novoSalario))}. Data: ${formatBRDate(dataAlteracao)}. Motivo: ${motivoAlteracao || 'Reajuste'}`,
        data: new Date().toISOString(),
        usuario_responsavel: user?.id,
      })

      toast({
        title: 'Alteração salarial registrada.',
        description: 'O novo salário e o histórico foram atualizados com sucesso.',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      })

      setAltSalarialModalOpen(false)
      setNovoSalario('')
      setMotivoAlteracao('')
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar alteração salarial',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setSalvandoSalario(false)
    }
  }

  if (loading || !funcionario) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const avatarUrl = funcionario.fotografia
    ? pb.files.getURL(funcionario, funcionario.fotografia)
    : null
  const initial = funcionario.nome ? funcionario.nome.charAt(0).toUpperCase() : 'F'

  const getSituacaoPill = (sit: string) => {
    switch (sit) {
      case 'ativo':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
            Ativo
          </span>
        )
      case 'afastado':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
            Afastado
          </span>
        )
      case 'em_ferias':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-900 border border-purple-300">
            <span className="w-2 h-2 rounded-full bg-purple-600 mr-2" />
            Em Férias
          </span>
        )
      case 'desligado':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <span className="w-2 h-2 rounded-full bg-red-500 mr-2" />
            Desligado
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            {sit}
          </span>
        )
    }
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/admin/funcionarios">
              <Button variant="outline" size="sm" className="h-9 w-9 p-0 border-slate-200">
                <ArrowLeft className="w-4 h-4 text-slate-600" />
              </Button>
            </Link>

            <div className="flex items-center gap-4">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={funcionario.nome}
                  className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-xs shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-[#D4AF37]/20 text-amber-900 border border-[#D4AF37]/30 flex items-center justify-center font-bold text-2xl shrink-0">
                  {initial}
                </div>
              )}

              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {funcionario.nome}
                  </h2>
                  {getSituacaoPill(funcionario.situacao)}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                    Matrícula: {funcionario.matricula}
                  </span>
                  <span>•</span>
                  <span>{funcionario.expand?.cargo?.nome || 'Sem cargo'}</span>
                  <span>•</span>
                  <span>{funcionario.expand?.departamento?.nome || 'Sem depto'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 md:pt-0">
            <Link to={`/admin/funcionarios/${funcionario.id}/editar`}>
              <Button
                variant="outline"
                className="h-9 text-xs sm:text-sm border-slate-200 text-slate-700 hover:text-[#D4AF37]"
              >
                <Edit3 className="w-4 h-4 mr-1.5" />
                Editar
              </Button>
            </Link>

            {funcionario.situacao === 'desligado' ? (
              <Button
                onClick={() => setReativarModalOpen(true)}
                className="h-9 text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <UserCheck className="w-4 h-4 mr-1.5" />
                Reativar
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setDesligarModalOpen(true)}
                className="h-9 text-xs sm:text-sm border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <UserX className="w-4 h-4 mr-1.5" />
                Desligar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Card */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        {/* Navigation Tabs Bar */}
        <div className="flex overflow-x-auto border-b border-slate-200 px-6 pt-2 gap-4 sm:gap-6 scrollbar-none">
          <button
            onClick={() => setActiveTab('pessoais')}
            className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'pessoais'
                ? 'border-[#D4AF37] text-amber-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <User className="w-4 h-4 text-[#D4AF37]" />
            Dados Pessoais
          </button>

          <button
            onClick={() => setActiveTab('profissionais')}
            className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'profissionais'
                ? 'border-[#D4AF37] text-amber-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Briefcase className="w-4 h-4 text-[#D4AF37]" />
            Dados Profissionais
          </button>

          <button
            onClick={() => setActiveTab('jornada')}
            className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'jornada'
                ? 'border-[#D4AF37] text-amber-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock className="w-4 h-4 text-[#D4AF37]" />
            Jornada & Escala
          </button>

          <button
            onClick={() => setActiveTab('banco_horas')}
            className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'banco_horas'
                ? 'border-[#D4AF37] text-amber-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="w-4 h-4 text-[#D4AF37]" />
            Banco de Horas
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('contratuais')}
              className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'contratuais'
                  ? 'border-[#D4AF37] text-amber-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileCheck2 className="w-4 h-4 text-[#D4AF37]" />
              Dados Contratuais
            </button>
          )}

          <button
            onClick={() => setActiveTab('documentos')}
            className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'documentos'
                ? 'border-[#D4AF37] text-amber-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FolderOpen className="w-4 h-4 text-[#D4AF37]" />
            Documentos
          </button>

          <button
            onClick={() => setActiveTab('ferias')}
            className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'ferias'
                ? 'border-[#D4AF37] text-amber-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <CalendarDays className="w-4 h-4 text-[#D4AF37]" />
            Férias e Ausências
          </button>

          <button
            onClick={() => setActiveTab('historico')}
            className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'historico'
                ? 'border-[#D4AF37] text-amber-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="w-4 h-4 text-[#D4AF37]" />
            Histórico
          </button>
        </div>

        {/* Tab Content Panes */}
        <div className="p-6">
          {/* TAB: DADOS PESSOAIS */}
          {activeTab === 'pessoais' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-semibold text-slate-400 block uppercase">
                    Nome Completo
                  </span>
                  <p className="text-sm font-medium text-slate-900 mt-0.5">{funcionario.nome}</p>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400 block uppercase">CPF</span>
                  <p className="text-sm font-medium text-slate-900 font-mono mt-0.5">
                    {maskCPF(funcionario.cpf)}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400 block uppercase">
                    Data de Nascimento
                  </span>
                  <p className="text-sm font-medium text-slate-900 mt-0.5">
                    {formatBRDate(funcionario.data_nascimento)}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400 block uppercase">
                    Contato de Emergência
                  </span>
                  <p className="text-sm font-medium text-slate-900 mt-0.5">
                    {funcionario.contato_emergencia || 'Não informado'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-xs font-semibold text-slate-400 block uppercase">
                    E-mail
                  </span>
                  <p className="text-sm font-medium text-slate-900 mt-0.5 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    {funcionario.email}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400 block uppercase">
                    Telefone
                  </span>
                  <p className="text-sm font-medium text-slate-900 mt-0.5 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    {maskPhone(funcionario.telefone || '') || 'Não informado'}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400 block uppercase">
                    Endereço
                  </span>
                  <p className="text-sm font-medium text-slate-900 mt-0.5 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    {funcionario.endereco || 'Não informado'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: DADOS PROFISSIONAIS */}
          {activeTab === 'profissionais' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <span className="text-xs font-semibold text-slate-400 block uppercase">
                    Matrícula
                  </span>
                  <p className="text-sm font-semibold font-mono text-slate-900 mt-0.5">
                    {funcionario.matricula}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400 block uppercase">
                    Data de Admissão
                  </span>
                  <p className="text-sm font-medium text-slate-900 mt-0.5">
                    {formatBRDate(funcionario.data_admissao)}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400 block uppercase">
                    Tipo de Vínculo
                  </span>
                  <p className="text-sm font-medium text-slate-900 mt-0.5">
                    {funcionario.tipo_vinculo || 'CLT'}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400 block uppercase">
                    Cargo
                  </span>
                  <p className="text-sm font-medium text-slate-900 mt-0.5">
                    {funcionario.expand?.cargo?.nome || 'Não definido'}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400 block uppercase">
                    Departamento
                  </span>
                  <p className="text-sm font-medium text-slate-900 mt-0.5">
                    {funcionario.expand?.departamento?.nome || 'Não definido'}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400 block uppercase">
                    Jornada Atual
                  </span>
                  <p className="text-sm font-medium text-slate-900 mt-0.5">
                    {funcionario.expand?.jornada_atual?.nome || 'Não definida'}
                  </p>
                </div>

                {/* PIN do Terminal */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 col-span-1 md:col-span-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#D4AF37]/20 text-[#D4AF37] flex items-center justify-center shrink-0">
                        <KeyRound className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-800 block">
                          PIN Exclusivo do Terminal de Ponto
                        </span>
                        <p className="text-xs text-slate-500">
                          Código numérico de 4 a 6 dígitos utilizado para identificação direta no
                          terminal (sem necessidade de digitar matrícula). Cada funcionário ativo
                          deve ter um PIN único.
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={() => {
                        setNovoPin('')
                        setConfirmaPin('')
                        setPinError(null)
                        setPinModalOpen(true)
                      }}
                      className="bg-[#0F1624] hover:bg-[#151D2C] text-[#D4AF37] border border-[#D4AF37]/40 text-xs font-semibold h-8 px-3 shadow-xs shrink-0"
                    >
                      <Lock className="w-3.5 h-3.5 mr-1" />
                      Definir / Trocar PIN
                    </Button>
                  </div>

                  {/* Informação sobre Acesso ao Portal */}
                  <div className="mt-3 p-3 rounded-lg bg-[#0F1624] border border-[#D4AF37]/20 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-amber-100 block">
                        Acesso ao Portal do Colaborador
                      </span>
                      <p className="text-[11px] text-slate-400">
                        {funcionario.user
                          ? `Usuário vinculado ao e-mail ${funcionario.email}. O colaborador acessa com seu e-mail e senha.`
                          : `O colaborador ainda não possui usuário individual. Ele pode ser cadastrado ou vinculado ao e-mail ${funcionario.email}.`}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] border-[#D4AF37]/30 text-amber-300 shrink-0"
                    >
                      {funcionario.user ? 'Conta Ativa' : 'Pendente'}
                    </Badge>
                  </div>
                </div>

                {funcionario.situacao === 'desligado' && (
                  <div>
                    <span className="text-xs font-semibold text-red-500 block uppercase">
                      Data de Desligamento
                    </span>
                    <p className="text-sm font-semibold text-red-700 mt-0.5">
                      {formatBRDate(funcionario.data_desligamento)}
                    </p>
                  </div>
                )}
              </div>

              {/* Sub-seção: Histórico de Jornadas */}
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  Histórico de Jornadas
                </h4>

                {historicoJornadas.length === 0 ? (
                  <p className="text-xs text-slate-500">Nenhum histórico de jornada registrado.</p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="py-2">Jornada</th>
                        <th className="py-2">Início</th>
                        <th className="py-2">Fim</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historicoJornadas.map((j) => (
                        <tr key={j.id}>
                          <td className="py-2.5 font-medium text-slate-800">
                            {j.expand?.jornada?.nome || 'Jornada'}
                          </td>
                          <td className="py-2.5 text-slate-600">{formatBRDate(j.data_inicio)}</td>
                          <td className="py-2.5 text-slate-600">
                            {j.data_fim ? formatBRDate(j.data_fim) : 'Vigente'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB: JORNADA & ESCALA INDIVIDUAL */}
          {activeTab === 'jornada' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase block">
                    Jornada Vigente Atual
                  </span>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">
                    {funcionario.expand?.jornada_atual?.nome || 'Nenhuma jornada vinculada'}
                  </p>
                  {funcionario.expand?.jornada_atual && (
                    <div className="flex items-center gap-3 text-xs text-slate-600 mt-1 flex-wrap">
                      <span className="font-mono">
                        {funcionario.expand.jornada_atual.hora_entrada} às{' '}
                        {funcionario.expand.jornada_atual.hora_saida}
                      </span>
                      <span>•</span>
                      <span>
                        Carga diária:{' '}
                        {minutesToHoursText(
                          funcionario.expand.jornada_atual.duracao_jornada_min || 0,
                        )}
                      </span>
                      {funcionario.expand.jornada_atual.atravessa_meia_noite && (
                        <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Turno Noturno
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Link to={`/admin/espelho-ponto?funcionarioId=${funcionario.id}`}>
                    <Button
                      variant="outline"
                      className="text-xs h-9 border-slate-200 text-[#2563EB]"
                    >
                      <CalendarDays className="w-3.5 h-3.5 mr-1" />
                      Abrir Espelho de Ponto
                    </Button>
                  </Link>

                  <Button
                    onClick={() => {
                      setNovaJornadaId(funcionario.jornada_atual || '')
                      setDataInicioJornada(new Date().toISOString().split('T')[0])
                      setTrocaJornadaModalOpen(true)
                    }}
                    className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold text-xs h-9 px-3.5 shadow-xs border-0 hover:brightness-110"
                  >
                    <Clock className="w-3.5 h-3.5 mr-1.5" />
                    Alterar Jornada (Vigência)
                  </Button>
                </div>
              </div>

              {/* Detalhes da Jornada Atual */}
              {funcionario.expand?.jornada_atual && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 border border-slate-200 rounded-xl">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 block uppercase">
                      Dias de Trabalho
                    </span>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {(funcionario.expand.jornada_atual.dias_trabalho || []).map((d) => (
                        <span
                          key={d}
                          className="bg-amber-50 text-amber-900 border border-amber-300 text-xs font-bold uppercase px-2 py-0.5 rounded"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-slate-400 block uppercase">
                      Intervalo Previsto
                    </span>
                    <p className="text-sm font-medium text-slate-800 mt-1 font-mono">
                      {funcionario.expand.jornada_atual.hora_inicio_intervalo &&
                      funcionario.expand.jornada_atual.hora_retorno_intervalo
                        ? `${funcionario.expand.jornada_atual.hora_inicio_intervalo} às ${funcionario.expand.jornada_atual.hora_retorno_intervalo}`
                        : 'Sem intervalo previsto'}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-slate-400 block uppercase">
                      Dias de Folga
                    </span>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {(funcionario.expand.jornada_atual.dias_folga || []).map((d) => (
                        <span
                          key={d}
                          className="bg-slate-100 text-slate-600 text-xs font-bold uppercase px-2 py-0.5 rounded"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Histórico com Vigência */}
              <div className="pt-2">
                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-500" />
                  Histórico de Vigências de Jornada
                </h4>
                {historicoJornadas.length === 0 ? (
                  <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
                    Nenhuma alteração histórica gravada. A jornada atual é a vigente desde a
                    admissão.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                          <th className="py-2.5 px-4">Jornada</th>
                          <th className="py-2.5 px-4">Data Início</th>
                          <th className="py-2.5 px-4">Data Fim</th>
                          <th className="py-2.5 px-4">Horários</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {historicoJornadas.map((h) => (
                          <tr key={h.id}>
                            <td className="py-2.5 px-4 font-semibold text-slate-800">
                              {h.expand?.jornada?.nome || 'Jornada'}
                            </td>
                            <td className="py-2.5 px-4 text-slate-600 font-mono">
                              {formatBRDate(h.data_inicio)}
                            </td>
                            <td className="py-2.5 px-4 text-slate-600 font-mono">
                              {h.data_fim ? (
                                formatBRDate(h.data_fim)
                              ) : (
                                <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold text-[10px]">
                                  Vigente Atual
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-slate-500 font-mono">
                              {h.expand?.jornada?.hora_entrada} - {h.expand?.jornada?.hora_saida}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: BANCO DE HORAS */}
          {activeTab === 'banco_horas' && (
            <div className="space-y-6">
              {/* Cards de Saldo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl">
                  <span className="text-xs font-semibold text-blue-900 block uppercase">
                    Saldo Acumulado
                  </span>
                  <p
                    className={`text-2xl font-bold font-mono mt-1 ${bancoHorasSaldo.minutos < 0 ? 'text-red-600' : 'text-emerald-700'}`}
                  >
                    {bancoHorasSaldo.horasFormatadas}
                  </p>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    {bancoHorasSaldo.minutos >= 0 ? 'Horas a compensar/pagar' : 'Horas em débito'}
                  </span>
                </div>

                <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl">
                  <span className="text-xs font-semibold text-emerald-900 block uppercase">
                    Total de Créditos
                  </span>
                  <p className="text-2xl font-bold font-mono text-emerald-700 mt-1">
                    +{minutesToHoursText(bancoHorasSaldo.totalCredito)}
                  </p>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Horas extras acumuladas
                  </span>
                </div>

                <div className="p-4 bg-red-50/50 border border-red-200 rounded-xl">
                  <span className="text-xs font-semibold text-red-900 block uppercase">
                    Total de Débitos
                  </span>
                  <p className="text-2xl font-bold font-mono text-red-700 mt-1">
                    -{minutesToHoursText(bancoHorasSaldo.totalDebito)}
                  </p>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Compensações e descontos
                  </span>
                </div>
              </div>

              {/* Botão de Lançamento */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Extrato do Banco de Horas</h4>
                  <p className="text-xs text-slate-500">
                    Histórico de créditos, compensações e ajustes manuais
                  </p>
                </div>

                <Button
                  onClick={() => {
                    setBhHoras('01:00')
                    setBhDataRef(new Date().toISOString().split('T')[0])
                    setBhMotivo('')
                    setBhTipo('credito')
                    setBhModalOpen(true)
                  }}
                  className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold text-xs h-9 px-3.5 shadow-xs border-0 hover:brightness-110"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Novo Lançamento
                </Button>
              </div>

              {bancoHorasLancamentos.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50">
                  <p className="text-xs text-slate-500">
                    Nenhum lançamento no banco de horas deste funcionário.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                        <th className="py-2.5 px-4">Data Ref.</th>
                        <th className="py-2.5 px-4">Tipo</th>
                        <th className="py-2.5 px-4">Duração</th>
                        <th className="py-2.5 px-4">Motivo / Descrição</th>
                        <th className="py-2.5 px-4">Responsável</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bancoHorasLancamentos.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-4 font-mono text-slate-700">
                            {formatBRDate(b.data_referencia)}
                          </td>
                          <td className="py-2.5 px-4">
                            {b.tipo === 'credito' && (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">
                                Crédito (+)
                              </span>
                            )}
                            {b.tipo === 'debito' && (
                              <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded text-[10px] font-bold">
                                Débito (-)
                              </span>
                            )}
                            {b.tipo === 'ajuste_manual' && (
                              <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold">
                                Ajuste
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                            {minutesToHoursText(b.minutos)} ({b.minutos}m)
                          </td>
                          <td className="py-2.5 px-4 text-slate-700 max-w-xs">{b.motivo}</td>
                          <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                            {b.expand?.usuario_responsavel?.nome ||
                              b.expand?.usuario_responsavel?.name ||
                              'RH'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB: DADOS CONTRATUAIS (Admin Only) */}
          {isAdmin && activeTab === 'contratuais' && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl flex items-start gap-3 text-xs text-blue-900">
                <ShieldCheck className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                <p>
                  Estes dados são protegidos por regras de controle de acesso (RLS) no backend e
                  visíveis exclusivamente para administradores.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <span className="text-xs font-semibold text-slate-400 block uppercase">
                    Salário Contratual
                  </span>
                  <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                    {formatBRCurrency(funcionario.salario_contratual)}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400 block uppercase">
                    Início do Contrato
                  </span>
                  <p className="text-sm font-medium text-slate-900 mt-0.5">
                    {formatBRDate(funcionario.data_inicio_contrato || funcionario.data_admissao)}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400 block uppercase">
                    Tipo de Contrato
                  </span>
                  <p className="text-sm font-medium text-slate-900 mt-0.5">
                    {funcionario.tipo_contrato || funcionario.tipo_vinculo || 'CLT'}
                  </p>
                </div>
              </div>

              {/* Histórico de Alterações Salariais */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-slate-900">
                    Histórico de Alterações Salariais
                  </h4>
                  <Button
                    size="sm"
                    onClick={() => setAltSalarialModalOpen(true)}
                    className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold text-xs h-8 px-3 border-0 hover:brightness-110"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Registrar alteração salarial
                  </Button>
                </div>

                {historicoList.filter((h) => h.tipo === 'alteracao_salarial').length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Nenhuma alteração salarial registrada até o momento.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
                    {historicoList
                      .filter((h) => h.tipo === 'alteracao_salarial')
                      .map((item) => (
                        <div key={item.id} className="p-3 text-xs flex justify-between gap-4">
                          <div>
                            <p className="font-semibold text-slate-800">{item.descricao}</p>
                            <p className="text-slate-400 mt-0.5">
                              Responsável: {item.expand?.usuario_responsavel?.nome || 'Admin'}
                            </p>
                          </div>
                          <span className="text-slate-500 font-mono">
                            {formatBRDate(item.data || item.created)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: DOCUMENTOS (ETAPA 5) */}
          {activeTab === 'documentos' && (
            <div className="space-y-6">
              {/* Header da aba */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase block">
                    Prontuário e Dossiê Documental
                  </span>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    {funcionario.nome} • {documentosList.length} documento(s) cadastrado(s)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link to={`/admin/documentos?funcionarioId=${funcionario.id}`}>
                    <Button
                      variant="outline"
                      className="text-xs h-9 border-slate-200 text-[#2563EB] hover:bg-blue-50"
                    >
                      <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                      Abrir na Central
                    </Button>
                  </Link>

                  <Button
                    onClick={() => {
                      setDocNome('')
                      setDocDescricao('')
                      setDocValidade('')
                      setDocArquivo(null)
                      setUploadDocModalOpen(true)
                    }}
                    className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold text-xs h-9 shadow-xs border-0 hover:brightness-110"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Novo Documento
                  </Button>
                </div>
              </div>

              {/* Lista categorizada de documentos */}
              {documentosList.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <div className="w-14 h-14 rounded-full bg-blue-50 text-[#2563EB] flex items-center justify-center mb-3">
                    <FolderOpen className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">Nenhum documento arquivado</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    Cadastre contratos de trabalho, documentos admissionais, atestados e termos
                    assinados vinculados a este colaborador.
                  </p>
                  <Button
                    onClick={() => setUploadDocModalOpen(true)}
                    size="sm"
                    className="mt-4 bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold text-xs h-8 border-0 hover:brightness-110"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Fazer Upload Agora
                  </Button>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                        <th className="py-2.5 px-4">Documento</th>
                        <th className="py-2.5 px-4">Categoria</th>
                        <th className="py-2.5 px-4">Nível de Acesso</th>
                        <th className="py-2.5 px-4">Data Envio</th>
                        <th className="py-2.5 px-4">Validade</th>
                        <th className="py-2.5 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {documentosList.map((doc) => {
                        return (
                          <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-4">
                              <span className="font-bold text-slate-800 block">{doc.nome}</span>
                              {doc.descricao && (
                                <span className="text-[11px] text-slate-500 block truncate max-w-xs">
                                  {doc.descricao}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400 font-mono">
                                {doc.arquivo}
                              </span>
                            </td>
                            <td className="py-2.5 px-4">
                              <Badge variant="outline" className="text-[11px] capitalize">
                                {doc.categoria.replace('_', ' ')}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-4">
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  doc.nivel_acesso === 'restrito_medico'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : doc.nivel_acesso === 'restrito_rh'
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {doc.nivel_acesso.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-600 font-mono">
                              {formatBRDate(doc.data_envio || doc.created)}
                            </td>
                            <td className="py-2.5 px-4 text-slate-600 font-mono">
                              {doc.data_validade ? (
                                formatBRDate(doc.data_validade)
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={async () => {
                                  try {
                                    const url = await documentosService.getSecureUrl(doc)
                                    await documentosService.logAcessoVisualizacao(doc, 'download')
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
                                  } catch (err: any) {
                                    toast({
                                      title: 'Erro ao baixar documento',
                                      description: err.message,
                                      variant: 'destructive',
                                    })
                                  }
                                }}
                                className="h-7 text-xs text-[#D4AF37] hover:bg-amber-50"
                              >
                                Baixar
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB: FÉRIAS E AUSÊNCIAS (COMPLETO ETAPA 4) */}
          {activeTab === 'ferias' && (
            <div className="space-y-8">
              {/* Ações e Atalhos */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase block">
                    Gestão Integrada de Férias e Ausências
                  </span>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    Admissão: {formatBRDate(funcionario.data_admissao)} • Situação:{' '}
                    <span className="capitalize font-semibold text-amber-900">
                      {funcionario.situacao === 'em_ferias' ? 'Em Férias' : funcionario.situacao}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link to={`/admin/ferias?funcionarioId=${funcionario.id}`}>
                    <Button
                      variant="outline"
                      className="text-xs h-8 border-slate-200 text-[#D4AF37] hover:bg-amber-50"
                    >
                      <CalendarDays className="w-3.5 h-3.5 mr-1" />
                      Ver Períodos Aquisitivos & Gozos
                    </Button>
                  </Link>

                  <Link to={`/admin/ausencias?funcionarioId=${funcionario.id}`}>
                    <Button
                      variant="outline"
                      className="text-xs h-8 border-slate-200 text-slate-700 hover:bg-slate-100"
                    >
                      <Clock className="w-3.5 h-3.5 mr-1" />
                      Filtrar Ausências
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Seção Férias */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-[#D4AF37]" />
                    Histórico Completo de Férias
                  </h4>
                  <Link to={`/admin/ferias?funcionarioId=${funcionario.id}`}>
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold text-xs h-7 px-2.5 border-0 hover:brightness-110"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Programar Férias
                    </Button>
                  </Link>
                </div>

                {feriasList.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <p className="text-xs text-slate-500">Nenhum período de férias cadastrado.</p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                          <th className="py-2.5 px-3">Período de Gozo</th>
                          <th className="py-2.5 px-3 text-center">Dias Gozo</th>
                          <th className="py-2.5 px-3 text-center">Dias Abono</th>
                          <th className="py-2.5 px-3">Tipo</th>
                          <th className="py-2.5 px-3">Situação</th>
                          <th className="py-2.5 px-3">Observações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {feriasList.map((f) => (
                          <tr key={f.id} className="hover:bg-slate-50/60">
                            <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                              {formatBRDate(f.data_inicio)} a {formatBRDate(f.data_fim)}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                              {f.dias} dias
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                              {f.dias_abono ? `${f.dias_abono}d` : '—'}
                            </td>
                            <td className="py-2.5 px-3 capitalize text-slate-700">
                              {f.tipo || 'integral'}
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge
                                className={
                                  f.status === 'em_gozo'
                                    ? 'bg-amber-100 text-amber-800'
                                    : f.status === 'concluida'
                                      ? 'bg-slate-100 text-slate-700'
                                      : f.status === 'programada' || f.status === 'aprovado'
                                        ? 'bg-blue-100 text-[#1E3A8A]'
                                        : 'bg-red-50 text-red-700'
                                }
                              >
                                {f.status}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">
                              {f.observacoes || f.justificativa_rh || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Seção Ausências */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    Registro de Ausências, Atestados e Afastamentos
                  </h4>
                  <Link to={`/admin/ausencias?funcionarioId=${funcionario.id}`}>
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold text-xs h-7 px-2.5 border-0 hover:brightness-110"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Nova Ausência
                    </Button>
                  </Link>
                </div>

                {ausenciasList.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <p className="text-xs text-slate-500">
                      Nenhum registro de ausência cadastrado.
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                          <th className="py-2.5 px-3">Categoria</th>
                          <th className="py-2.5 px-3">Período</th>
                          <th className="py-2.5 px-3">Situação</th>
                          <th className="py-2.5 px-3">Justificativa</th>
                          <th className="py-2.5 px-3 text-center">Impacto CLT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ausenciasList.map((a) => (
                          <tr key={a.id} className="hover:bg-slate-50/60">
                            <td className="py-2.5 px-3 capitalize font-semibold text-slate-800">
                              {a.categoria.replace('_', ' ')}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700">
                              {formatBRDate(a.data_inicio)}
                              {a.data_fim && a.data_fim !== a.data_inicio
                                ? ` a ${formatBRDate(a.data_fim)}`
                                : ''}
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge variant="outline" className="capitalize text-[11px]">
                                {a.situacao || 'informada'}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                              {a.justificativa || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {a.impacta_aquisitivo ? (
                                <span className="text-red-600 font-semibold text-[11px]">
                                  Desconta aquisitivo
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* TAB: HISTÓRICO */}
          {activeTab === 'historico' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-900 mb-2">Histórico do Funcionário</h4>

              {historicoList.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhum evento registrado no histórico.</p>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {historicoList.map((h) => (
                    <div key={h.id} className="p-4 hover:bg-slate-50/60 transition-colors">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 capitalize bg-slate-100 px-2 py-0.5 rounded">
                          {h.tipo.replace('_', ' ')}
                        </span>
                        <span className="text-slate-400 font-mono">
                          {formatBRDate(h.data || h.created)}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 mt-2">{h.descricao}</p>
                      {h.expand?.usuario_responsavel && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          Registrado por:{' '}
                          {h.expand.usuario_responsavel.nome || h.expand.usuario_responsavel.email}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Desligar Funcionário */}
      <Dialog open={desligarModalOpen} onOpenChange={setDesligarModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-2">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <DialogTitle>Confirmar Desligamento</DialogTitle>
            <DialogDescription className="text-slate-600">
              Esta ação preserva todo o histórico do funcionário. Deseja continuar?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <Label htmlFor="motivoDeslig" className="text-xs font-semibold text-slate-700">
              Motivo / Observações (opcional)
            </Label>
            <Textarea
              id="motivoDeslig"
              placeholder="Ex: Rescisão contratual a pedido do colaborador..."
              value={motivoDesligamento}
              onChange={(e) => setMotivoDesligamento(e.target.value)}
              className="text-xs"
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={desligando}
              onClick={() => setDesligarModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={desligando}
              onClick={handleDesligar}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {desligando ? 'Desligando...' : 'Confirmar Desligamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Reativar Funcionário */}
      <Dialog open={reativarModalOpen} onOpenChange={setReativarModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reativar Funcionário</DialogTitle>
            <DialogDescription>
              Deseja reativar o colaborador <strong>{funcionario.nome}</strong>? Ele voltará a
              figurar como funcionário ativo na empresa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={reativando}
              onClick={() => setReativarModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={reativando}
              onClick={handleReativar}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {reativando ? 'Reativando...' : 'Confirmar Reativação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Upload Rápido de Documento na Ficha */}
      <Dialog open={uploadDocModalOpen} onOpenChange={setUploadDocModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 text-[#D4AF37] flex items-center justify-center mb-2">
              <Calendar className="w-5 h-5" />
            </div>{' '}
            <DialogTitle>Anexar Documento ao Prontuário</DialogTitle>
            <DialogDescription>
              Vincule um novo arquivo ao funcionário <strong>{funcionario.nome}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!id || !docNome.trim() || !docArquivo) return
              setSalvandoDoc(true)
              try {
                await documentosService.create({
                  funcionario: id,
                  categoria: docCategoria,
                  nome: docNome.trim(),
                  descricao: docDescricao.trim() || undefined,
                  data_validade: docValidade || undefined,
                  nivel_acesso: docNivelAcesso,
                  arquivo: docArquivo,
                  usuario_responsavel: user?.id,
                })

                toast({
                  title: 'Documento anexado com sucesso.',
                  description: 'Arquivo armazenado com acesso seguro.',
                  className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                })

                setUploadDocModalOpen(false)
                setDocNome('')
                setDocDescricao('')
                setDocValidade('')
                setDocArquivo(null)
                loadData()
              } catch (err: any) {
                toast({
                  title: 'Erro ao anexar documento',
                  description: err?.message,
                  variant: 'destructive',
                })
              } finally {
                setSalvandoDoc(false)
              }
            }}
            className="space-y-4 pt-2"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Título do Documento <span className="text-red-500">*</span>
              </Label>
              <Input
                required
                placeholder="Ex: Contrato de Trabalho, Documento Pessoal..."
                value={docNome}
                onChange={(e) => setDocNome(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Categoria</Label>
                <Select
                  value={docCategoria}
                  onValueChange={(val: any) => {
                    setDocCategoria(val)
                    if (val === 'atestado_medico') setDocNivelAcesso('restrito_medico')
                  }}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contrato_trabalho">Contrato de Trabalho</SelectItem>
                    <SelectItem value="documentacao_admissional">Doc. Admissional</SelectItem>
                    <SelectItem value="atestado_medico">Atestado Médico</SelectItem>
                    <SelectItem value="comprovantes">Comprovante</SelectItem>
                    <SelectItem value="termos_internos">Termo Interno</SelectItem>
                    <SelectItem value="documentos_ferias">Férias</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nível de Acesso</Label>
                <Select value={docNivelAcesso} onValueChange={(val: any) => setDocNivelAcesso(val)}>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Validade (se houver)</Label>
                <Input
                  type="date"
                  value={docValidade}
                  onChange={(e) => setDocValidade(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Observação</Label>
                <Input
                  placeholder="Opcional"
                  value={docDescricao}
                  onChange={(e) => setDocDescricao(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Arquivo (PDF, JPEG, PNG — Máx 10MB) <span className="text-red-500">*</span>
              </Label>
              <Input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                required
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    if (f.size > 10 * 1024 * 1024) {
                      toast({
                        title: 'Arquivo muito grande',
                        description: 'O tamanho máximo permitido é de 10 MB.',
                        variant: 'destructive',
                      })
                      e.target.value = ''
                      setDocArquivo(null)
                      return
                    }
                    setDocArquivo(f)
                    if (!docNome) setDocNome(f.name.replace(/\.[^/.]+$/, ''))
                  }
                }}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={salvandoDoc}
                onClick={() => setUploadDocModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoDoc || !docNome || !docArquivo}
                className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold border-0 hover:brightness-110"
              >
                {salvandoPin ? 'Salvando...' : 'Salvar Novo PIN'}
              </Button>{' '}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Definir / Trocar PIN */}
      <Dialog open={pinModalOpen} onOpenChange={setPinModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 text-[#D4AF37] flex items-center justify-center mb-2">
              <KeyRound className="w-5 h-5" />
            </div>
            <DialogTitle>PIN do Terminal Coletivo</DialogTitle>
            <DialogDescription>
              Defina ou atualize o PIN exclusivo de 4 a 6 dígitos para{' '}
              <strong>{funcionario.nome}</strong>. Como o terminal registra o ponto apenas pelo PIN
              (sem matrícula), este código deve ser único entre os colaboradores ativos e armazenado
              com hash criptográfico.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarPin} className="space-y-4 pt-2">
            {pinError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="novoPinInput" className="text-xs font-semibold">
                Novo PIN (4 a 6 dígitos numéricos) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="novoPinInput"
                type="password"
                inputMode="numeric"
                maxLength={6}
                required
                placeholder="Ex: 1234"
                value={novoPin}
                onChange={(e) => setNovoPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
                className="font-mono tracking-widest text-lg"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmaPinInput" className="text-xs font-semibold">
                Confirme o Novo PIN <span className="text-red-500">*</span>
              </Label>
              <Input
                id="confirmaPinInput"
                type="password"
                inputMode="numeric"
                maxLength={6}
                required
                placeholder="Ex: 1234"
                value={confirmaPin}
                onChange={(e) => setConfirmaPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="font-mono tracking-widest text-lg"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={salvandoPin}
                onClick={() => setPinModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoPin || !novoPin || !confirmaPin}
                className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold border-0 hover:brightness-110"
              >
                {salvandoDoc ? 'Enviando...' : 'Fazer Upload'}
              </Button>{' '}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Alterar Jornada com Vigência */}
      <Dialog open={trocaJornadaModalOpen} onOpenChange={setTrocaJornadaModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Jornada de Trabalho</DialogTitle>
            <DialogDescription>
              Defina a nova jornada para <strong>{funcionario.nome}</strong> e a data de início da
              vigência. O espelho dos meses anteriores continuará respeitando a jornada anterior.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!id || !novaJornadaId) return
              setSalvandoJornada(true)
              try {
                // 1. Close current history if any
                const currentHist = historicoJornadas.find((h) => !h.data_fim)
                if (currentHist) {
                  // End date = one day before the new one
                  const d = new Date(dataInicioJornada)
                  d.setDate(d.getDate() - 1)
                  const endStr = d.toISOString().split('T')[0]
                  await pb.collection('historico_jornadas').update(currentHist.id, {
                    data_fim: endStr,
                  })
                }

                // 2. Create new history record
                await historicoJornadasService.create({
                  funcionario: id,
                  jornada: novaJornadaId,
                  data_inicio: dataInicioJornada,
                })

                // 3. Update current jornada in funcionario record
                await pb.collection('funcionarios').update(id, {
                  jornada_atual: novaJornadaId,
                })

                toast({
                  title: 'Jornada atualizada.',
                  description:
                    'A nova jornada e seu histórico de vigência foram gravados com sucesso.',
                  className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                })

                setTrocaJornadaModalOpen(false)
                loadData()
              } catch (err: any) {
                toast({
                  title: 'Erro ao alterar jornada',
                  description: err?.message,
                  variant: 'destructive',
                })
              } finally {
                setSalvandoJornada(false)
              }
            }}
            className="space-y-4 pt-2"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Nova Jornada <span className="text-red-500">*</span>
              </Label>
              <Select value={novaJornadaId} onValueChange={setNovaJornadaId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Selecione a nova jornada" />
                </SelectTrigger>
                <SelectContent>
                  {todasJornadas.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.nome} ({j.hora_entrada} às {j.hora_saida})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dataInicioJor" className="text-xs font-semibold">
                Data de Início da Vigência <span className="text-red-500">*</span>
              </Label>
              <Input
                id="dataInicioJor"
                type="date"
                required
                value={dataInicioJornada}
                onChange={(e) => setDataInicioJornada(e.target.value)}
              />
              <p className="text-[11px] text-slate-500">
                A partir desta data os cálculos do espelho de ponto utilizarão os parâmetros desta
                nova jornada.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={salvandoJornada}
                onClick={() => setTrocaJornadaModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoJornada || !novaJornadaId}
                className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold border-0 hover:brightness-110"
              >
                {salvandoJornada ? 'Vinculando...' : 'Confirmar Vinculação'}
              </Button>{' '}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Lançamento no Banco de Horas */}
      <Dialog open={bhModalOpen} onOpenChange={setBhModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lançar no Banco de Horas</DialogTitle>
            <DialogDescription>
              Lance crédito de horas extras, compensações ou deduções no saldo de{' '}
              <strong>{funcionario.nome}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!id || !bhMotivo.trim()) return

              const [h, m] = bhHoras.split(':').map((v) => parseInt(v, 10))
              const minutosTotal = (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m)

              if (minutosTotal <= 0) {
                toast({
                  title: 'Duração inválida',
                  description: 'Informe uma quantidade de tempo maior que zero.',
                  variant: 'destructive',
                })
                return
              }

              setSalvandoBh(true)
              try {
                await bancoHorasService.lancar({
                  funcionario: id,
                  tipo: bhTipo,
                  minutos: minutosTotal,
                  data_referencia: bhDataRef,
                  motivo: bhMotivo.trim(),
                })

                toast({
                  title: 'Lançamento efetuado com sucesso.',
                  className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                })

                setBhModalOpen(false)
                loadData()
              } catch (err: any) {
                toast({
                  title: 'Erro ao lançar no banco de horas',
                  description: err?.message,
                  variant: 'destructive',
                })
              } finally {
                setSalvandoBh(false)
              }
            }}
            className="space-y-4 pt-2"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Tipo de Lançamento</Label>
                <Select value={bhTipo} onValueChange={(val: any) => setBhTipo(val)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credito">Crédito (+ Horas)</SelectItem>
                    <SelectItem value="debito">Débito (- Compensação)</SelectItem>
                    <SelectItem value="ajuste_manual">Ajuste Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bhHorasInput" className="text-xs font-semibold">
                  Quantidade (HH:MM) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="bhHorasInput"
                  type="time"
                  required
                  value={bhHoras}
                  onChange={(e) => setBhHoras(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bhDataRefInput" className="text-xs font-semibold">
                Data de Referência <span className="text-red-500">*</span>
              </Label>
              <Input
                id="bhDataRefInput"
                type="date"
                required
                value={bhDataRef}
                onChange={(e) => setBhDataRef(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bhMotivoInput" className="text-xs font-semibold">
                Motivo / Justificativa <span className="text-red-500">*</span>
              </Label>
              <Input
                id="bhMotivoInput"
                required
                placeholder="Ex: Hora extra autorizada / Compensação de folga"
                value={bhMotivo}
                onChange={(e) => setBhMotivo(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={salvandoBh}
                onClick={() => setBhModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoBh || !bhMotivo.trim()}
                className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold border-0 hover:brightness-110"
              >
                {salvandoBanco ? 'Lançando...' : 'Confirmar Lançamento'}
              </Button>{' '}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Alteração Salarial */}
      <Dialog open={altSalarialModalOpen} onOpenChange={setAltSalarialModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Alteração Salarial</DialogTitle>
            <DialogDescription>
              Informe o novo valor contratual e a justificativa da alteração.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarSalario} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="novoSalarioInput" className="text-xs font-semibold">
                Novo Salário (R$) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="novoSalarioInput"
                type="number"
                step="0.01"
                required
                placeholder="Ex: 3500.00"
                value={novoSalario}
                onChange={(e) =>
                  setNovoSalario(e.target.value === '' ? '' : Number(e.target.value))
                }
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dataAlteracaoInput" className="text-xs font-semibold">
                Data da Alteração <span className="text-red-500">*</span>
              </Label>
              <Input
                id="dataAlteracaoInput"
                type="date"
                required
                value={dataAlteracao}
                onChange={(e) => setDataAlteracao(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="motivoAltInput" className="text-xs font-semibold">
                Motivo da Alteração
              </Label>
              <Input
                id="motivoAltInput"
                placeholder="Ex: Dissídio coletivo anual / Promoção de cargo"
                value={motivoAlteracao}
                onChange={(e) => setMotivoAlteracao(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={salvandoSalario}
                onClick={() => setAltSalarialModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoSalario}
                className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold border-0 hover:brightness-110"
              >
                {salvandoFerias ? 'Salvando...' : 'Confirmar Férias'}
              </Button>{' '}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
