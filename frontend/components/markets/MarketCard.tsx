'use client'

import Link from 'next/link'
import { StatusBadge, ResolutionTypeBadge } from '@/components/ui/StatusBadge'
import { usePoolSizes } from '@/hooks/usePoolSizes'
import { fmtEth, fmtCountdown } from '@/lib/format'
import type { Market } from '@/lib/types'
import { MarketStatus, Outcome } from '@/lib/types'

export function MarketCard({ market }: { market: Market }) {
  const { total, yes, no } = usePoolSizes(market.id)
  const isPast = Number(market.config.deadline) * 1000 < Date.now()
  const isSettled = market.status === MarketStatus.SETTLED

  const yesPercent = total > 0n ? Math.round((Number(yes) / Number(total)) * 100) : 50
  const noPercent = 100 - yesPercent

  return (
    <Link href={`/markets/${market.id}`} className="group block h-full">
      <div
        className="h-full rounded-2xl p-[1px] transition-all duration-300 group-hover:shadow-card-hover"
        style={{
          background: 'rgba(255,255,255,0.06)',
        }}
      >
        <div
          className="h-full rounded-2xl p-5 flex flex-col gap-4 transition-all duration-300"
          style={{ background: 'linear-gradient(145deg, #0d0d1c 0%, #111122 100%)' }}
        >
          {/* Header badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={market.status} />
            <ResolutionTypeBadge type={market.config.resolutionType} />
          </div>

          {/* Question */}
          <p className="text-[15px] text-zinc-100 font-medium leading-snug line-clamp-3 flex-1">
            {market.question}
          </p>

          {/* YES/NO bar */}
          <div className="flex h-1 rounded-full overflow-hidden gap-0.5">
            <div
              className="rounded-full transition-all duration-500"
              style={{
                width: `${yesPercent}%`,
                background: 'linear-gradient(90deg, #10b981, #059669)',
              }}
            />
            <div
              className="rounded-full transition-all duration-500"
              style={{
                width: `${noPercent}%`,
                background: 'linear-gradient(90deg, #ef4444, #dc2626)',
              }}
            />
          </div>

          {/* Pool stats */}
          <div className="grid grid-cols-3 gap-1 text-center">
            <div>
              <p className="text-xs text-zinc-600 mb-0.5">YES</p>
              <p className="text-sm font-semibold text-emerald-400">{fmtEth(yes, 3)} ETH</p>
            </div>
            <div>
              <p className="text-xs text-zinc-600 mb-0.5">Pool</p>
              <p className="text-sm font-semibold text-zinc-200">{fmtEth(total, 3)} ETH</p>
            </div>
            <div>
              <p className="text-xs text-zinc-600 mb-0.5">NO</p>
              <p className="text-sm font-semibold text-red-400">{fmtEth(no, 3)} ETH</p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <span className="text-xs text-zinc-600">
              {isSettled
                ? `Settled ${market.outcome === Outcome.YES ? '· YES ✓' : '· NO ✗'}`
                : isPast
                ? 'Deadline passed'
                : `Closes in ${fmtCountdown(market.config.deadline)}`}
            </span>
            <span className="text-xs text-violet-500 group-hover:text-violet-400 transition-colors">
              View →
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
