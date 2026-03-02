'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { StatusBadge, ResolutionTypeBadge } from '@/components/ui/StatusBadge'
import { usePoolSizes } from '@/hooks/usePoolSizes'
import { fmtEth, fmtCountdown } from '@/lib/format'
import type { Market } from '@/lib/types'
import { MarketStatus } from '@/lib/types'

export function MarketCard({ market }: { market: Market }) {
  const { total, yes, no } = usePoolSizes(market.id)
  const isPast = Number(market.config.deadline) * 1000 < Date.now()

  return (
    <Link href={`/markets/${market.id}`}>
      <Card className="hover:border-zinc-600 transition-colors cursor-pointer h-full flex flex-col gap-4">
        {/* Header badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={market.status} />
          <ResolutionTypeBadge type={market.config.resolutionType} />
        </div>

        {/* Question */}
        <p className="text-zinc-100 font-medium text-sm leading-snug line-clamp-3 flex-1">
          {market.question}
        </p>

        {/* Pool sizes */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-zinc-500 mb-0.5">YES</p>
            <p className="text-sm font-medium text-green-400">{fmtEth(yes)} ETH</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-0.5">Total</p>
            <p className="text-sm font-medium text-zinc-200">{fmtEth(total)} ETH</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-0.5">NO</p>
            <p className="text-sm font-medium text-red-400">{fmtEth(no)} ETH</p>
          </div>
        </div>

        {/* Deadline */}
        <div className="text-xs text-zinc-500">
          {market.status === MarketStatus.OPEN && !isPast
            ? `Closes in ${fmtCountdown(market.config.deadline)}`
            : market.status === MarketStatus.SETTLED
            ? `Settled`
            : `Deadline passed`}
        </div>
      </Card>
    </Link>
  )
}
