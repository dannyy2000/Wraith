'use client'

import { useCountdown } from '@/hooks/useCountdown'

export function CountdownTimer({ deadlineTs }: { deadlineTs: bigint }) {
  const { days, hours, minutes, seconds, isPast } = useCountdown(deadlineTs)

  if (isPast) {
    return <span className="text-zinc-500 text-xs">Expired</span>
  }

  return (
    <span className="text-xs tabular-nums text-zinc-400">
      {days > 0 && `${days}d `}
      {String(hours).padStart(2, '0')}h {String(minutes).padStart(2, '0')}m{' '}
      {String(seconds).padStart(2, '0')}s
    </span>
  )
}
