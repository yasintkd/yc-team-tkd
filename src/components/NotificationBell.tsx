import { useEffect, useRef, useState } from 'react'
import { Bell, AlertTriangle, Award } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fetchNotifications, type Notification } from '../lib/notifications'

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState<Notification[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void fetchNotifications().then(setNotes)
    const interval = setInterval(() => {
      void fetchNotifications().then(setNotes)
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const iconMap = {
    exam_upcoming: Award,
    exam_passed: Award,
    missed_attendance: AlertTriangle,
  } as const

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-app-border bg-white text-slate-600 active:scale-95 hover:bg-app-bg-soft hover:text-slate-900"
        aria-label="Bildirimler"
      >
        <Bell className="h-4 w-4" />
        {notes.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white leading-none">
            {notes.length > 9 ? '9+' : notes.length}
          </span>
        )}
      </button>

      {open && (
        <div className="subnav-enter subnav-enter-active absolute right-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-2xl border border-app-border bg-white/95 shadow-lg shadow-sky-100/50 backdrop-blur-xl">
          <div className="border-b border-app-border px-4 py-2.5">
            <p className="text-xs font-semibold text-slate-800">Bildirimler</p>
          </div>
          {notes.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-brand-muted">
              Yeni bildirim yok
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-app-border/60">
              {notes.map((n) => {
                const Icon = iconMap[n.type]
                const content = (
                  <li
                    key={n.id}
                    className="flex items-start gap-3 px-4 py-3 transition hover:bg-app-bg-soft cursor-pointer"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-cyan" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800">
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-xs text-brand-muted">
                        {n.description}
                      </p>
                    </div>
                  </li>
                )
                return n.link ? (
                  <Link key={n.id} to={n.link} onClick={() => setOpen(false)}>
                    {content}
                  </Link>
                ) : (
                  content
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
