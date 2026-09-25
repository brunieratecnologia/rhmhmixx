import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class FeriasErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('FeriasErrorBoundary capturou erro:', error, errorInfo)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 shadow-lg p-6 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">
                Não foi possível carregar a gestão de férias
              </h3>
              <p className="text-xs text-slate-500">
                Ocorreu uma instabilidade no processamento dos períodos de férias. Nenhum dado foi
                perdido.
              </p>
            </div>
            {this.state.error?.message && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-left font-mono text-[11px] text-slate-600 overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}
            <Button
              onClick={this.handleRetry}
              className="w-full bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold hover:brightness-110 border-0"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Tentar novamente
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
