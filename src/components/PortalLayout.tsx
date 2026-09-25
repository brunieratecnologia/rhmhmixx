import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { empresaService, portalService } from '@/services/rh'
import type { Empresa, Funcionario } from '@/types/rh'
import {
  Home,
  User,
  Clock,
  FileCheck2,
  Palmtree,
  FileText,
  FolderOpen,
  Send,
  LogOut,
  Menu,
  X,
  ShieldAlert,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

export default function PortalLayout() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    let isMounted = true
    async function loadData() {
      try {
        const emp = await empresaService.get()
        if (isMounted) setEmpresa(emp)
      } catch {
        /* ignore */
      }

      try {
        const func = await portalService.getMeuPerfil()
        if (isMounted) setFuncionario(func)
      } catch (err) {
        console.error('Erro ao carregar perfil do funcionário:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadData()
    return () => {
      isMounted = false
    }
  }, [user])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const navItems = [
    { name: 'Início', path: '/portal/inicio', icon: Home },
    { name: 'Meus Dados', path: '/portal/meus-dados', icon: User },
    { name: 'Meus Horários', path: '/portal/meus-horarios', icon: Clock },
    { name: 'Meu Espelho de Ponto', path: '/portal/meu-espelho', icon: FileCheck2 },
    { name: 'Minhas Férias', path: '/portal/minhas-ferias', icon: Palmtree },
    { name: 'Meus Holerites', path: '/portal/meus-holerites', icon: FileText },
    { name: 'Meus Documentos', path: '/portal/meus-documentos', icon: FolderOpen },
    { name: 'Minhas Solicitações', path: '/portal/minhas-solicitacoes', icon: Send },
  ]

  const handleSignOut = () => {
    signOut()
    navigate('/login')
  }

  const getPageTitle = () => {
    const p = location.pathname
    if (p.includes('/inicio')) return 'Portal do Colaborador'
    if (p.includes('/meus-dados')) return 'Meus Dados Cadastrais'
    if (p.includes('/meus-horarios')) return 'Meus Horários e Escala'
    if (p.includes('/meu-espelho')) return 'Meu Espelho de Ponto'
    if (p.includes('/minhas-ferias')) return 'Minhas Férias'
    if (p.includes('/meus-holerites')) return 'Meus Holerites'
    if (p.includes('/meus-documentos')) return 'Meus Documentos'
    if (p.includes('/minhas-solicitacoes')) return 'Minhas Solicitações'
    return 'Portal do Colaborador'
  }

  const companyName =
    empresa?.nome_fantasia || empresa?.razao_social || 'MH MIXX — Açaí e Frutas Congeladas'
  const displayName = funcionario?.nome || user?.nome || user?.name || 'Colaborador'
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen flex bg-[#090D14] text-amber-50 font-sans antialiased selection:bg-[#D4AF37]/30">
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar do Portal: Simples, Limpa e Responsiva */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-[#070B11] border-r border-[#D4AF37]/20 transition-all duration-200 ease-in-out
          ${mobileOpen ? 'translate-x-0 w-[260px]' : '-translate-x-full lg:translate-x-0'}
          w-[260px]
        `}
      >
        {/* Top Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#D4AF37]/15 bg-black/30">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-lg bg-black border border-[#D4AF37]/40 flex items-center justify-center shrink-0 p-1">
              <img
                src="/src/assets/logomhmixx-7c4e3.jpeg"
                alt="MH MIXX"
                className="w-full h-full object-contain rounded"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-amber-100 truncate tracking-tight">
                MH MIXX
              </span>
              <span className="text-[10px] font-semibold text-[#D4AF37] truncate uppercase tracking-wider">
                Portal do Colaborador
              </span>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 text-slate-400 hover:text-amber-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informações do Colaborador no Topo da Sidebar */}
        <div className="p-4 border-b border-[#D4AF37]/15 bg-[#0C121D]">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 rounded-xl border border-[#D4AF37]/40 shrink-0">
              <AvatarImage src={funcionario?.fotografia} />
              <AvatarFallback className="bg-[#D4AF37] text-slate-950 text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-amber-100 truncate">{displayName}</p>
              <p className="text-[11px] text-slate-400 truncate">
                {funcionario?.expand?.cargo?.nome || 'Colaborador'}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] font-mono text-[#D4AF37] bg-[#D4AF37]/10 px-1.5 py-0.2 rounded border border-[#D4AF37]/20">
                  Matrícula {funcionario?.matricula || '---'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Menu Principal */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#151D2C] text-[#E5C07B] font-semibold border-l-2 border-[#D4AF37] shadow-sm'
                    : 'text-slate-400 hover:bg-[#101622] hover:text-[#D4AF37]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-[#D4AF37]' : 'text-slate-500'
                  }`}
                />
                <span className="truncate">{item.name}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Botão de Sair / Troca de Acesso */}
        <div className="p-3 border-t border-[#D4AF37]/15 bg-[#070B11]">
          {(user?.role === 'admin' || user?.role === 'rh') && (
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="w-full mb-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#7C3AED]/20 hover:bg-[#7C3AED]/30 text-purple-200 border border-[#7C3AED]/40 text-xs font-semibold transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-purple-300" />
              <span>Painel Admin / RH</span>
            </button>
          )}

          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-500/20 text-xs font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair do Portal</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-200 lg:pl-[260px]">
        {/* Top Navbar */}
        <header className="h-16 bg-[#070B11]/90 backdrop-blur-md border-b border-[#D4AF37]/15 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-1 text-slate-400 hover:text-amber-200 rounded-lg hover:bg-slate-800 focus:outline-none"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-lg font-bold text-amber-50 tracking-tight truncate">
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-amber-100">{displayName}</span>
              <span className="text-[10px] text-[#D4AF37] font-medium">{companyName}</span>
            </div>
            <Avatar className="w-8 h-8 rounded-full border border-[#D4AF37]/40">
              <AvatarImage src={funcionario?.fotografia} />
              <AvatarFallback className="bg-[#D4AF37] text-slate-950 text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1200px] w-full mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-10 h-10 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-xs text-slate-400">Carregando seu portal do colaborador...</p>
            </div>
          ) : !funcionario && user?.role === 'funcionario' ? (
            <div className="bg-[#0F1624] border border-[#D4AF37]/30 rounded-2xl p-6 text-center max-w-md mx-auto my-12">
              <ShieldAlert className="w-12 h-12 text-[#D4AF37] mx-auto mb-3" />
              <h2 className="text-lg font-bold text-amber-100 mb-1">
                Ficha de Colaborador Não Localizada
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Sua conta de usuário foi autenticada, porém ainda não há uma ficha de funcionário
                vinculada ao seu e-mail ({user?.email}). Por favor, solicite ao RH o vínculo do seu
                cadastro.
              </p>
              <Button
                onClick={handleSignOut}
                variant="outline"
                className="border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10"
              >
                Sair
              </Button>
            </div>
          ) : (
            <Outlet
              context={{
                funcionario,
                reloadFuncionario: async () => {
                  const f = await portalService.getMeuPerfil()
                  setFuncionario(f)
                },
              }}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="py-4 px-6 border-t border-[#D4AF37]/15 bg-[#070B11] text-center text-xs text-slate-500">
          <span>{companyName} • Portal do Colaborador • Ambiente Seguro Individual</span>
        </footer>
      </div>
    </div>
  )
}
