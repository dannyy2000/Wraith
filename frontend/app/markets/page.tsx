import { Suspense } from 'react'
import { MarketFilters } from '@/components/markets/MarketFilters'
import { MarketList } from '@/components/markets/MarketList'
import { Spinner } from '@/components/ui/Spinner'
import { WraithIcon } from '@/components/layout/Logo'
import Link from 'next/link'

export default function MarketsPage() {
  return (
    <div>
      {/* Hero */}
      <div className="text-center py-14 mb-10 relative">
        {/* Glow orb behind icon */}
        <div
          className="absolute top-6 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)' }}
        />
        <div className="flex justify-center mb-5">
          <WraithIcon className="w-14 h-14 drop-shadow-[0_0_16px_rgba(139,92,246,0.6)]" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
          Prediction markets,{' '}
          <span className="text-gradient-purple">privately.</span>
        </h1>
        <p className="text-zinc-500 text-base max-w-md mx-auto leading-relaxed">
          Bet anonymously via commitment hashes. Markets resolve automatically through Chainlink CRE and Claude.
        </p>
        <div className="mt-7">
          <Link
            href="/create"
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl text-white transition-all hover:shadow-glow-purple"
            style={{
              background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
              boxShadow: '0 0 20px rgba(139,92,246,0.3)',
            }}
          >
            + Create a market
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Suspense fallback={null}>
        <div className="mb-5">
          <MarketFilters />
        </div>
      </Suspense>

      {/* Market grid */}
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
