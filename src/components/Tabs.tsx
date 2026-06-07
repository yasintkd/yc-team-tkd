import type { LucideIcon } from 'lucide-react'

interface Tab {
  key: string
  label: string
  icon?: LucideIcon
}

interface TabsProps {
  tabs: readonly Tab[] | Tab[]
  active: string
  onChange: (key: string) => void
}

export default function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex flex-wrap gap-1 rounded-2xl bg-white/70 p-1 shadow-sm ring-1 ring-app-border">
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
            active === key
              ? 'bg-brand-red text-white shadow-sm'
              : 'text-slate-600 hover:bg-app-bg-soft'
          }`}
        >
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </button>
      ))}
    </div>
  )
}
