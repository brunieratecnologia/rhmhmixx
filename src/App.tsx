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
import PortalLayout from '@/components/PortalLayout'
import Dashboard from '@/pages/admin/Dashboard'
import FuncionariosList from '@/pages/admin/FuncionariosList'
import FuncionarioForm from '@/pages/admin/FuncionarioForm'
import FuncionarioFicha from '@/pages/admin/FuncionarioFicha'
import Departamentos from '@/pages/admin/Departamentos'
import Cargos from '@/pages/admin/Cargos'
import Configuracoes from '@/pages/admin/Configuracoes'
import TerminalPonto from '@/pages/terminal/TerminalPonto'
import EspelhoPonto from '@/pages/admin/EspelhoPonto'
import Ferias from '@/pages/admin/Ferias'
import { FeriasErrorBoundary } from '@/components/admin/FeriasErrorBoundary'
import Ausencias from '@/pages/admin/Ausencias'
import DocumentosPage from '@/pages/admin/Documentos'
import HoleritesPage from '@/pages/admin/Holerites'

import PortalInicio from '@/pages/portal/PortalInicio'
import PortalMeusDados from '@/pages/portal/PortalMeusDados'
import PortalMeusHorarios from '@/pages/portal/PortalMeusHorarios'
import PortalMeuEspelho from '@/pages/portal/PortalMeuEspelho'
import PortalMinhasFerias from '@/pages/portal/PortalMinhasFerias'
import PortalMeusHolerites from '@/pages/portal/PortalMeusHolerites'
import PortalMeusDocumentos from '@/pages/portal/PortalMeusDocumentos'
import PortalMinhasSolicitacoes from '@/pages/portal/PortalMinhasSolicitacoes'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Routes>
            {/* Raiz pública */}
            <Route path="/" element={<Index />} />

            {/* Rotas de Autenticação */}
            <Route path="/login" element={<Login />} />
            <Route path="/esqueci-senha" element={<ForgotPassword />} />
            <Route path="/redefinir-senha" element={<ResetPassword />} />
            <Route path="/verificar-email" element={<VerifyEmail />} />
            <Route path="/confirmar-troca-email" element={<ConfirmEmailChange />} />
            <Route path="/nao-autorizado" element={<Unauthorized />} />

            {/* Terminal de Ponto - Kiosk público/coletivo */}
            <Route path="/terminal" element={<TerminalPonto />} />

            {/* Rotas Protegidas - Admin / RH */}
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
              <Route path="espelho-ponto" element={<EspelhoPonto />} />
              <Route path="documentos" element={<DocumentosPage />} />
              <Route path="holerites" element={<HoleritesPage />} />
              <Route
                path="ferias"
                element={
                  <FeriasErrorBoundary>
                    <Ferias />
                  </FeriasErrorBoundary>
                }
              />
              <Route path="ausencias" element={<Ausencias />} />
              <Route path="departamentos" element={<Departamentos />} />
              <Route path="cargos" element={<Cargos />} />
              <Route path="configuracoes" element={<Configuracoes />} />
            </Route>

            {/* Rotas Protegidas - Portal do Colaborador */}
            <Route
              path="/portal"
              element={
                <ProtectedRoute allowedRoles={['admin', 'rh', 'funcionario']}>
                  <PortalLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/portal/inicio" replace />} />
              <Route path="inicio" element={<PortalInicio />} />
              <Route path="meus-dados" element={<PortalMeusDados />} />
              <Route path="meus-horarios" element={<PortalMeusHorarios />} />
              <Route path="meu-espelho" element={<PortalMeuEspelho />} />
              <Route path="minhas-ferias" element={<PortalMinhasFerias />} />
              <Route path="meus-holerites" element={<PortalMeusHolerites />} />
              <Route path="meus-documentos" element={<PortalMeusDocumentos />} />
              <Route path="minhas-solicitacoes" element={<PortalMinhasSolicitacoes />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
          <Sonner />
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
