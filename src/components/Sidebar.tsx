import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  CheckSquare,
  ChevronRight,
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', label: 'Genel Bakış', icon: LayoutDashboard },
  { to: '/sporcular', label: 'Sporcu Yönetimi', icon: Users },
  { to: '/odemeler', label: 'Aidat & Ödemeler', icon: CreditCard },
  { to: '/yoklama', label: 'Yoklama', icon: CheckSquare },
]

export default function Sidebar() {
  return (
    <aside className="hidden h-full w-64 flex-col border-r border-slate-800 bg-slate-950/80 p-4 shadow-lg md:flex">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-sm font-bold text-slate-950">
          TKD
        </div>
        <div>
          <p className="text-sm font-semibold">Taekwondo Akademi</p>
          <p className="text-xs text-slate-400">Yönetim Paneli</p>
        </div>
      </div>

      <nav className="space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition',
                isActive
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white',
              ].join(' ')
            }
          >
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {label}
            </span>
            <ChevronRight className="h-4 w-4 opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
