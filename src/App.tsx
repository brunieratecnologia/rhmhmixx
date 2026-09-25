import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'

import Index from '@/pages/Index'
import NotFound from '@/pages/NotFound'
import Login from '@/pages/auth/Login'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword from '@/pages/auth/ResetPassword'
import VerifyEmail from '@/pages/auth/VerifyEmail'
import ConfirmEmailChange from '@/pages/auth/ConfirmEmailChange'
import Unauthorized from '@/pages/auth/Unauthorized'

import AdminLayout from '@/components/AdminLayout'
import Dashboard from '@/pages/admin/Dashboard'
import FuncionariosList from '@/pages/admin/FuncionariosList'
import FuncionarioForm from '@/pages/admin/FuncionarioForm'
import FuncionarioFicha from '@/pages/admin/FuncionarioFicha'
import Departamentos from '@/pages/admin/Departamentos'
import Cargos from '@/pages/admin/Cargos'
import Configuracoes from '@/pages/admin/Configuracoes'
import TerminalPonto from '@/pages/terminal/TerminalPonto'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Public Terminal Route */}
          <Route path="/terminal" element={<TerminalPonto />} />

          {/* Public Auth Routes */}
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/esqueci-senha" element={<ForgotPassword />} />
          <Route path="/forgot-password" element={<Navigate to="/esqueci-senha" replace />} />
          <Route path="/redefinir-senha" element={<ResetPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verificar-email" element={<VerifyEmail />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/confirmar-alteracao-email" element={<ConfirmEmailChange />} />
          <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Admin Protected Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin', 'rh']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="funcionarios" element={<FuncionariosList />} />
            <Route path="funcionarios/novo" element={<FuncionarioForm />} />
            <Route path="funcionarios/:id" element={<FuncionarioFicha />} />
            <Route path="funcionarios/:id/editar" element={<FuncionarioForm />} />
            <Route path="departamentos" element={<Departamentos />} />
            <Route path="cargos" element={<Cargos />} />
            <Route path="configuracoes" element={<Configuracoes />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
