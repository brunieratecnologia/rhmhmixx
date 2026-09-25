import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as any)?.from?.pathname || '/admin/dashboard'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    setIsLoading(true)

    try {
      const loggedUser = await signIn(email, password)
      if (loggedUser.role === 'admin' || loggedUser.role === 'rh') {
        navigate(
          from && from !== '/login' && !from.startsWith('/portal') ? from : '/admin/dashboard',
          { replace: true },
        )
      } else {
        // Funcionário role -> Portal do Funcionário
        navigate('/portal/inicio', { replace: true })
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setErrorMessage('E-mail ou senha incorretos.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-[#090D14] relative overflow-hidden text-amber-50">
      {/* Subtle gold and acai radial glows */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#7C3AED]/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      <div className="w-full max-w-[420px] z-10">
        <div className="bg-[#0F1624] rounded-2xl shadow-2xl border border-[#D4AF37]/25 p-8 relative backdrop-blur-md">
          {/* Logo / Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-black/60 border border-[#D4AF37]/40 flex items-center justify-center p-2 mb-3 shadow-lg shadow-black/60">
              <img
                src="/src/assets/logomhmixx-7c4e3.jpeg"
                alt="MH MIXX"
                className="w-full h-full object-contain rounded-xl"
                onError={(e) => {
                  ;(e.currentTarget as HTMLElement).style.display = 'none'
                }}
              />
            </div>
            <h1 className="text-xl font-bold text-amber-100 tracking-tight flex items-center gap-1.5">
              <span>MH MIXX</span>
              <span className="text-xs px-2 py-0.5 rounded bg-[#7C3AED]/20 text-purple-300 border border-[#7C3AED]/40">
                Açaí & Frutas
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Acesso corporativo — Gestão de RH e Portal do Colaborador
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-5 flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-amber-200/90">
                E-mail corporativo ou pessoal
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#D4AF37]/70" />
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="seu.email@empresa.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 h-11 bg-[#090D14] border-[#D4AF37]/30 text-amber-50 placeholder:text-slate-500 focus-visible:ring-[#D4AF37] focus-visible:border-[#D4AF37]"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-amber-200/90">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#D4AF37]/70" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10 h-11 bg-[#090D14] border-[#D4AF37]/30 text-amber-50 placeholder:text-slate-500 focus-visible:ring-[#D4AF37] focus-visible:border-[#D4AF37]"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-300 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold text-sm transition-all hover:brightness-110 shadow-lg shadow-[#D4AF37]/20 border-0"
            >
              {isLoading ? 'Entrando...' : 'Entrar no Sistema'}
            </Button>

            <div className="text-center pt-2">
              <Link
                to="/esqueci-senha"
                className="text-xs font-medium text-slate-400 hover:text-amber-300 transition-colors"
              >
                Esqueci minha senha
              </Link>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Uso restrito aos colaboradores autorizados da empresa.
        </p>
      </div>
    </div>
  )
}
