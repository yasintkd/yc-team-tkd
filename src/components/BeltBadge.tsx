import { beltStyle } from '../lib/belts'

interface BeltBadgeProps {
  belt: string
  size?: 'sm' | 'md'
  showDot?: boolean
}

export default function BeltBadge({ belt, size = 'sm', showDot = true }: BeltBadgeProps) {
  const style = beltStyle(belt)
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs'
  const py = size === 'sm' ? 'py-0.5' : 'py-1'
  const px = size === 'sm' ? 'px-2' : 'px-2.5'
  const dotSize = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${px} ${py} ${textSize} font-semibold ${style.badge}`}
    >
      {showDot && <span className={`${dotSize} rounded-full ${style.dot}`} />}
      {belt}
    </span>
  )
}
