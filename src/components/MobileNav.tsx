import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Calendar,
  CheckSquare,
  Package,
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', label: 'Özet', icon: LayoutDashboard },
  { to: '/sporcular', label: 'Sporcular', icon: Users },
  { to: '/etkinlikler', label: 'Etkinlikler', icon: Calendar },
  { to: '/yoklama', label: 'Yoklama', icon: CheckSquare },
  { to: '/malzeme', label: 'Malzeme', icon: Package },
]

export default function MobileNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-app-border bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(148,180,212,0.25)] backdrop-blur-xl md:hidden"
      aria-label="Ana menü"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 px-0.5 pt-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                [
                  'flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1.5 text-[9px] font-medium transition active:scale-95',
                  isActive
                    ? 'text-brand-cyan'
                    : 'text-slate-500 hover:text-slate-700',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-xl transition ${
                      isActive ? 'bg-brand-red/10 text-brand-red' : ''
                    }`}
                  >
                    <Icon
                      className="h-4 w-4"
                      strokeWidth={isActive ? 2.25 : 2}
                    />
                  </span>
                  <span className="max-w-full truncate">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
