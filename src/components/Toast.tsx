import { useState, useCallback, createContext, useContext, type ReactNode } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

type Toast = {
  id: number
  message: string
  type: ToastType
}

type ToastContextValue = {
  toast: (message: string, type?: ToastType, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

let nextId = 0

// eslint-disable-next-line react-refresh/only-export-components
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback(
    (message: string, type: ToastType = 'info', duration = 3000) => {
      const id = nextId++
      setToasts((prev) => [...prev, { id, message, type }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    },
    [],
  )

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container */}
      <div className="fixed left-1/2 top-4 z-[999] flex -translate-x-1/2 flex-col items-center gap-2 sm:top-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-enter-active flex items-center gap-2 rounded-2xl border px-4 py-2.5 pr-3 text-xs font-medium shadow-lg backdrop-blur-xl ${
              t.type === 'success'
                ? 'border-emerald-200 bg-emerald-50/95 text-emerald-800'
                : t.type === 'error'
                  ? 'border-rose-200 bg-rose-50/95 text-rose-800'
                  : 'border-sky-200 bg-sky-50/95 text-sky-800'
            }`}
          >
            {t.type === 'success' ? (
              <CheckCircle className="h-4 w-4 shrink-0" />
            ) : t.type === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0" />
            ) : (
              <Info className="h-4 w-4 shrink-0" />
            )}
            <span>{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full opacity-60 hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
