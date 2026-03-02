import { clsx } from 'clsx'

type Color = 'green' | 'yellow' | 'orange' | 'red' | 'purple' | 'blue' | 'zinc' | 'cyan'

interface BadgeProps {
  label: string
  color?: Color
  className?: string
}

const colorClasses: Record<Color, string> = {
  green:  'bg-green-500/15 text-green-400 ring-1 ring-green-500/30',
  yellow: 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30',
  orange: 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30',
  red:    'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
  purple: 'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/30',
  blue:   'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30',
  zinc:   'bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/30',
  cyan:   'bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/30',
}

export function Badge({ label, color = 'zinc', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        colorClasses[color],
        className
      )}
    >
      {label}
    </span>
  )
}
