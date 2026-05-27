import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

const USERNAME_EMAIL_DOMAIN = 'yc-team-tkd.local'

function usernameToEmail(username: string) {
  const u = username.trim().toLowerCase()
  return `${u}@${USERNAME_EMAIL_DOMAIN}`
}

export default function Login() {
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
    <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-md items-center px-4">
      <div className="glass-panel w-full rounded-2xl p-5 shadow-lg">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Giriş</h2>
          <p className="mt-1 text-xs text-slate-400">
            Taekwondo Akademi Yönetim Paneli
          </p>
        </div>

        {error && (
          <div className="mb-3 rounded-xl border border-rose-900/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-3 rounded-xl border border-emerald-900/30 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">
            {message}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-300" htmlFor="username">
              Kullanıcı Adı
            </label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              placeholder="ör: yasintkd"
              autoComplete="username"
            />
            <p className="text-[11px] text-slate-500">
              Sistem, bunu arka planda <span className="text-slate-300">{`kullaniciadi@${USERNAME_EMAIL_DOMAIN}`}</span>{' '}
              formatına çevirerek Supabase Auth ile giriş yapar.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-300" htmlFor="password">
              Şifre
            </label>
            <input
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              placeholder="••••••"
              type="password"
              autoComplete="current-password"
            />
            <p className="text-[11px] text-slate-500">
              Supabase Auth’ta email/password açık olmalı. Kullanıcıları Supabase
              panelinden manuel ekleyebilirsin.
            </p>
          </div>

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'İşleniyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  )
}

