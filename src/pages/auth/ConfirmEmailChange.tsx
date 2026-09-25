import React, { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { CheckCircle2, AlertCircle, MailCheck, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ConfirmEmailChange() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function confirmChange() {
      if (!token) {
        setErrorMessage('Token de alteração de e-mail ausente ou inválido.')
        setLoading(false)
        return
      }

      try {
        await pb.collection('users').confirmEmailChange(token, '')
        setSuccess(true)
      } catch (err: any) {
        console.error('Email change error:', err)
        setErrorMessage(
          err?.message || 'Token expirado ou inválido. Solicite uma nova alteração de e-mail.',
        )
      } finally {
        setLoading(false)
      }
    }

    confirmChange()
  }, [token])

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-gradient-to-br from-[#E8EEF7] via-[#DFE8F5] to-[#D5E0F0]">
      <div className="w-full max-w-[400px]">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center mx-auto mb-4">
            <MailCheck className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
            Alteração de E-mail
          </h1>

          {loading ? (
            <div className="py-8 space-y-3">
              <div className="w-8 h-8 border-3 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Confirmando novo e-mail...</p>
            </div>
          ) : success ? (
            <div className="space-y-5 pt-2">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm text-left">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                <p>Novo endereço de e-mail confirmado com sucesso.</p>
              </div>

              <Link to="/login" className="block w-full">
                <Button className="w-full h-11 bg-[#2563EB] text-white">
                  Acessar Sistema
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-5 pt-2">
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm text-left">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
                <p>{errorMessage}</p>
              </div>

              <Link to="/login" className="block w-full">
                <Button variant="outline" className="w-full h-11 border-slate-200">
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
