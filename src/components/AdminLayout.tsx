import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { empresaService, dashboardService } from '@/services/rh'
import type { Empresa } from '@/types/rh'
import pb from '@/lib/pocketbase/client'
import {
  LayoutDashboard,
  Users,
  Building2,
  Briefcase,
  Settings,
  Menu,
  X,
  LogOut,
  User as UserIcon,
  ChevronDown,
  FileCheck2,
  Palmtree,
  UserX,
  FolderOpen,
  FileText,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

export default function AdminLayout() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [totalAtivos, setTotalAtivos] = useState<number>(0)

  // Load empresa & total ativos
  useEffect(() => {
    let isMounted = true
    async function loadData() {
      try {
        const emp = await empresaService.get()
        if (isMounted) setEmpresa(emp)
      } catch (err) {
        console.error('Error fetching empresa in layout:', err)
      }

      try {
        const metrics = await dashboardService.getMetrics()
        if (isMounted) setTotalAtivos(metrics.totalAtivos)
      } catch (err) {
        console.error('Error fetching metrics in layout:', err)
      }
    }

    loadData()

    // Subscribe to realtime updates on funcionarios
    let unsubscribeFunc: (() => void) | undefined
    pb.collection('funcionarios')
      .subscribe('*', () => {
        dashboardService.getMetrics().then((m) => {
          if (isMounted) setTotalAtivos(m.totalAtivos)
        })
      })
      .then((unsub) => {
        unsubscribeFunc = unsub
      })
      .catch(() => {})

    return () => {
      isMounted = false
      if (unsubscribeFunc) unsubscribeFunc()
    }
  }, [])

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Funcionários', path: '/admin/funcionarios', icon: Users },
    { name: 'Espelho de Ponto', path: '/admin/espelho-ponto', icon: FileCheck2 },
    { name: 'Férias', path: '/admin/ferias', icon: Palmtree },
    { name: 'Ausências', path: '/admin/ausencias', icon: UserX },
    { name: 'Documentos', path: '/admin/documentos', icon: FolderOpen },
    { name: 'Holerites', path: '/admin/holerites', icon: FileText },
    { name: 'Departamentos', path: '/admin/departamentos', icon: Building2 },
    { name: 'Cargos', path: '/admin/cargos', icon: Briefcase },
    { name: 'Configurações', path: '/admin/configuracoes', icon: Settings },
  ]
  // Derive page title from route
  const getPageTitle = () => {
    const p = location.pathname
    if (p.startsWith('/admin/dashboard')) return 'Visão geral'
    if (p === '/admin/funcionarios/novo') return 'Novo Funcionário'
    if (p.includes('/editar')) return 'Editar Funcionário'
    if (p.startsWith('/admin/funcionarios/') && p !== '/admin/funcionarios')
      return 'Ficha do Funcionário'
    if (p.startsWith('/admin/espelho-ponto')) return 'Espelho de Ponto'
    if (p.startsWith('/admin/documentos')) return 'Central de Documentos'
    if (p.startsWith('/admin/holerites')) return 'Central de Holerites'
    if (p.startsWith('/admin/ferias')) return 'Gestão de Férias'
    if (p.startsWith('/admin/ausencias')) return 'Controle de Ausências'
    if (p.startsWith('/admin/funcionarios')) return 'Funcionários'
    if (p.startsWith('/admin/departamentos')) return 'Departamentos'
    if (p.startsWith('/admin/cargos')) return 'Cargos'
    if (p.startsWith('/admin/configuracoes')) return 'Configurações'
    return 'Recursos Humanos'
  }

  const handleSignOut = () => {
    signOut()
    navigate('/login')
  }

  const logoUrl = empresa?.logotipo ? pb.files.getURL(empresa, empresa.logotipo) : null
  const companyName =
    empresa?.nome_fantasia || empresa?.razao_social || 'MH MIXX — Açaí e Frutas Congeladas'
  const isDashboard = location.pathname === '/admin' || location.pathname === '/admin/dashboard'

  const userDisplayName = user?.nome || user?.name || user?.email || 'Usuário'
  const userInitials = userDisplayName.slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen flex bg-[#090D14] text-amber-50 font-sans antialiased">
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs lg:hidden transition-opacity duration-200"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar (Desktop 250px, Tablet 72px icon-only, Mobile Slide-in Drawer) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-[#070B11] border-r border-[#D4AF37]/20 transition-all duration-200 ease-in-out
          ${mobileOpen ? 'translate-x-0 w-[250px]' : '-translate-x-full lg:translate-x-0'}
          w-[250px] md:w-[72px] lg:w-[250px]
        `}
      >
        {/* Brand / Logo Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#D4AF37]/15">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-lg bg-black border border-[#D4AF37]/40 flex items-center justify-center shrink-0 p-1">
              <img
                src={logoUrl || '/src/assets/logomhmixx-7c4e3.jpeg'}
                alt={companyName}
                className="w-full h-full object-contain rounded"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).src = '/src/assets/logomhmixx-7c4e3.jpeg'
                }}
              />{' '}
            </div>
            <div className="flex flex-col min-w-0 md:hidden lg:flex">
              <span className="text-xs font-bold text-amber-100 truncate tracking-tight">
                MH MIXX
              </span>
              <span className="text-[10px] font-medium text-[#D4AF37] truncate">
                Gestão & Recursos Humanos
              </span>
            </div>
          </div>

          {/* Close button on mobile drawer */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 text-slate-400 hover:text-amber-300 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              location.pathname === item.path ||
              (item.path === '/admin/dashboard' &&
                (location.pathname === '/admin' || location.pathname === '/admin/dashboard')) ||
              (item.path !== '/admin/dashboard' && location.pathname.startsWith(item.path))
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative group
                  ${
                    isActive
                      ? 'bg-[#151D2C] text-[#E5C07B] font-semibold border-l-2 border-[#D4AF37]'
                      : 'text-slate-400 hover:bg-[#121824] hover:text-[#D4AF37]'
                  }
                  md:justify-center lg:justify-start
                `}
                title={item.name}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-colors ${
                    isActive ? 'text-[#D4AF37]' : 'text-slate-500 group-hover:text-[#D4AF37]'
                  }`}
                />
                <span className="truncate md:hidden lg:inline">{item.name}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* User preview at sidebar bottom */}
        <div className="p-3 border-t border-[#D4AF37]/15">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-[#0F1624] border border-[#D4AF37]/10 md:justify-center lg:justify-start">
            <Avatar className="w-8 h-8 rounded-full border border-[#D4AF37]/40">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback className="bg-[#D4AF37]/20 text-[#D4AF37] text-xs font-bold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 md:hidden lg:block text-left">
              <p className="text-xs font-semibold text-amber-100 truncate">{userDisplayName}</p>
              <p className="text-[10px] text-[#D4AF37] uppercase tracking-wider">
                {user?.role || 'admin'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-200 lg:pl-[250px] md:pl-[72px]">
        {/* Top bar */}
        <header className="h-16 bg-[#070B11]/90 backdrop-blur-md border-b border-[#D4AF37]/15 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger Button (Mobile Only) */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-1 text-slate-400 hover:text-amber-200 rounded-lg hover:bg-slate-800 focus:outline-none"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-amber-50 tracking-tight truncate">
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Link direto para Portal do Colaborador (se admin/RH quiser inspecionar ou acessar) */}
            <button
              onClick={() => navigate('/portal/inicio')}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7C3AED]/20 hover:bg-[#7C3AED]/30 text-purple-200 border border-[#7C3AED]/40 text-xs font-medium transition-colors"
              title="Acessar Portal do Colaborador"
            >
              <span>Portal Colaborador</span>
            </button>

            {/* Status Pill on Dashboard */}
            {isDashboard && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{totalAtivos} ativos</span>
              </div>
            )}

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#121824] transition-colors focus:outline-none border border-transparent hover:border-[#D4AF37]/20">
                  <Avatar className="w-8 h-8 rounded-full border border-[#D4AF37]/40">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-[#D4AF37] text-slate-950 text-xs font-bold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline-block text-xs font-medium text-amber-100 max-w-[130px] truncate">
                    {userDisplayName}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 shadow-2xl rounded-xl border-[#D4AF37]/30 bg-[#0F1624] text-amber-50 p-1.5"
              >
                <DropdownMenuLabel className="px-2 py-1.5">
                  <div className="text-xs font-bold text-amber-100 truncate">{userDisplayName}</div>
                  <div className="text-[11px] font-normal text-slate-400 truncate">
                    {user?.email}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-800" />
                <DropdownMenuItem
                  onClick={() => navigate('/admin/configuracoes')}
                  className="px-2 py-2 text-xs font-medium text-amber-100 cursor-pointer rounded-lg hover:bg-[#1A2233] hover:text-[#D4AF37]"
                >
                  <UserIcon className="w-4 h-4 mr-2 text-slate-400" />
                  Meu perfil & Configurações
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate('/portal/inicio')}
                  className="px-2 py-2 text-xs font-medium text-purple-300 cursor-pointer rounded-lg hover:bg-[#7C3AED]/20"
                >
                  <UserIcon className="w-4 h-4 mr-2 text-purple-400" />
                  Ir para Portal do Colaborador
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-800" />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="px-2 py-2 text-xs font-medium text-red-400 cursor-pointer rounded-lg hover:bg-red-950/40"
                >
                  <LogOut className="w-4 h-4 mr-2 text-red-400" />
                  Sair do sistema
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="hidden sm:block py-4 px-6 border-t border-[#D4AF37]/15 bg-[#070B11] text-center text-xs text-slate-400">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-[1400px] mx-auto">
            <span className="text-amber-100/80">{companyName} • Gestão de Recursos Humanos</span>
            <div className="flex items-center gap-3">
              <a
                href="/terminal"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-[#D4AF37] hover:underline"
              >
                Abrir Terminal de Ponto ↗
              </a>
              <span className="text-slate-500">• Etapa 7 — Homologação Final Concluída</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
