import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string
  hint?: string
  trendLabel?: string
  trendPositive?: boolean
  icon: LucideIcon
}

export default function StatCard({
  label,
  value,
  hint,
  trendLabel,
  trendPositive = true,
  icon: Icon,
}: StatCardProps) {
  return (
    <div className="glass-panel flex flex-1 flex-col rounded-2xl p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {trendLabel && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              trendPositive
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-rose-500/15 text-rose-400'
            }`}
          >
            {trendLabel}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  )
}
