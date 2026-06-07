import { Bell, LogOut } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { APP_VERSION } from '../appVersion'
import Logo from './Logo'
import { useLocation } from 'react-router-dom'

const pageTitles: Record<string, { title: string; subtitle?: string }> = {
  '/dashboard': {
    title: 'Genel Bakış',
    subtitle: 'YÇ Team Taekwondo salon özeti',
  },
  '/sporcular': {
    title: 'Sporcular',
    subtitle: 'Kayıt ve kuşak takibi',
  },
  '/etkinlikler': {
    title: 'Etkinlikler',
    subtitle: 'Kuşak sınavı ve yarışma yönetimi',
  },
  '/kusak-sinavi': {
    title: 'Kuşak Sınavı',
    subtitle: 'Sınav listesi ve yükseltme',
  },
  '/yarisma': {
    title: 'Yarışmalar',
    subtitle: 'Turnuva ve katılımcı yönetimi',
  },
  '/yoklama': {
    title: 'Yoklama',
    subtitle: 'Günlük devam ve grup yönetimi',
  },
  '/yoklama-detay': {
    title: 'Yoklama',
    subtitle: 'Günlük devam takibi',
  },
  '/gruplar': {
    title: 'Antrenman Grupları',
    subtitle: 'Grup ve program yönetimi',
  },
  '/malzeme': {
    title: 'Malzeme',
    subtitle: 'Ürün ve sipariş yönetimi',
  },
}

export default function Topbar() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const page = pageTitles[location.pathname]
  const username =
    user?.email && user.email.includes('@') ? user.email.split('@')[0] : null

  return (
    <header className="safe-top sticky top-0 z-10 border-b border-app-border/80 bg-white/90 shadow-sm shadow-sky-100/50 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2.5 md:px-4 md:py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="md:hidden">
            <Logo variant="header" />
          </div>
          <div className="hidden min-w-0 md:block">
            <h1 className="truncate text-lg font-semibold tracking-tight text-slate-800">
              {page?.title ?? 'Genel Bakış'}
            </h1>
            {page?.subtitle && (
              <p className="truncate text-xs text-brand-muted">{page.subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {user && (
            <span className="hidden max-w-32 truncate rounded-full border border-app-border bg-app-bg-soft px-3 py-1.5 text-xs text-slate-700 lg:inline">
              {username ?? user.email}
            </span>
          )}
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-app-border bg-white text-slate-600 active:scale-95 hover:bg-app-bg-soft hover:text-slate-900"
            aria-label="Bildirimler"
          >
            <Bell className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-app-border bg-white text-slate-600 active:scale-95 hover:bg-app-bg-soft hover:text-slate-900"
            title={`Çıkış yap • v${APP_VERSION}`}
            aria-label="Çıkış yap"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
