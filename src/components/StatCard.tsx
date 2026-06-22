import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string
  hint?: string
  trendLabel?: string
  trendPositive?: boolean
  icon: LucideIcon
  onClick?: () => void
}

export default function StatCard({
  label,
  value,
  hint,
  trendLabel,
  trendPositive = true,
  icon: Icon,
  onClick,
}: StatCardProps) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={`glass-panel flex flex-1 flex-col rounded-2xl p-4 shadow-lg ${
        onClick
          ? 'cursor-pointer text-left transition hover:scale-[1.02] hover:shadow-xl active:scale-[0.99]'
          : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
          {label}
        </p>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xl font-semibold tracking-tight text-slate-800 sm:text-2xl">
          {value}
        </p>
        {trendLabel && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              trendPositive
                ? 'bg-sky-100 text-sky-800'
                : 'bg-rose-100 text-rose-700'
            }`}
          >
            {trendLabel}
          </span>
        )}
      </div>
      {hint && (
        <p className="mt-1 text-[11px] leading-relaxed text-brand-muted">{hint}</p>
      )}
    </Comp>
  )
}