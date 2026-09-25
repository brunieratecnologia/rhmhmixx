import React, { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (password.length < 8) {
      setErrorMessage('A senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (password !== passwordConfirm) {
      setErrorMessage('As senhas digitadas não conferem.')
      return
    }

    if (!token) {
      setErrorMessage('Token de redefinição inválido ou ausente.')
      return
    }

    setIsLoading(true)

    try {
      await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm)
      setSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 2500)
    } catch (err: any) {
      console.error('Confirm reset password error:', err)
      setErrorMessage(
        err?.message || 'Token expirado ou inválido. Solicite uma nova redefinição de senha.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-[#090D14] relative overflow-hidden text-amber-50">
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#7C3AED]/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      <div className="w-full max-w-[400px] z-10">
        <div className="bg-[#0F1624] rounded-2xl shadow-2xl border border-[#D4AF37]/25 p-8 relative backdrop-blur-md">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 flex items-center justify-center mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-amber-100 tracking-tight">Redefinir Senha</h1>
            <p className="text-xs text-slate-400 mt-1">Crie uma nova senha de acesso seguro.</p>
          </div>

          {errorMessage && (
            <div className="mb-5 flex items-center gap-2 p-3 text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {success ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-200 text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                <div>
                  <p className="font-semibold">Senha redefinida com sucesso.</p>
                  <p className="text-xs text-emerald-400 mt-0.5">
                    Redirecionando para a tela de login...
                  </p>
                </div>
              </div>

              <Link to="/login" className="block w-full">
                <Button className="w-full h-11 bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold border-0">
                  Ir para o Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-amber-200/90">
                  Nova senha (mín. 8 caracteres)
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Nova senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 h-11 bg-[#090D14] border-[#D4AF37]/30 text-amber-50 placeholder:text-slate-500 focus-visible:ring-[#D4AF37] focus-visible:border-[#D4AF37]"
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

              <div className="space-y-1.5">
                <Label
                  htmlFor="passwordConfirm"
                  className="text-xs font-semibold text-amber-200/90"
                >
                  Confirmar nova senha
                </Label>
                <Input
                  id="passwordConfirm"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Repita a nova senha"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="h-11 bg-[#090D14] border-[#D4AF37]/30 text-amber-50 placeholder:text-slate-500 focus-visible:ring-[#D4AF37] focus-visible:border-[#D4AF37]"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold text-sm transition-all hover:brightness-110 shadow-lg shadow-[#D4AF37]/20 border-0"
              >
                {isLoading ? 'Redefinindo...' : 'Redefinir senha'}
              </Button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="text-xs font-medium text-slate-400 hover:text-amber-300 transition-colors"
                >
                  Voltar para o login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
