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
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-gradient-to-br from-[#E8EEF7] via-[#DFE8F5] to-[#D5E0F0] relative overflow-hidden">
      <div className="w-full max-w-[400px] z-10">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center mb-3">
              <Mail className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Recuperação de Senha
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-[280px]">
              Informe seu e-mail cadastrado para enviarmos instruções de redefinição.
            </p>
          </div>

          {isSent ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
                <p>
                  Se existir uma conta com este e-mail, enviaremos um link de redefinição. Verifique
                  sua caixa de entrada e spam.
                </p>
              </div>

              <Link to="/login" className="block w-full">
                <Button variant="outline" className="w-full h-11 border-slate-200">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar para o login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                  E-mail cadastrado
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="seu.email@empresa.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-11 border-slate-200 focus-visible:ring-[#2563EB]"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm transition-all shadow-sm"
              >
                {isLoading ? 'Enviando link...' : 'Enviar link de redefinição'}
              </Button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-[#2563EB] transition-colors"
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
