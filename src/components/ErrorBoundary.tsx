import { Component, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  handleRetry = () => {
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex h-full items-center justify-center p-6">
          <div className="glass-panel max-w-md rounded-2xl p-6 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-rose-500" />
            <h2 className="mt-3 text-sm font-semibold text-slate-800">
              Beklenmeyen hata
            </h2>
            <p className="mt-1 text-xs text-brand-muted">
              {this.state.error.message || 'Sayfa yüklenirken hata oluştu.'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Cmd+Shift+R ile tam yenilemeyi dene
            </p>
            <button
              type="button"
              onClick={this.handleRetry}
              className="btn-primary mt-4 inline-flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Tekrar Dene
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
