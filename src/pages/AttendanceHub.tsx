import { useState } from 'react'
import Attendance from './Attendance'
import Groups from './Groups'

const TABS = [
  { key: 'yoklama', label: 'Yoklama' },
  { key: 'gruplar', label: 'Gruplar' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function AttendanceHub() {
  const [tab, setTab] = useState<TabKey>('yoklama')

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl bg-white/70 p-1 shadow-sm ring-1 ring-app-border">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium transition ${
              tab === key
                ? 'bg-brand-red text-white shadow-sm'
                : 'text-slate-600 hover:bg-app-bg-soft'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'yoklama' ? <Attendance /> : <Groups />}
    </div>
  )
}
