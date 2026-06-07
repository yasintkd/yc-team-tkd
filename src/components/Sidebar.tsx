import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  UsersRound,
  Award,
  CheckSquare,
  ChevronRight,
  Package,
} from 'lucide-react'
import Logo from './Logo'
import { BRAND } from '../lib/brand'

const navItems = [
  { to: '/dashboard', label: 'Genel Bakış', icon: LayoutDashboard },
  { to: '/sporcular', label: 'Sporcular', icon: Users },
  { to: '/gruplar', label: 'Antrenman Grupları', icon: UsersRound },
  { to: '/kusak-sinavi', label: 'Kuşak Sınavı', icon: Award },
  { to: '/yoklama', label: 'Yoklama', icon: CheckSquare },
  { to: '/malzeme', label: 'Malzeme', icon: Package },
]

export default function Sidebar() {
  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-app-border bg-white/95 p-4 shadow-sm shadow-sky-100/60 md:flex">
      <div className="mb-8">
        <Logo variant="full" />
        <p className="mt-2 text-xs text-brand-muted">{BRAND.tagline}</p>
      </div>

      <nav className="space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
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
      </nav>
    </aside>
  )
}
