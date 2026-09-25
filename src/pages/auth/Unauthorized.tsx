import React from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Unauthorized() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-[#F4F6F9]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Acesso Restrito</h1>
        <p className="text-sm text-slate-600 mb-6">
          Você não tem permissão para acessar esta página.
        </p>
        <Link to="/login">
          <Button className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao início
          </Button>
        </Link>
      </div>
    </div>
  )
}
