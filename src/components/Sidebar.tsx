import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  UsersRound,
  Award,
  Trophy,
  CheckSquare,
  ChevronRight,
  Package,
  FileText,
  CalendarDays,
} from 'lucide-react'
import Logo from './Logo'
import { BRAND } from '../lib/brand'

type NavGroup = {
  label?: string
  items: { to: string; label: string; icon: typeof LayoutDashboard }[]
}

const navGroups: NavGroup[] = [
  {
    items: [{ to: '/dashboard', label: 'Genel Bakış', icon: LayoutDashboard }],
  },
  {
    items: [{ to: '/sporcular', label: 'Sporcular', icon: Users }],
  },
  {
    label: 'Etkinlikler',
    items: [
      { to: '/kusak-sinavi', label: 'Kuşak Sınavı', icon: Award },
      { to: '/yarisma', label: 'Yarışmalar', icon: Trophy },
    ],
  },
  {
    label: 'Yoklama',
    items: [
      { to: '/yoklama', label: 'Yoklama', icon: CheckSquare },
      { to: '/gruplar', label: 'Antrenman Grupları', icon: UsersRound },
    ],
  },
  {
    label: 'Araçlar',
    items: [
      { to: '/malzeme', label: 'Malzeme', icon: Package },
      { to: '/raporlar', label: 'Raporlar', icon: FileText },
      { to: '/takvim', label: 'Takvim', icon: CalendarDays },
    ],
  },
]

export default function Sidebar() {
  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-app-border bg-white/95 p-4 shadow-sm shadow-sky-100/60 md:flex">
      <div className="mb-6">
        <Logo variant="full" />
        <p className="mt-2 text-xs text-brand-muted">{BRAND.tagline}</p>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-brand-muted/70">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    [
                      'group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition',
                      isActive
                        ? 'bg-brand-red text-white shadow-sm'
                        : 'text-slate-600 hover:bg-app-bg-soft hover:text-slate-900',
                    ].join(' ')
                  }
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}
