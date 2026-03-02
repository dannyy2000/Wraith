import { Suspense } from 'react'
import { MarketFilters } from '@/components/markets/MarketFilters'
import { MarketList } from '@/components/markets/MarketList'
import { Spinner } from '@/components/ui/Spinner'
import Link from 'next/link'

export default function MarketsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Markets</h1>
          <p className="text-zinc-500 text-sm mt-1">Bet privately. Settle automatically.</p>
        </div>
        <Link
          href="/create"
          className="bg-wraith-purple hover:bg-wraith-purple-dim text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Create
        </Link>
      </div>

      <Suspense fallback={null}>
        <div className="mb-5">
          <MarketFilters />
        </div>
      </Suspense>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-20">
            <Spinner className="w-8 h-8 text-wraith-purple" />
          </div>
        }
      >
        <MarketList />
      </Suspense>
    </div>
  )
}
