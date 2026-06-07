interface SkeletonProps {
  /** card | table-row | list-item | line */
  variant?: 'card' | 'table-row' | 'list-item' | 'line'
  count?: number
  className?: string
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`shimmer rounded-lg ${className}`} />
}

export default function LoadingSkeleton({
  variant = 'card',
  count = 1,
  className = '',
}: SkeletonProps) {
  const items = Array.from({ length: count })

  switch (variant) {
    case 'card':
      return (
        <div className={`space-y-4 ${className}`}>
          {items.map((_, i) => (
            <div key={i} className="glass-panel rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-8 w-8 rounded-xl" />
              </div>
              <SkeletonBlock className="h-7 w-20" />
              <SkeletonBlock className="h-3 w-36" />
            </div>
          ))}
        </div>
      )

    case 'table-row':
      return (
        <div className={`space-y-2 ${className}`}>
          {items.map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-app-border bg-white px-4 py-3"
            >
              <SkeletonBlock className="h-3 w-32" />
              <SkeletonBlock className="h-3 w-16" />
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="ml-auto h-6 w-14 rounded-lg" />
            </div>
          ))}
        </div>
      )

    case 'list-item':
      return (
        <div className={`space-y-2 ${className}`}>
          {items.map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-app-border bg-white px-3 py-2.5"
            >
              <SkeletonBlock className="h-3 w-28" />
              <SkeletonBlock className="h-3 w-12" />
              <SkeletonBlock className="ml-auto h-5 w-5 rounded-full" />
            </div>
          ))}
        </div>
      )

    case 'line':
      return (
        <div className={`space-y-2 ${className}`}>
          {items.map((_, i) => (
            <SkeletonBlock
              key={i}
              className={`h-4 ${i % 2 === 0 ? 'w-full' : 'w-3/4'}`}
            />
          ))}
        </div>
      )

    default:
      return null
  }
}
