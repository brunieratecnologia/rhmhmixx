import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  funcionariosService,
  departamentosService,
  cargosService,
  jornadasService,
  historicoService,
  historicoJornadasService,
} from '@/services/rh'
import type { Cargo, Departamento, Jornada, Funcionario } from '@/types/rh'
import { maskCPF, maskPhone, isValidCPF, cleanDigits } from '@/lib/formatters'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  Save,
  User,
  Briefcase,
  Upload,
  AlertCircle,
  Plus,
  KeyRound,
  DollarSign,
  FileCheck2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import {
  derivarPinDataNascimento,
  calcularProximaMatricula,
  formatBRCurrency,
  formatBRDate,
} from '@/lib/formatters'
import { ScrollableTabsBar } from '@/components/admin/ScrollableTabsBar'
import { terminalService } from '@/services/rh'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

export default function FuncionarioForm() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()

  const isAdmin = user?.role === 'admin'
  const [activeTab, setActiveTab] = useState<'pessoais' | 'profissionais' | 'contrato'>('pessoais')
  const [loadingInitial, setLoadingInitial] = useState(isEditing)
  const [saving, setSaving] = useState(false)

  // References
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [jornadas, setJornadas] = useState<Jornada[]>([])

  // Modals for inline creation
  const [newCargoModal, setNewCargoModal] = useState(false)
  const [newCargoNome, setNewCargoNome] = useState('')
  const [newDepModal, setNewDepModal] = useState(false)
  const [newDepNome, setNewDepNome] = useState('')

  // Form Fields - Personal
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [endereco, setEndereco] = useState('')
  const [contatoEmergencia, setContatoEmergencia] = useState('')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)

  // Form Fields - Professional
  const [matricula, setMatricula] = useState('')
  const [dataAdmissao, setDataAdmissao] = useState('')
  const [cargoId, setCargoId] = useState('')
  const [departamentoId, setDepartamentoId] = useState('')
  const [tipoVinculo, setTipoVinculo] = useState<string>('CLT')
  const [pinInicial, setPinInicial] = useState('')
  const [confirmaPinInicial, setConfirmaPinInicial] = useState('')
  const [jornadaId, setJornadaId] = useState('')
  const [situacao, setSituacao] = useState<string>('ativo')
  const [dataDesligamento, setDataDesligamento] = useState('')

  // Form Fields - Salário e Contrato (Apenas Admin)
  const [salarioContratual, setSalarioContratual] = useState<number | ''>('')
  const [salarioOriginal, setSalarioOriginal] = useState<number>(0)
  const [motivoAlteracaoSalarial, setMotivoAlteracaoSalarial] = useState('')
  const [dataInicioContrato, setDataInicioContrato] = useState('')
  const [tipoContrato, setTipoContrato] = useState<string>('CLT')

  // Flag se o PIN foi editado manualmente pelo usuário no formulário
  const [pinEditadoManualmente, setPinEditadoManualmente] = useState(false)

  // Field Errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    async function loadRefsAndData() {
      try {
        const [deps, cargs, jorns, allFuncs] = await Promise.all([
          departamentosService.list(),
          cargosService.list(),
          jornadasService.list(true),
          funcionariosService.listAll(),
        ])
        setDepartamentos(deps)
        setCargos(cargs)
        setJornadas(jorns)

        if (isEditing && id) {
          const func = await funcionariosService.getById(id)
          setNome(func.nome || '')
          setCpf(maskCPF(func.cpf || ''))
          const dtNasc = func.data_nascimento ? func.data_nascimento.split('T')[0] : ''
          setDataNascimento(dtNasc)
          setTelefone(maskPhone(func.telefone || ''))
          setEmail(func.email || '')
          setEndereco(func.endereco || '')
          setContatoEmergencia(func.contato_emergencia || '')
          setMatricula(func.matricula || '')
          const dtAdm = func.data_admissao ? func.data_admissao.split('T')[0] : ''
          setDataAdmissao(dtAdm)
          setCargoId(func.cargo || '')
          setDepartamentoId(func.departamento || '')
          setTipoVinculo(func.tipo_vinculo || 'CLT')
          setJornadaId(func.jornada_atual || '')
          setSituacao(func.situacao || 'ativo')
          setDataDesligamento(func.data_desligamento ? func.data_desligamento.split('T')[0] : '')

          // Salário e contrato
          const sal = func.salario_contratual !== undefined ? Number(func.salario_contratual) : 0
          setSalarioContratual(sal > 0 ? sal : '')
          setSalarioOriginal(sal)
          setDataInicioContrato(
            func.data_inicio_contrato ? func.data_inicio_contrato.split('T')[0] : dtAdm,
          )
          setTipoContrato(func.tipo_contrato || func.tipo_vinculo || 'CLT')

          if (func.fotografia) {
            setFotoPreview(pb.files.getURL(func, func.fotografia))
          }
        } else {
          // Defaults for new employee
          if (cargs.length > 0) setCargoId(cargs[0].id)
          if (deps.length > 0) setDepartamentoId(deps[0].id)
          if (jorns.length > 0) setJornadaId(jorns[0].id)
          const hojeIso = new Date().toISOString().split('T')[0]
          setDataAdmissao(hojeIso)
          setDataInicioContrato(hojeIso)

          // 2) Matrícula sequencial automática pré-preenchida
          const matriculas = allFuncs.map((f) => f.matricula).filter(Boolean)
          const proxima = calcularProximaMatricula(matriculas)
          setMatricula(proxima)
        }
      } catch (err) {
        console.error('Erro ao carregar dados do formulário:', err)
        toast({
          title: 'Erro ao carregar dados',
          description: 'Não foi possível carregar as informações do formulário.',
          variant: 'destructive',
        })
      } finally {
        setLoadingInitial(false)
      }
    }

    loadRefsAndData()
  }, [id, isEditing])

  // Atualiza automaticamente o PIN padrão derivado da data de nascimento (se o usuário não tiver customizado manualmente)
  const handleDataNascimentoChange = (novaData: string) => {
    setDataNascimento(novaData)
    if (!isEditing && !pinEditadoManualmente && novaData) {
      const pinSugerido = derivarPinDataNascimento(novaData)
      if (pinSugerido) {
        setPinInicial(pinSugerido)
        setConfirmaPinInicial(pinSugerido)
      }
    }
  }

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: 'Arquivo muito grande',
          description: 'A fotografia deve ter no máximo 2MB.',
          variant: 'destructive',
        })
        return
      }
      setFotoFile(file)
      setFotoPreview(URL.createObjectURL(file))
    }
  }

  const handleCreateCargoInline = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCargoNome.trim()) return
    try {
      const created = await cargosService.create(newCargoNome.trim())
      setCargos([...cargos, created])
      setCargoId(created.id)
      setNewCargoNome('')
      setNewCargoModal(false)
      toast({ title: 'Cargo criado com sucesso.' })
    } catch (err: any) {
      toast({ title: 'Erro ao criar cargo', description: err?.message, variant: 'destructive' })
    }
  }

  const handleCreateDepInline = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDepNome.trim()) return
    try {
      const created = await departamentosService.create(newDepNome.trim())
      setDepartamentos([...departamentos, created])
      setDepartamentoId(created.id)
      setNewDepNome('')
      setNewDepModal(false)
      toast({ title: 'Departamento criado com sucesso.' })
    } catch (err: any) {
      toast({
        title: 'Erro ao criar departamento',
        description: err?.message,
        variant: 'destructive',
      })
    }
  }

  const validate = async () => {
    const newErrors: Record<string, string> = {}

    if (!nome.trim()) newErrors.nome = 'Nome completo é obrigatório.'
    if (!cpf.trim()) {
      newErrors.cpf = 'CPF é obrigatório.'
    } else if (!isValidCPF(cpf)) {
      newErrors.cpf = 'CPF inválido. Verifique os dígitos.'
    }

    if (!email.trim()) {
      newErrors.email = 'E-mail é obrigatório.'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'E-mail em formato inválido.'
    }

    if (!matricula.trim()) newErrors.matricula = 'Número de matrícula é obrigatório.'
    if (!dataAdmissao) newErrors.dataAdmissao = 'Data de admissão é obrigatória.'
    if (!cargoId) newErrors.cargoId = 'Selecione um cargo.'
    if (!departamentoId) newErrors.departamentoId = 'Selecione um departamento.'
    if (!jornadaId) newErrors.jornadaId = 'Selecione a jornada de trabalho.'

    if (situacao === 'desligado' && !dataDesligamento) {
      newErrors.dataDesligamento = 'Informe a data de desligamento.'
    }

    if (!isEditing && pinInicial) {
      if (!/^\d{4,6}$/.test(pinInicial)) {
        newErrors.pin = 'O PIN deve conter entre 4 e 6 dígitos numéricos.'
      } else if (pinInicial !== confirmaPinInicial) {
        newErrors.pinConfirm = 'A confirmação do PIN não confere.'
      }
    }

    // Uniqueness validation against database
    if (Object.keys(newErrors).length === 0) {
      const dupErrors = await funcionariosService.checkUniqueness(cpf, matricula, email, id)
      Object.assign(newErrors, dupErrors)
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const isValid = await validate()
    if (!isValid) {
      toast({
        title: 'Verifique os campos obrigatórios',
        description: 'Existem campos não preenchidos ou com valores inválidos.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)

    try {
      const formData = new FormData()
      formData.append('nome', nome.trim())
      formData.append('cpf', cleanDigits(cpf))
      if (dataNascimento) formData.append('data_nascimento', dataNascimento)
      formData.append('telefone', telefone.trim())
      formData.append('email', email.trim().toLowerCase())
      formData.append('endereco', endereco.trim())
      formData.append('contato_emergencia', contatoEmergencia.trim())
      formData.append('matricula', matricula.trim().toUpperCase())
      formData.append('data_admissao', dataAdmissao)
      formData.append('cargo', cargoId)
      formData.append('departamento', departamentoId)
      formData.append('tipo_vinculo', tipoVinculo)
      formData.append('jornada_atual', jornadaId)
      formData.append('situacao', situacao)
      if (situacao === 'desligado' && dataDesligamento) {
        formData.append('data_desligamento', dataDesligamento)
      } else {
        formData.append('data_desligamento', '')
      }

      // Salário e contrato (apenas gravado quando o usuário for admin)
      if (isAdmin) {
        const salNum = salarioContratual === '' ? 0 : Number(salarioContratual)
        formData.append('salario_contratual', String(salNum))
        if (dataInicioContrato) {
          formData.append('data_inicio_contrato', dataInicioContrato)
        }
        if (tipoContrato) {
          formData.append('tipo_contrato', tipoContrato)
        }
      }

      if (fotoFile) {
        formData.append('fotografia', fotoFile)
      }

      let savedId = id

      if (isEditing && id) {
        await funcionariosService.update(id, formData)

        // Registrar no histórico e auditoria
        await historicoService.create({
          funcionario: id,
          tipo: 'edicao',
          descricao: 'Cadastro do funcionário atualizado.',
          data: new Date().toISOString(),
          usuario_responsavel: user?.id,
        })

        // Se o admin alterou o salário contratual, registrar no histórico salarial e auditoria
        const salNum = salarioContratual === '' ? 0 : Number(salarioContratual)
        if (isAdmin && salNum !== salarioOriginal) {
          const descSalarial = `Alteração salarial de ${formatBRCurrency(salarioOriginal)} para ${formatBRCurrency(salNum)} na edição da ficha. Motivo: ${motivoAlteracaoSalarial.trim() || 'Ajuste contratual'}`
          await historicoService.create({
            funcionario: id,
            tipo: 'alteracao_salarial',
            descricao: descSalarial,
            data: new Date().toISOString(),
            usuario_responsavel: user?.id,
          })

          // Auditoria sensível
          try {
            await pb.collection('logs_auditoria').create({
              usuario: user?.id,
              acao: 'alteracao_salarial',
              entidade: 'funcionarios',
              entidade_id: id,
              detalhes: descSalarial,
              nivel: 'sensivel',
              data: new Date().toISOString(),
            })
          } catch (auditErr) {
            console.log('Erro ao gravar log de auditoria salarial:', auditErr)
          }
        }
      } else {
        // Create new employee
        const created = await funcionariosService.create(formData)
        savedId = created.id

        // Auto-create user auth record with role 'funcionario' if possible
        try {
          const randomPass = Math.random().toString(36).slice(-10) + 'A1!'
          const authUser = await pb.collection('users').create({
            email: email.trim().toLowerCase(),
            password: randomPass,
            passwordConfirm: randomPass,
            name: nome.trim(),
            nome: nome.trim(),
            role: 'funcionario',
            ativo: true,
            emailVisibility: false,
          })
          // Link user to funcionario
          await funcionariosService.update(created.id, { user: authUser.id })
        } catch (authErr) {
          console.log('Employee user auth creation notice:', authErr)
        }

        // If initial PIN was informed on creation, update it via terminalService
        if (pinInicial) {
          try {
            await terminalService.updatePin(created.id, pinInicial)
          } catch (pinErr) {
            console.log('Erro ao definir PIN inicial:', pinErr)
          }
        }
        // Add initial jornada to historico_jornadas
        if (jornadaId) {
          try {
            await historicoJornadasService.create({
              funcionario: created.id,
              jornada: jornadaId,
              data_inicio: dataAdmissao || new Date().toISOString().split('T')[0],
            })
          } catch {
            /* intentionally ignored */
          }
        }

        // Add historico entry
        await historicoService.create({
          funcionario: created.id,
          tipo: 'cadastro',
          descricao: 'Funcionário cadastrado no sistema.',
          data: new Date().toISOString(),
          usuario_responsavel: user?.id,
        })

        // Se cadastrou com salário inicial
        const salNum = salarioContratual === '' ? 0 : Number(salarioContratual)
        if (isAdmin && salNum > 0) {
          await historicoService.create({
            funcionario: created.id,
            tipo: 'alteracao_salarial',
            descricao: `Salário contratual inicial definido em ${formatBRCurrency(salNum)}.`,
            data: new Date().toISOString(),
            usuario_responsavel: user?.id,
          })
        }
      }

      toast({
        title: 'Funcionário salvo com sucesso.',
        description: 'Os dados foram persistidos no banco de dados.',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      })

      navigate(`/admin/funcionarios/${savedId}`)
    } catch (err: any) {
      console.error('Erro ao salvar funcionário:', err)
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Ocorreu um erro ao persistir o funcionário.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loadingInitial) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/admin/funcionarios">
            <Button variant="outline" size="sm" className="h-9 w-9 p-0 border-slate-200">
              <ArrowLeft className="w-4 h-4 text-slate-600" />
            </Button>
          </Link>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {isEditing ? 'Editar Funcionário' : 'Novo Funcionário'}
            </h2>
            <p className="text-xs text-slate-500">
              {isEditing
                ? 'Atualize as informações cadastrais e profissionais do colaborador'
                : 'Preencha os dados para admitir um novo funcionário na empresa'}
            </p>
          </div>
        </div>

        {/* Save button top-right (desktop) */}
        <div className="hidden sm:block">
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold text-xs sm:text-sm h-10 px-4 shadow-sm border-0 hover:brightness-110"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Funcionário'}
          </Button>
        </div>
      </div>

      {/* Main Form Card with Tabs */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        {/* Navigation Tabs Bar compacta em linha única */}
        <ScrollableTabsBar
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as 'pessoais' | 'profissionais' | 'contrato')}
          tabs={[
            {
              id: 'pessoais',
              label: 'Dados Pessoais',
              icon: <User className="w-4 h-4" />,
            },
            {
              id: 'profissionais',
              label: 'Dados Profissionais',
              icon: <Briefcase className="w-4 h-4" />,
            },
            {
              id: 'contrato',
              label: 'Salário e Contrato',
              icon: <DollarSign className="w-4 h-4" />,
              badge: (
                <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.2 rounded">
                  Admin
                </span>
              ),
              hidden: !isAdmin,
            },
          ]}
        />

        <form onSubmit={handleSubmit} className="p-6">
          {/* TAB 1: DADOS PESSOAIS */}
          {activeTab === 'pessoais' && (
            <div className="space-y-6">
              {/* Photo & Name Row */}
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                {/* Photo Upload */}
                <div className="space-y-2 shrink-0">
                  <Label className="text-xs font-semibold text-slate-700">
                    Fotografia (JPG/PNG)
                  </Label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center">
                      {fotoPreview ? (
                        <img
                          src={fotoPreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-8 h-8 text-slate-300" />
                      )}
                    </div>
                    <div>
                      <input
                        type="file"
                        id="fotoUpload"
                        accept="image/png,image/jpeg"
                        onChange={handleFotoChange}
                        className="hidden"
                      />
                      <label htmlFor="fotoUpload">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          asChild
                          className="h-8 text-xs border-slate-200 cursor-pointer"
                        >
                          <span>
                            <Upload className="w-3.5 h-3.5 mr-1 text-slate-500" />
                            {fotoPreview ? 'Trocar foto' : 'Enviar foto'}
                          </span>
                        </Button>
                      </label>
                      <p className="text-[11px] text-slate-400 mt-1">Máx. 2MB</p>
                    </div>
                  </div>
                </div>

                {/* Nome Completo */}
                <div className="flex-1 w-full space-y-1.5">
                  <Label htmlFor="nome" className="text-xs font-semibold text-slate-700">
                    Nome Completo <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="nome"
                    required
                    placeholder="Ex: Carlos Eduardo de Oliveira"
                    value={nome}
                    onChange={(e) => {
                      setNome(e.target.value)
                      if (errors.nome) setErrors({ ...errors, nome: '' })
                    }}
                    className={`h-10 text-xs sm:text-sm ${errors.nome ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                  />
                  {errors.nome && (
                    <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.nome}
                    </p>
                  )}
                </div>
              </div>

              {/* CPF, Data de Nascimento, Telefone */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* CPF */}
                <div className="space-y-1.5">
                  <Label htmlFor="cpf" className="text-xs font-semibold text-slate-700">
                    CPF <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="cpf"
                    required
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => {
                      setCpf(maskCPF(e.target.value))
                      if (errors.cpf) setErrors({ ...errors, cpf: '' })
                    }}
                    className={`h-10 text-xs sm:text-sm font-mono ${errors.cpf ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                  />
                  {errors.cpf && (
                    <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.cpf}
                    </p>
                  )}
                </div>

                {/* Data de Nascimento */}
                <div className="space-y-1.5">
                  <Label htmlFor="dataNascimento" className="text-xs font-semibold text-slate-700">
                    Data de Nascimento
                  </Label>
                  <Input
                    id="dataNascimento"
                    type="date"
                    value={dataNascimento}
                    onChange={(e) => handleDataNascimentoChange(e.target.value)}
                    className="h-10 text-xs sm:text-sm"
                  />
                  {dataNascimento && !isEditing && (
                    <p className="text-[11px] text-[#854d0e] flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#D4AF37]" />
                      PIN padrão sugerido: {derivarPinDataNascimento(dataNascimento) || 'DDMMAA'}
                    </p>
                  )}
                </div>

                {/* Telefone */}
                <div className="space-y-1.5">
                  <Label htmlFor="telefone" className="text-xs font-semibold text-slate-700">
                    Telefone / WhatsApp
                  </Label>
                  <Input
                    id="telefone"
                    placeholder="(00) 00000-0000"
                    value={telefone}
                    onChange={(e) => setTelefone(maskPhone(e.target.value))}
                    className="h-10 text-xs sm:text-sm font-mono"
                  />
                </div>
              </div>

              {/* E-mail */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                  E-mail institucional/pessoal <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="funcionario@empresa.com.br"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errors.email) setErrors({ ...errors, email: '' })
                  }}
                  className={`h-10 text-xs sm:text-sm ${errors.email ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                />
                {errors.email && (
                  <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Endereço */}
              <div className="space-y-1.5">
                <Label htmlFor="endereco" className="text-xs font-semibold text-slate-700">
                  Endereço Residencial
                </Label>
                <Input
                  id="endereco"
                  placeholder="Rua, número, complemento, bairro, cidade - UF"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  className="h-10 text-xs sm:text-sm"
                />
              </div>

              {/* Contato de Emergência */}
              <div className="space-y-1.5">
                <Label htmlFor="contatoEmergencia" className="text-xs font-semibold text-slate-700">
                  Contato de Emergência (Nome e Telefone)
                </Label>
                <Input
                  id="contatoEmergencia"
                  placeholder="Ex: Maria (Esposa) - (11) 98888-7777"
                  value={contatoEmergencia}
                  onChange={(e) => setContatoEmergencia(e.target.value)}
                  className="h-10 text-xs sm:text-sm"
                />
              </div>

              {/* Next Tab Button */}
              <div className="pt-4 flex justify-end">
                <Button
                  type="button"
                  onClick={() => setActiveTab('profissionais')}
                  className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold text-xs h-10 px-4 border-0 hover:brightness-110"
                >
                  Avançar para Dados Profissionais
                </Button>
              </div>
            </div>
          )}

          {/* TAB 2: DADOS PROFISSIONAIS */}
          {activeTab === 'profissionais' && (
            <div className="space-y-6">
              {/* Matrícula, Admissão, Vínculo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Matrícula */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="matricula" className="text-xs font-semibold text-slate-700">
                      Número de Matrícula <span className="text-red-500">*</span>
                    </Label>
                    {!isEditing && (
                      <span className="text-[10px] text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
                        Sequencial sugerido
                      </span>
                    )}
                  </div>
                  <Input
                    id="matricula"
                    required
                    placeholder="Ex: 001, 1024"
                    value={matricula}
                    onChange={(e) => {
                      setMatricula(e.target.value.toUpperCase())
                      if (errors.matricula) setErrors({ ...errors, matricula: '' })
                    }}
                    className={`h-10 text-xs sm:text-sm font-mono ${errors.matricula ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                  />
                  {errors.matricula && (
                    <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.matricula}
                    </p>
                  )}
                </div>

                {/* Data de Admissão */}
                <div className="space-y-1.5">
                  <Label htmlFor="dataAdmissao" className="text-xs font-semibold text-slate-700">
                    Data de Admissão <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dataAdmissao"
                    type="date"
                    required
                    value={dataAdmissao}
                    onChange={(e) => {
                      setDataAdmissao(e.target.value)
                      if (errors.dataAdmissao) setErrors({ ...errors, dataAdmissao: '' })
                    }}
                    className="h-10 text-xs sm:text-sm"
                  />
                </div>

                {/* Tipo de Vínculo */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Tipo de Vínculo <span className="text-red-500">*</span>
                  </Label>
                  <Select value={tipoVinculo} onValueChange={(val) => setTipoVinculo(val)}>
                    <SelectTrigger className="h-10 text-xs sm:text-sm border-slate-200">
                      <SelectValue placeholder="Selecione o vínculo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLT">CLT (Efetivo)</SelectItem>
                      <SelectItem value="Estágio">Estágio</SelectItem>
                      <SelectItem value="PJ">Pessoa Jurídica (PJ)</SelectItem>
                      <SelectItem value="Terceirizado">Terceirizado</SelectItem>
                      <SelectItem value="Aprendiz">Jovem Aprendiz</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Cargo e Departamento with Inline Create */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cargo */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">
                      Cargo <span className="text-red-500">*</span>
                    </Label>
                    <button
                      type="button"
                      onClick={() => setNewCargoModal(true)}
                      className="text-[11px] font-bold text-[#D4AF37] hover:underline flex items-center"
                    >
                      <Plus className="w-3 h-3 mr-0.5" />
                      Novo cargo
                    </button>
                  </div>
                  <Select value={cargoId} onValueChange={(val) => setCargoId(val)}>
                    <SelectTrigger className="h-10 text-xs sm:text-sm border-slate-200">
                      <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      {cargos.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.cargoId && (
                    <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.cargoId}
                    </p>
                  )}
                </div>

                {/* Departamento */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">
                      Departamento <span className="text-red-500">*</span>
                    </Label>
                    <button
                      type="button"
                      onClick={() => setNewDepModal(true)}
                      className="text-[11px] font-bold text-[#D4AF37] hover:underline flex items-center"
                    >
                      <Plus className="w-3 h-3 mr-0.5" />
                      Novo depto.
                    </button>
                  </div>{' '}
                  <Select value={departamentoId} onValueChange={(val) => setDepartamentoId(val)}>
                    <SelectTrigger className="h-10 text-xs sm:text-sm border-slate-200">
                      <SelectValue placeholder="Selecione o departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {departamentos.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.departamentoId && (
                    <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.departamentoId}
                    </p>
                  )}
                </div>
              </div>

              {/* PIN Inicial do Terminal (quando for novo funcionário) */}
              {!isEditing && (
                <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-[#D4AF37]" />
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        PIN do Terminal Coletivo (Padrão: Data de Nascimento DDMMAA)
                      </span>
                    </div>
                    {dataNascimento && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const p = derivarPinDataNascimento(dataNascimento)
                          if (p) {
                            setPinInicial(p)
                            setConfirmaPinInicial(p)
                            setPinEditadoManualmente(false)
                            toast({
                              title: 'PIN padrão aplicado',
                              description: `PIN preenchido como ${p} (DDMMAA)`,
                            })
                          }
                        }}
                        className="text-[11px] h-7 text-[#854d0e] hover:bg-amber-100"
                      >
                        <Sparkles className="w-3 h-3 mr-1 text-[#D4AF37]" />
                        Usar data de nascimento (
                        {derivarPinDataNascimento(dataNascimento) || 'DDMMAA'})
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-slate-600">
                    Por padrão do sistema, o PIN inicial é sugerido automaticamente com a data de
                    nascimento do colaborador em 6 dígitos (DDMMAA). O PIN continua editável e é
                    armazenado com hash criptográfico seguro.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <Label htmlFor="pinInicial" className="text-xs font-semibold text-slate-700">
                        PIN (6 dígitos numéricos DDMMAA)
                      </Label>
                      <Input
                        id="pinInicial"
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Ex: 131070"
                        value={pinInicial}
                        onChange={(e) => {
                          setPinEditadoManualmente(true)
                          setPinInicial(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }}
                        className={`h-10 text-xs sm:text-sm font-mono tracking-widest bg-white ${
                          errors.pin ? 'border-red-400 focus-visible:ring-red-400' : ''
                        }`}
                      />
                      {errors.pin && (
                        <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.pin}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="confirmaPinInicial"
                        className="text-xs font-semibold text-slate-700"
                      >
                        Confirme o PIN
                      </Label>
                      <Input
                        id="confirmaPinInicial"
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Ex: 131070"
                        value={confirmaPinInicial}
                        onChange={(e) =>
                          setConfirmaPinInicial(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        className={`h-10 text-xs sm:text-sm font-mono tracking-widest bg-white ${
                          errors.pinConfirm ? 'border-red-400 focus-visible:ring-red-400' : ''
                        }`}
                      />
                      {errors.pinConfirm && (
                        <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.pinConfirm}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Jornada & Situação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Jornada */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Jornada de Trabalho <span className="text-red-500">*</span>
                  </Label>
                  <Select value={jornadaId} onValueChange={(val) => setJornadaId(val)}>
                    <SelectTrigger className="h-10 text-xs sm:text-sm border-slate-200">
                      <SelectValue placeholder="Selecione a jornada" />
                    </SelectTrigger>
                    <SelectContent>
                      {jornadas.map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.nome}{' '}
                          {j.grade_semanal && Object.keys(j.grade_semanal).length > 0
                            ? '(Horários flexíveis por dia)'
                            : `(${j.hora_entrada} - ${j.hora_saida})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.jornadaId && (
                    <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.jornadaId}
                    </p>
                  )}
                </div>

                {/* Situação */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Situação Atual <span className="text-red-500">*</span>
                  </Label>
                  <Select value={situacao} onValueChange={(val) => setSituacao(val)}>
                    <SelectTrigger className="h-10 text-xs sm:text-sm border-slate-200">
                      <SelectValue placeholder="Situação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="afastado">Afastado</SelectItem>
                      <SelectItem value="em_ferias">Em Férias</SelectItem>
                      <SelectItem value="desligado">Desligado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Data de Desligamento (conditional) */}
              {situacao === 'desligado' && (
                <div className="p-4 bg-red-50/60 border border-red-200 rounded-xl space-y-2">
                  <Label htmlFor="dataDesligamento" className="text-xs font-semibold text-red-900">
                    Data do Desligamento <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="dataDesligamento"
                    type="date"
                    required
                    value={dataDesligamento}
                    onChange={(e) => setDataDesligamento(e.target.value)}
                    className="h-10 text-xs sm:text-sm max-w-xs bg-white"
                  />
                  {errors.dataDesligamento && (
                    <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.dataDesligamento}
                    </p>
                  )}
                </div>
              )}

              {/* Bottom Actions */}
              <div className="pt-6 flex items-center justify-between border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveTab('pessoais')}
                  className="text-xs border-slate-200"
                >
                  Voltar para Dados Pessoais
                </Button>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab('contrato')}
                      className="text-xs border-slate-200"
                    >
                      Avançar para Salário e Contrato
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold text-xs sm:text-sm h-10 px-5 shadow-sm border-0 hover:brightness-110"
                  >
                    <Save className="w-4 h-4 mr-1.5" />
                    {saving
                      ? 'Salvando...'
                      : isEditing
                        ? 'Salvar Alterações'
                        : 'Cadastrar Funcionário'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SALÁRIO E CONTRATO (ADMIN ONLY) */}
          {isAdmin && activeTab === 'contrato' && (
            <div className="space-y-6">
              <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                <div className="text-xs text-amber-950 space-y-1">
                  <p className="font-bold uppercase tracking-wider">
                    Área Restrita aos Administradores
                  </p>
                  <p className="text-slate-600">
                    Os valores salariais e termos contratuais são estritamente sigilosos e nunca são
                    exibidos para colaboradores comuns nem no Portal do Colaborador. Todas as
                    alterações salariais são auditadas e registradas no histórico salarial do
                    funcionário.
                  </p>
                </div>
              </div>

              {/* Salário, Tipo de Contrato, Início do Contrato */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Salário Contratual */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="salarioContratual"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Salário Contratual (R$)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      R$
                    </span>
                    <Input
                      id="salarioContratual"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={salarioContratual}
                      onChange={(e) =>
                        setSalarioContratual(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      className="pl-9 h-10 text-xs sm:text-sm font-mono"
                    />
                  </div>
                  {isEditing && salarioOriginal > 0 && (
                    <p className="text-[11px] text-slate-500">
                      Salário atual gravado: {formatBRCurrency(salarioOriginal)}
                    </p>
                  )}
                </div>

                {/* Tipo de Contrato */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Tipo de Contrato</Label>
                  <Select
                    value={tipoContrato}
                    onValueChange={(val) => {
                      setTipoContrato(val)
                      // Sincroniza opcionalmente com tipoVinculo se estiver idêntico
                      if (val) setTipoVinculo(val)
                    }}
                  >
                    <SelectTrigger className="h-10 text-xs sm:text-sm border-slate-200">
                      <SelectValue placeholder="Selecione o contrato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLT">CLT (Consolidação das Leis do Trabalho)</SelectItem>
                      <SelectItem value="Estágio">Termo de Compromisso de Estágio</SelectItem>
                      <SelectItem value="PJ">Prestação de Serviços (PJ)</SelectItem>
                      <SelectItem value="Terceirizado">Contrato Terceirizado</SelectItem>
                      <SelectItem value="Aprendiz">Contrato de Aprendizagem</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Data de Início do Contrato */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="dataInicioContrato"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Início da Vigência Contratual
                  </Label>
                  <Input
                    id="dataInicioContrato"
                    type="date"
                    value={dataInicioContrato}
                    onChange={(e) => setDataInicioContrato(e.target.value)}
                    className="h-10 text-xs sm:text-sm"
                  />
                  <p className="text-[11px] text-slate-400">
                    Geralmente idêntico à data de admissão ({formatBRDate(dataAdmissao) || '—'}).
                  </p>
                </div>
              </div>

              {/* Justificativa / Motivo da alteração salarial (se em edição e salário foi alterado) */}
              {isEditing &&
                salarioContratual !== '' &&
                Number(salarioContratual) !== salarioOriginal && (
                  <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                    <Label
                      htmlFor="motivoAlteracaoSalarial"
                      className="text-xs font-semibold text-blue-900"
                    >
                      Justificativa / Motivo do Reajuste Salarial (Obrigatório para Auditoria)
                    </Label>
                    <Input
                      id="motivoAlteracaoSalarial"
                      placeholder="Ex: Dissídio anual, promoção de cargo, mérito profissional..."
                      value={motivoAlteracaoSalarial}
                      onChange={(e) => setMotivoAlteracaoSalarial(e.target.value)}
                      className="h-10 text-xs sm:text-sm bg-white"
                    />
                    <p className="text-[11px] text-blue-700">
                      Esta informação será gravada no histórico salarial do funcionário e nos logs
                      de auditoria.
                    </p>
                  </div>
                )}

              {/* Bottom Actions */}
              <div className="pt-6 flex items-center justify-between border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveTab('profissionais')}
                  className="text-xs border-slate-200"
                >
                  Voltar para Dados Profissionais
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold text-xs sm:text-sm h-10 px-5 shadow-sm border-0 hover:brightness-110"
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  {saving
                    ? 'Salvando...'
                    : isEditing
                      ? 'Salvar Alterações Contratuais'
                      : 'Cadastrar Funcionário'}
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Sticky Save Button on Mobile */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-[#E2E8F0] z-30 shadow-lg">
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold h-11 border-0 hover:brightness-110"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar Funcionário'}
        </Button>
      </div>

      {/* Modal: Novo Cargo Inline */}
      <Dialog open={newCargoModal} onOpenChange={setNewCargoModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Cargo</DialogTitle>
            <DialogDescription>Cadastre um novo título de cargo no sistema.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCargoInline} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="inlineCargoNome" className="text-xs font-semibold">
                Nome do Cargo
              </Label>
              <Input
                id="inlineCargoNome"
                placeholder="Ex: Assistente de Produção"
                value={newCargoNome}
                onChange={(e) => setNewCargoNome(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewCargoModal(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold border-0 hover:brightness-110"
              >
                Cadastrar Cargo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Novo Departamento Inline */}
      <Dialog open={newDepModal} onOpenChange={setNewDepModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Departamento</DialogTitle>
            <DialogDescription>Cadastre um novo departamento no sistema.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateDepInline} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="inlineDepNome" className="text-xs font-semibold">
                Nome do Departamento
              </Label>
              <Input
                id="inlineDepNome"
                placeholder="Ex: Recursos Humanos"
                value={newDepNome}
                onChange={(e) => setNewDepNome(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewDepModal(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold border-0 hover:brightness-110"
              >
                Cadastrar Departamento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
