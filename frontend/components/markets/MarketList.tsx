'use client'

import { useSearchParams } from 'next/navigation'
import { useAllMarkets } from '@/hooks/useAllMarkets'
import { MarketCard } from './MarketCard'
import { Spinner } from '@/components/ui/Spinner'
import type { Market } from '@/lib/types'

export function MarketList() {
  const { markets, isLoading } = useAllMarkets()
  const searchParams = useSearchParams()
  const statusFilter = searchParams.get('status')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="w-8 h-8 text-wraith-purple" />
      </div>
    )
  }

  if (markets.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-zinc-400 text-sm">No markets yet.</p>
        <p className="text-zinc-600 text-xs mt-1">Be the first to create one.</p>
      </div>
    )
  }

  const filtered: Market[] =
    statusFilter !== null
      ? markets.filter((m) => m.status === Number(statusFilter))
      : markets

  if (filtered.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-zinc-400 text-sm">No markets match this filter.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {filtered.map((market) => (
        <MarketCard key={market.id.toString()} market={market} />
      ))}
    </div>
  )
}
