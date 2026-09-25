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
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Funcionários', path: '/admin/funcionarios', icon: Users },
    { name: 'Espelho de Ponto', path: '/admin/espelho-ponto', icon: FileCheck2 },
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
  const companyName = empresa?.nome_fantasia || empresa?.razao_social || 'Recursos Humanos'
  const isDashboard = location.pathname === '/admin/dashboard'

  const userDisplayName = user?.nome || user?.name || user?.email || 'Usuário'
  const userInitials = userDisplayName.slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen flex bg-[#F4F6F9] text-slate-900 font-sans antialiased">
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity duration-200"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar (Desktop 250px, Tablet 72px icon-only, Mobile Slide-in Drawer) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-white border-r border-[#E2E8F0] transition-all duration-200 ease-in-out
          ${mobileOpen ? 'translate-x-0 w-[250px]' : '-translate-x-full lg:translate-x-0'}
          w-[250px] md:w-[72px] lg:w-[250px]
        `}
      >
        {/* Brand / Logo Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3 overflow-hidden">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={companyName}
                className="w-9 h-9 object-contain rounded-lg shrink-0 border border-slate-100"
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-[#2563EB] flex items-center justify-center text-white shrink-0 font-bold text-sm shadow-xs">
                RH
              </div>
            )}
            <div className="flex flex-col min-w-0 md:hidden lg:flex">
              <span className="text-sm font-bold text-slate-900 truncate tracking-tight">
                {companyName}
              </span>
              <span className="text-[11px] font-medium text-slate-500 truncate">Gestão de RH</span>
            </div>
          </div>

          {/* Close button on mobile drawer */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
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
              (item.path !== '/admin/dashboard' && location.pathname.startsWith(item.path))
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative group
                  ${
                    isActive
                      ? 'bg-[#DBEAFE] text-[#1E3A8A] font-semibold'
                      : 'text-slate-600 hover:bg-blue-50/60 hover:text-[#2563EB]'
                  }
                  md:justify-center lg:justify-start
                `}
                title={item.name}
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#2563EB] rounded-r-full" />
                )}
                <Icon
                  className={`w-5 h-5 shrink-0 transition-colors ${
                    isActive ? 'text-[#2563EB]' : 'text-slate-500 group-hover:text-[#2563EB]'
                  }`}
                />
                <span className="truncate md:hidden lg:inline">{item.name}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* User preview at sidebar bottom */}
        <div className="p-3 border-t border-[#E2E8F0]">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50/80 md:justify-center lg:justify-start">
            <Avatar className="w-8 h-8 rounded-full border border-slate-200">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback className="bg-[#2563EB]/10 text-[#2563EB] text-xs font-bold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 md:hidden lg:block text-left">
              <p className="text-xs font-semibold text-slate-800 truncate">{userDisplayName}</p>
              <p className="text-[10px] text-slate-500 capitalize">{user?.role || 'admin'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-200 lg:pl-[250px] md:pl-[72px]">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-[#E2E8F0] sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger Button (Mobile Only) */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 focus:outline-none"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Status Pill on Dashboard */}
            {isDashboard && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{totalAtivos} ativos</span>
              </div>
            )}

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none">
                  <Avatar className="w-8 h-8 rounded-full border border-slate-200">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-[#2563EB] text-white text-xs font-bold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline-block text-xs font-medium text-slate-700 max-w-[130px] truncate">
                    {userDisplayName}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 shadow-lg rounded-xl border-slate-200 p-1.5"
              >
                <DropdownMenuLabel className="px-2 py-1.5">
                  <div className="text-xs font-bold text-slate-900 truncate">{userDisplayName}</div>
                  <div className="text-[11px] font-normal text-slate-500 truncate">
                    {user?.email}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-100" />
                <DropdownMenuItem
                  onClick={() => navigate('/admin/configuracoes')}
                  className="px-2 py-2 text-xs font-medium text-slate-700 cursor-pointer rounded-lg hover:bg-blue-50 hover:text-[#2563EB]"
                >
                  <UserIcon className="w-4 h-4 mr-2 text-slate-400" />
                  Meu perfil & Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-100" />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="px-2 py-2 text-xs font-medium text-red-600 cursor-pointer rounded-lg hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4 mr-2 text-red-500" />
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
        <footer className="hidden sm:block py-4 px-6 border-t border-[#E2E8F0] bg-white text-center text-xs text-slate-500">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-[1400px] mx-auto">
            <span>{companyName} • Sistema de Recursos Humanos</span>
            <div className="flex items-center gap-3">
              <a
                href="/terminal"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-[#2563EB] hover:underline"
              >
                Abrir Terminal de Ponto ↗
              </a>
              <span className="text-slate-400">• Etapa 2 — Terminal Coletivo de Ponto</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
