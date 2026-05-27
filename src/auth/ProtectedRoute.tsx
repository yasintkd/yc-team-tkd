import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode
}) {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="glass-panel rounded-2xl px-4 py-3 text-sm text-slate-200">
          Oturum kontrol ediliyor...
        </div>
      </div>
    )
  }

  if (status === 'anonymous') {
    return <Navigate to="/giris" replace />
  }

  return <>{children}</>
}

