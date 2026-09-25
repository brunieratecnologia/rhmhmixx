import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function Index() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#090D14]">
        <div className="w-10 h-10 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (user) {
    if (user.role === 'funcionario') {
      return <Navigate to="/portal/inicio" replace />
    }
    return <Navigate to="/admin/dashboard" replace />
  }

  return <Navigate to="/login" replace />
}
