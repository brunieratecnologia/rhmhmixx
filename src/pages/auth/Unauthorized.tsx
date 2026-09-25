import React from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Unauthorized() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-[#090D14] text-amber-50 relative overflow-hidden">
      <div className="w-full max-w-md bg-[#0F1624] rounded-2xl shadow-2xl border border-[#D4AF37]/30 p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-950/40 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-amber-100 mb-2">Acesso Restrito</h1>
        <p className="text-sm text-slate-400 mb-6">
          Você não tem permissão para acessar esta página ou recurso.
        </p>
        <Link to="/login">
          <Button className="w-full bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold border-0 hover:brightness-110">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao início
          </Button>
        </Link>
      </div>
    </div>
  )
}
