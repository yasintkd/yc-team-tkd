import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import Logo from '../components/Logo'
import { BRAND } from '../lib/brand'

export default function Login() {
  const USERNAME_EMAIL_DOMAIN = 'yc-team-tkd.local'
  const usernameToEmail = (username: string) => {
    const u = username.trim().toLowerCase()
    return `${u}@${USERNAME_EMAIL_DOMAIN}`
  }

  const navigate = useNavigate()
  const { status } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(() => {
    if (!username.trim()) return false
    return password.length >= 1
  }, [username, password])

  if (status === 'authenticated') {
    navigate('/dashboard', { replace: true })
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(username),
        password,
      })
      if (error) throw error
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Giriş başarısız.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-2rem)] flex-col items-center justify-center py-6">
      <div className="mb-6 flex w-full max-w-[300px] flex-col items-center text-center">
        <Logo variant="login" />
        <p className="mt-3 text-sm text-brand-muted">{BRAND.tagline}</p>
      </div>

      <div className="glass-panel w-full rounded-2xl p-5 shadow-lg">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Giriş</h2>
          <p className="mt-1 text-xs text-brand-muted">
            Yönetim paneline erişmek için giriş yapın.
          </p>
        </div>

        {error && (
          <div className="mb-3 rounded-xl border border-rose-900/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-3 rounded-xl border border-brand-cyan/20 bg-brand-cyan/10 px-3 py-2 text-xs text-brand-cyan">
            {message}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-600" htmlFor="username">
              Kullanıcı Adı
            </label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field"
              placeholder="ör: yasintkd"
              autoComplete="username"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-600" htmlFor="password">
              Şifre
            </label>
            <input
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="••••••"
              type="password"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="btn-primary w-full"
          >
            {loading ? 'İşleniyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  )
}
