import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await pb.collection('users').requestPasswordReset(email.trim())
    } catch (err) {
      // Do not reveal whether user exists for security
      console.log('Password reset request error:', err)
    } finally {
      setIsLoading(false)
      setIsSent(true)
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
              <Mail className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-amber-100 tracking-tight">
              Recuperação de Senha
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-[280px]">
              Informe seu e-mail cadastrado para enviarmos instruções de redefinição.
            </p>
          </div>

          {isSent ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-200 text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
                <p>
                  Se existir uma conta com este e-mail, enviaremos um link de redefinição. Verifique
                  sua caixa de entrada e spam.
                </p>
              </div>

              <Link to="/login" className="block w-full">
                <Button
                  variant="outline"
                  className="w-full h-11 border-[#D4AF37]/30 text-amber-100 hover:bg-[#121824] hover:text-[#D4AF37]"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar para o login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-amber-200/90">
                  E-mail cadastrado
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
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold text-sm transition-all hover:brightness-110 shadow-lg shadow-[#D4AF37]/20 border-0"
              >
                {isLoading ? 'Enviando link...' : 'Enviar link de redefinição'}
              </Button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center text-xs font-medium text-slate-400 hover:text-amber-300 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
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
