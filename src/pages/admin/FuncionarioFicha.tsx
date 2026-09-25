import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { funcionariosService, historicoService, historicoJornadasService } from '@/services/rh'
import type {
  Funcionario,
  HistoricoFuncionario,
  HistoricoJornada,
  Ferias,
  Ausencia,
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
} from 'lucide-react'
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

  // Tab State
  type TabType =
    | 'pessoais'
    | 'profissionais'
    | 'contratuais'
    | 'documentos'
    | 'ferias'
    | 'historico'
  const [activeTab, setActiveTab] = useState<TabType>('pessoais')

  // Related Subsections Data
  const [historicoList, setHistoricoList] = useState<HistoricoFuncionario[]>([])
  const [historicoJornadas, setHistoricoJornadas] = useState<HistoricoJornada[]>([])
  const [feriasList, setFeriasList] = useState<Ferias[]>([])
  const [ausenciasList, setAusenciasList] = useState<Ausencia[]>([])

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

  const isAdmin = role === 'admin'

  const loadData = async () => {
    if (!id) return
    try {
      const func = await funcionariosService.getById(id)
      setFuncionario(func)

      const [hist, jorHist] = await Promise.all([
        historicoService.listByFuncionario(id),
        historicoJornadasService.listByFuncionario(id),
      ])
      setHistoricoList(hist)
      setHistoricoJornadas(jorHist)

      // Load Ferias and Ausencias if any
      try {
        const ferRes = await pb.collection('ferias').getFullList<Ferias>({
          filter: `funcionario = "${id}"`,
          sort: '-data_inicio',
        })
        setFeriasList(ferRes)
      } catch {
        /* intentionally ignored */
      }

      try {
        const ausRes = await pb.collection('ausencias').getFullList<Ausencia>({
          filter: `funcionario = "${id}"`,
          sort: '-data_inicio',
        })
        setAusenciasList(ausRes)
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
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
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
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#2563EB] border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-[#2563EB] mr-2" />
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
                <div className="w-16 h-16 rounded-2xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center font-bold text-2xl shrink-0">
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
                className="h-9 text-xs sm:text-sm border-slate-200 text-slate-700 hover:text-[#2563EB]"
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
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <User className="w-4 h-4" />
            Dados Pessoais
          </button>

          <button
            onClick={() => setActiveTab('profissionais')}
            className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'profissionais'
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            Dados Profissionais
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('contratuais')}
              className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'contratuais'
                  ? 'border-[#2563EB] text-[#2563EB]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileCheck2 className="w-4 h-4" />
              Dados Contratuais
            </button>
          )}

          <button
            onClick={() => setActiveTab('documentos')}
            className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'documentos'
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            Documentos
          </button>

          <button
            onClick={() => setActiveTab('ferias')}
            className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'ferias'
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Férias e Ausências
          </button>

          <button
            onClick={() => setActiveTab('historico')}
            className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'historico'
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="w-4 h-4" />
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

          {/* TAB: DADOS CONTRATUAIS (Admin Only) */}
          {isAdmin && activeTab === 'contratuais' && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl flex items-start gap-3 text-xs text-blue-900">
                <ShieldCheck className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
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
                    className="bg-[#2563EB] text-white text-xs h-8 px-3"
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

          {/* TAB: DOCUMENTOS */}
          {activeTab === 'documentos' && (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <FolderOpen className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Nenhum documento vinculado.</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                A gestão e armazenamento seguro de documentos será ativada na etapa correspondente.
              </p>
            </div>
          )}

          {/* TAB: FÉRIAS E AUSÊNCIAS */}
          {activeTab === 'ferias' && (
            <div className="space-y-8">
              {/* Seção Férias */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-slate-500" />
                  Períodos de Férias
                </h4>
                {feriasList.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <p className="text-xs text-slate-500">Nenhum período de férias cadastrado.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="py-2">Início</th>
                        <th className="py-2">Fim</th>
                        <th className="py-2">Dias</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {feriasList.map((f) => (
                        <tr key={f.id}>
                          <td className="py-2.5 font-medium">{formatBRDate(f.data_inicio)}</td>
                          <td className="py-2.5">{formatBRDate(f.data_fim)}</td>
                          <td className="py-2.5">{f.dias || '-'}</td>
                          <td className="py-2.5 capitalize">{f.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Seção Ausências */}
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-slate-500" />
                  Registro de Ausências e Afastamentos
                </h4>
                {ausenciasList.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <p className="text-xs text-slate-500">
                      Nenhum registro de ausência cadastrado.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="py-2">Categoria</th>
                        <th className="py-2">Início</th>
                        <th className="py-2">Fim</th>
                        <th className="py-2">Justificativa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ausenciasList.map((a) => (
                        <tr key={a.id}>
                          <td className="py-2.5 capitalize font-medium">{a.categoria}</td>
                          <td className="py-2.5">{formatBRDate(a.data_inicio)}</td>
                          <td className="py-2.5">{a.data_fim ? formatBRDate(a.data_fim) : '-'}</td>
                          <td className="py-2.5 text-slate-600">{a.justificativa || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
              >
                {salvandoSalario ? 'Salvando...' : 'Salvar Alteração'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
