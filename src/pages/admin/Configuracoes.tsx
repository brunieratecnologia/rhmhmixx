import React, { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { empresaService, usersService } from '@/services/rh'
import type { Empresa, User } from '@/types/rh'
import { maskCNPJ, maskPhone } from '@/lib/formatters'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/hooks/use-toast'
import {
  Building2,
  Users,
  Save,
  Upload,
  UserPlus,
  KeyRound,
  Trash2,
  Edit2,
  AlertCircle,
  Eye,
  EyeOff,
  Clock,
  Plus,
} from 'lucide-react'
import JornadaModal from '@/components/admin/JornadaModal'
import { jornadasService } from '@/services/rh'
import type { Jornada } from '@/types/rh'
import { minutesToHoursText } from '@/lib/calculoHoras'
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

export default function Configuracoes() {
  const { user: currentUser } = useAuth()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<'empresa' | 'usuarios' | 'jornadas'>('empresa')
  const [jornadasList, setJornadasList] = useState<Jornada[]>([])
  const [jornadaModalOpen, setJornadaModalOpen] = useState(false)
  const [editingJornada, setEditingJornada] = useState<Jornada | null>(null)
  const [jornadaToDelete, setJornadaToDelete] = useState<Jornada | null>(null)
  const [deletingJornadaModal, setDeletingJornadaModal] = useState(false)
  const [deletingJornada, setDeletingJornada] = useState(false)

  // Empresa Form State
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [razaoSocial, setRazaoSocial] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [endereco, setEndereco] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [fusoHorario, setFusoHorario] = useState('America/Sao_Paulo')
  const [responsavelRh, setResponsavelRh] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [savingEmpresa, setSavingEmpresa] = useState(false)

  // Usuários Admin State
  const [adminUsers, setAdminUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // User Modals
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userPassword, setUserPassword] = useState('')
  const [userPasswordConfirm, setUserPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [userError, setUserError] = useState('')
  const [savingUser, setSavingUser] = useState(false)

  // Delete User Modal
  const [deleteUserModal, setDeleteUserModal] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [deletingUser, setDeletingUser] = useState(false)

  const loadEmpresa = async () => {
    try {
      const emp = await empresaService.get()
      if (emp) {
        setEmpresa(emp)
        setRazaoSocial(emp.razao_social || '')
        setNomeFantasia(emp.nome_fantasia || '')
        setCnpj(maskCNPJ(emp.cnpj || ''))
        setEndereco(emp.endereco || '')
        setTelefone(maskPhone(emp.telefone || ''))
        setEmail(emp.email || '')
        setFusoHorario(emp.fuso_horario || 'America/Sao_Paulo')
        setResponsavelRh(emp.responsavel_rh || '')
        if (emp.logotipo) {
          setLogoPreview(pb.files.getURL(emp, emp.logotipo))
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados da empresa:', err)
    }
  }

  const loadUsers = async () => {
    setLoadingUsers(true)
    try {
      const admins = await usersService.listAdmins()
      setAdminUsers(admins)
    } catch (err) {
      console.error('Erro ao carregar usuários admin:', err)
    } finally {
      setLoadingUsers(false)
    }
  }

  const loadJornadas = async () => {
    try {
      const list = await jornadasService.list()
      setJornadasList(list)
    } catch (err) {
      console.error('Erro ao carregar jornadas:', err)
    }
  }

  useEffect(() => {
    loadEmpresa()
    loadUsers()
    loadJornadas()
  }, [])

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: 'Arquivo muito grande',
          description: 'O logotipo deve ter no máximo 2MB.',
          variant: 'destructive',
        })
        return
      }
      setLogoFile(file)
      setLogoPreview(URL.createObjectURL(file))
    }
  }

  const handleSaveEmpresa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empresa) return

    setSavingEmpresa(true)
    try {
      const formData = new FormData()
      formData.append('razao_social', razaoSocial.trim())
      formData.append('nome_fantasia', nomeFantasia.trim())
      formData.append('cnpj', cnpj.trim())
      formData.append('endereco', endereco.trim())
      formData.append('telefone', telefone.trim())
      formData.append('email', email.trim())
      formData.append('fuso_horario', fusoHorario)
      formData.append('responsavel_rh', responsavelRh.trim())
      if (logoFile) {
        formData.append('logotipo', logoFile)
      }

      await empresaService.update(empresa.id, formData)
      toast({
        title: 'Dados da empresa salvos.',
        description: 'As configurações da empresa foram atualizadas com sucesso.',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      })
      loadEmpresa()
    } catch (err: any) {
      console.error('Erro ao atualizar empresa:', err)
      toast({
        title: 'Erro ao salvar empresa',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setSavingEmpresa(false)
    }
  }

  const handleOpenNewUser = () => {
    setEditingUser(null)
    setUserName('')
    setUserEmail('')
    setUserPassword('')
    setUserPasswordConfirm('')
    setUserError('')
    setUserModalOpen(true)
  }

  const handleOpenEditUser = (u: User) => {
    setEditingUser(u)
    setUserName(u.name || u.nome || '')
    setUserEmail(u.email || '')
    setUserPassword('')
    setUserPasswordConfirm('')
    setUserError('')
    setUserModalOpen(true)
  }

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setUserError('')

    if (!userName.trim()) {
      setUserError('O nome é obrigatório.')
      return
    }

    if (!userEmail.trim()) {
      setUserError('O e-mail é obrigatório.')
      return
    }

    if (!editingUser) {
      if (!userPassword || userPassword.length < 8) {
        setUserError('A senha deve ter no mínimo 8 caracteres.')
        return
      }
      if (userPassword !== userPasswordConfirm) {
        setUserError('As senhas digitadas não conferem.')
        return
      }
    }

    setSavingUser(true)
    try {
      if (editingUser) {
        await usersService.updateAdmin(editingUser.id, {
          name: userName.trim(),
          nome: userName.trim(),
        })
        toast({
          title: 'Usuário atualizado.',
          className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        })
      } else {
        await usersService.createAdmin({
          name: userName.trim(),
          email: userEmail.trim(),
          password: userPassword,
          passwordConfirm: userPasswordConfirm,
        })
        toast({
          title: 'Usuário cadastrado com sucesso.',
          className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        })
      }
      setUserModalOpen(false)
      loadUsers()
    } catch (err: any) {
      setUserError(err?.message || 'Erro ao persistir usuário.')
    } finally {
      setSavingUser(false)
    }
  }

  const handleResetPassword = async (u: User) => {
    try {
      await usersService.requestPasswordReset(u.email)
      toast({
        title: 'Link de redefinição enviado.',
        description: `Enviamos um link para o e-mail ${u.email}.`,
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao enviar redefinição',
        description: err?.message,
        variant: 'destructive',
      })
    }
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return
    setDeletingUser(true)
    try {
      await usersService.delete(userToDelete.id)
      toast({
        title: 'Usuário excluído.',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      })
      setDeleteUserModal(false)
      setUserToDelete(null)
      loadUsers()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir usuário',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setDeletingUser(false)
    }
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Page Title Card */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Configurações</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Parâmetros institucionais da empresa e credenciais de acesso administrativo
        </p>
      </div>

      {/* Tabs Container */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        {/* Navigation Tabs (Blue Underline) */}
        <div className="flex border-b border-slate-200 px-6 pt-3 gap-6">
          <button
            onClick={() => setActiveTab('empresa')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'empresa'
                ? 'border-[#D4AF37] text-amber-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Building2 className="w-4 h-4 mr-2 text-[#D4AF37]" />
            Dados da Empresa
          </button>
          <button
            onClick={() => setActiveTab('jornadas')}
            className={`flex items-center pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'jornadas'
                ? 'border-[#D4AF37] text-amber-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock className="w-4 h-4 mr-2 text-[#D4AF37]" />
            Jornadas de Trabalho
          </button>
          <button
            onClick={() => setActiveTab('usuarios')}
            className={`flex items-center pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'usuarios'
                ? 'border-[#D4AF37] text-amber-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4 mr-2 text-[#D4AF37]" />
            Acessos Administrativos
          </button>{' '}
        </div>

        {/* TAB 1: EMPRESA */}
        {activeTab === 'empresa' && (
          <form onSubmit={handleSaveEmpresa} className="p-6 space-y-6">
            {/* Logo Upload Section */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">
                Logotipo da Empresa (JPG/PNG máx 2MB)
              </Label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo"
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <Building2 className="w-8 h-8 text-slate-300" />
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    id="logoUpload"
                    accept="image/png,image/jpeg"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <label htmlFor="logoUpload">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-8 text-xs border-slate-200 cursor-pointer"
                    >
                      <span>
                        <Upload className="w-3.5 h-3.5 mr-1 text-slate-500" />
                        {logoPreview ? 'Alterar logotipo' : 'Enviar logotipo'}
                      </span>
                    </Button>
                  </label>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Exibido na barra lateral e relatórios
                  </p>
                </div>
              </div>
            </div>

            {/* Razão Social e Nome Fantasia */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="razaoSocial" className="text-xs font-semibold text-slate-700">
                  Razão Social
                </Label>
                <Input
                  id="razaoSocial"
                  placeholder="Ex: Minha Empresa LTDA"
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  className="h-10 text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nomeFantasia" className="text-xs font-semibold text-slate-700">
                  Nome Fantasia
                </Label>
                <Input
                  id="nomeFantasia"
                  placeholder="Ex: Minha Empresa"
                  value={nomeFantasia}
                  onChange={(e) => setNomeFantasia(e.target.value)}
                  className="h-10 text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* CNPJ, Telefone, E-mail */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cnpj" className="text-xs font-semibold text-slate-700">
                  CNPJ
                </Label>
                <Input
                  id="cnpj"
                  placeholder="00.000.000/0000-00"
                  value={cnpj}
                  onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
                  className="h-10 text-xs sm:text-sm font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="telefone" className="text-xs font-semibold text-slate-700">
                  Telefone de Contato
                </Label>
                <Input
                  id="telefone"
                  placeholder="(00) 0000-0000"
                  value={telefone}
                  onChange={(e) => setTelefone(maskPhone(e.target.value))}
                  className="h-10 text-xs sm:text-sm font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                  E-mail Institucional
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contato@empresa.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-1.5">
              <Label htmlFor="endereco" className="text-xs font-semibold text-slate-700">
                Endereço Completo
              </Label>
              <Input
                id="endereco"
                placeholder="Avenida Paulista, 1000 - Bela Vista, São Paulo - SP"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                className="h-10 text-xs sm:text-sm"
              />
            </div>

            {/* Fuso Horário e Responsável RH */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Fuso Horário do Sistema
                </Label>
                <Select value={fusoHorario} onValueChange={(val) => setFusoHorario(val)}>
                  <SelectTrigger className="h-10 text-xs sm:text-sm border-slate-200">
                    <SelectValue placeholder="Selecione o fuso" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Sao_Paulo">Brasília / São Paulo (GMT-3)</SelectItem>
                    <SelectItem value="America/Manaus">Manaus (GMT-4)</SelectItem>
                    <SelectItem value="America/Cuiaba">Cuiabá (GMT-4)</SelectItem>
                    <SelectItem value="America/Belem">Belém (GMT-3)</SelectItem>
                    <SelectItem value="America/Fortaleza">Fortaleza (GMT-3)</SelectItem>
                    <SelectItem value="America/Rio_Branco">Rio Branco (GMT-5)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="responsavelRh" className="text-xs font-semibold text-slate-700">
                  Responsável pelo RH
                </Label>
                <Input
                  id="responsavelRh"
                  placeholder="Ex: Gestor de Recursos Humanos"
                  value={responsavelRh}
                  onChange={(e) => setResponsavelRh(e.target.value)}
                  className="h-10 text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 flex justify-end">
              <Button
                type="submit"
                disabled={savingEmpresa}
                className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold text-xs sm:text-sm h-10 px-5 shadow-sm border-0 hover:brightness-110"
              >
                <Save className="w-4 h-4 mr-2" />
                {savingEmpresa ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        )}

        {/* TAB 3: JORNADAS DE TRABALHO */}
        {activeTab === 'jornadas' && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Jornadas e Escalas Cadastradas
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Modelos de jornadas flexíveis, com suporte a turnos noturnos e escalas
                  individualizadas
                </p>
              </div>
              <Button
                onClick={() => {
                  setEditingJornada(null)
                  setJornadaModalOpen(true)
                }}
                className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold text-xs sm:text-sm h-9 px-3.5 shadow-sm border-0 hover:brightness-110"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Nova Jornada
              </Button>{' '}
            </div>

            {jornadasList.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50">
                <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">Nenhuma jornada cadastrada</p>
                <p className="text-xs text-slate-500 mt-1">
                  Cadastre jornadas para associar aos funcionários da empresa.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold text-xs">
                      <th className="py-3 px-4">Nome da Jornada</th>
                      <th className="py-3 px-4">Horários Previstos</th>
                      <th className="py-3 px-4">Dias de Trabalho</th>
                      <th className="py-3 px-4">Carga Diária</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {jornadasList.map((j) => (
                      <tr key={j.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">{j.nome}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {j.atravessa_meia_noite && (
                              <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-medium">
                                Turno Noturno (Virada de Dia)
                              </span>
                            )}
                            {j.tipo_escala && j.tipo_escala !== 'semanal_fixa' && (
                              <span className="text-[10px] bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full font-medium capitalize">
                                {j.tipo_escala.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-mono text-xs">
                          {j.hora_entrada || '--:--'} às {j.hora_saida || '--:--'}
                          {j.hora_inicio_intervalo && j.hora_retorno_intervalo && (
                            <span className="text-slate-400 block text-[11px]">
                              Int: {j.hora_inicio_intervalo} - {j.hora_retorno_intervalo}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-xs">
                          <div className="flex items-center gap-1 flex-wrap">
                            {(j.dias_trabalho || []).map((d) => (
                              <span
                                key={d}
                                className="bg-slate-100 text-slate-700 font-semibold uppercase text-[10px] px-1.5 py-0.5 rounded"
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-800 text-xs">
                          {minutesToHoursText(j.duracao_jornada_min || 0)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingJornada(j)
                                setJornadaModalOpen(true)
                              }}
                              className="h-8 w-8 p-0 border-slate-200 text-slate-600 hover:text-[#D4AF37]"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setJornadaToDelete(j)
                                setDeletingJornadaModal(true)
                              }}
                              className="h-8 w-8 p-0 border-slate-200 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: USUÁRIOS ADMINISTRATIVOS */}
        {activeTab === 'usuarios' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Administradores do Sistema</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Usuários com privilégio de acesso total ao painel administrativo
                </p>
              </div>
              <Button
                onClick={handleOpenNewUser}
                className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold text-xs sm:text-sm h-9 px-3.5 shadow-sm border-0 hover:brightness-110"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Novo Usuário
              </Button>{' '}
            </div>

            {/* Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold text-xs">
                    <th className="py-3 px-4">Nome</th>
                    <th className="py-3 px-4">E-mail</th>
                    <th className="py-3 px-4">Situação</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adminUsers.map((u) => {
                    const isCurrent = currentUser?.id === u.id
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {u.name || u.nome}
                          {isCurrent && (
                            <span className="ml-2 text-[10px] font-bold bg-[#D4AF37]/20 text-amber-900 border border-[#D4AF37]/40 px-2 py-0.5 rounded-full">
                              Você
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono">{u.email}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Ativo
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Reset Password */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResetPassword(u)}
                              title="Redefinir Senha"
                              className="h-8 w-8 p-0 border-slate-200 text-slate-600 hover:text-[#D4AF37]"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </Button>

                            {/* Edit */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditUser(u)}
                              title="Editar"
                              className="h-8 w-8 p-0 border-slate-200 text-slate-600 hover:text-[#D4AF37]"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>

                            {/* Delete (disabled for self) */}
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isCurrent}
                              onClick={() => {
                                setUserToDelete(u)
                                setDeleteUserModal(true)
                              }}
                              title={
                                isCurrent ? 'Não é possível excluir o próprio usuário' : 'Excluir'
                              }
                              className="h-8 w-8 p-0 border-slate-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
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
          </div>
        )}
      </div>

      {/* Jornada Modal (Criar / Editar) */}
      <JornadaModal
        open={jornadaModalOpen}
        onOpenChange={setJornadaModalOpen}
        jornada={editingJornada}
        onSave={async (data) => {
          if (editingJornada) {
            await jornadasService.update(editingJornada.id, data)
            toast({
              title: 'Jornada atualizada.',
              className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
            })
          } else {
            await jornadasService.create(data)
            toast({
              title: 'Jornada criada com sucesso.',
              className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
            })
          }
          loadJornadas()
        }}
      />

      {/* Modal Excluir Jornada */}
      <Dialog open={deletingJornadaModal} onOpenChange={setDeletingJornadaModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir Jornada</DialogTitle>
            <DialogDescription>
              Deseja remover a jornada <strong>{jornadaToDelete?.nome}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={deletingJornada}
              onClick={() => setDeletingJornadaModal(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={deletingJornada}
              onClick={async () => {
                if (!jornadaToDelete) return
                setDeletingJornada(true)
                try {
                  await jornadasService.delete(jornadaToDelete.id)
                  toast({
                    title: 'Jornada excluída com sucesso.',
                    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                  })
                  setDeletingJornadaModal(false)
                  loadJornadas()
                } catch (err: any) {
                  toast({
                    title: 'Erro ao excluir jornada',
                    description: err?.message,
                    variant: 'destructive',
                  })
                } finally {
                  setDeletingJornada(false)
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingJornada ? 'Excluindo...' : 'Confirmar Exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Criar / Editar Usuário */}
      <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Editar Usuário' : 'Novo Usuário Administrador'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Atualize o nome e os dados cadastrais deste administrador.'
                : 'Cadastre um novo usuário com privilégios de administração.'}
            </DialogDescription>
          </DialogHeader>

          {userError && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{userError}</span>
            </div>
          )}

          <form onSubmit={handleSaveUser} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="adminName" className="text-xs font-semibold">
                Nome Completo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="adminName"
                required
                placeholder="Ex: João da Silva"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adminEmail" className="text-xs font-semibold">
                E-mail de Acesso <span className="text-red-500">*</span>
              </Label>
              <Input
                id="adminEmail"
                type="email"
                required
                disabled={Boolean(editingUser)}
                placeholder="admin@empresa.com.br"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
              />
            </div>

            {!editingUser && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="adminPass" className="text-xs font-semibold">
                    Senha (mín. 8 caracteres) <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="adminPass"
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adminPassConfirm" className="text-xs font-semibold">
                    Confirmar Senha <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="adminPassConfirm"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={userPasswordConfirm}
                    onChange={(e) => setUserPasswordConfirm(e.target.value)}
                  />
                </div>
              </>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setUserModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingUser}
                className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold border-0 hover:brightness-110"
              >
                {savingUser ? 'Salvando...' : 'Salvar Usuário'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Excluir Usuário */}
      <Dialog open={deleteUserModal} onOpenChange={setDeleteUserModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir Usuário Administrador</DialogTitle>
            <DialogDescription>
              Tem certeza de que deseja revogar o acesso de{' '}
              <strong>{userToDelete?.name || userToDelete?.nome || userToDelete?.email}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={deletingUser}
              onClick={() => setDeleteUserModal(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={deletingUser}
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingUser ? 'Excluindo...' : 'Confirmar Exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
