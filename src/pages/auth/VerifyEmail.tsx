import React, { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { CheckCircle2, AlertCircle, MailCheck, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function verify() {
      if (!token) {
        setErrorMessage('Token de verificação ausente ou inválido.')
        setLoading(false)
        return
      }

      try {
        await pb.collection('users').confirmVerification(token)
        setSuccess(true)
      } catch (err: any) {
        console.error('Email verification error:', err)
        setErrorMessage(
          err?.message || 'Token expirado ou inválido. Solicite uma nova verificação.',
        )
      } finally {
        setLoading(false)
      }
    }

    verify()
  }, [token])

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-[#090D14] text-amber-50 relative overflow-hidden">
      <div className="w-full max-w-[400px]">
        <div className="bg-[#0F1624] rounded-2xl shadow-2xl border border-[#D4AF37]/30 p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 flex items-center justify-center mx-auto mb-4">
            <MailCheck className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-amber-100 tracking-tight mb-2">
            Verificação de E-mail
          </h1>

          {loading ? (
            <div className="py-8 space-y-3">
              <div className="w-8 h-8 border-3 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Validando autenticidade do e-mail...</p>
            </div>
          ) : success ? (
            <div className="space-y-5 pt-2">
              <div className="flex items-center gap-3 p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-200 text-sm text-left">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                <p>Seu e-mail foi verificado com sucesso no sistema de Recursos Humanos.</p>
              </div>

              <Link to="/login" className="block w-full">
                <Button className="w-full h-11 bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold border-0 hover:brightness-110">
                  Acessar Sistema
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-5 pt-2">
              <div className="flex items-center gap-3 p-4 bg-red-950/40 border border-red-500/40 rounded-xl text-red-300 text-sm text-left">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                <p>{errorMessage}</p>
              </div>

              <Link to="/login" className="block w-full">
                <Button
                  variant="outline"
                  className="w-full h-11 border-[#D4AF37]/30 text-amber-100 hover:bg-[#121824] hover:text-[#D4AF37]"
                >
                  Voltar para o login
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
