import { clsx } from 'clsx'

type Color = 'green' | 'yellow' | 'orange' | 'red' | 'purple' | 'blue' | 'zinc' | 'cyan'

interface BadgeProps {
  label: string
  color?: Color
  className?: string
}

const colorClasses: Record<Color, string> = {
  green:  'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/25',
  yellow: 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/25',
  orange: 'bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/25',
  red:    'bg-red-500/10 text-red-400 ring-1 ring-red-500/25',
  purple: 'bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/25',
  blue:   'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/25',
  zinc:   'bg-zinc-500/10 text-zinc-400 ring-1 ring-zinc-500/20',
  cyan:   'bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/25',
}

export function Badge({ label, color = 'zinc', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide',
        colorClasses[color],
        className
      )}
    >
      {label}
    </span>
  )
}
