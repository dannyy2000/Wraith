'use client'

import Link from 'next/link'
import { useMarket } from '@/hooks/useMarket'
import { PoolStats } from '@/components/market-detail/PoolStats'
import { BetForm } from '@/components/market-detail/BetForm'
import { OptimisticActions } from '@/components/market-detail/OptimisticActions'
import { SettlementActions } from '@/components/market-detail/SettlementActions'
import { ReasoningCard } from '@/components/market-detail/ReasoningCard'
import { StatusBadge, ResolutionTypeBadge } from '@/components/ui/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { fmtAddress, fmtDeadline } from '@/lib/format'
import { MarketStatus, ResolutionType, Outcome } from '@/lib/types'

export default function MarketDetailPage({ params }: { params: { id: string } }) {
  const marketId = BigInt(params.id)
  const { market, isLoading, refetch } = useMarket(marketId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="w-8 h-8 text-wraith-purple" />
      </div>
    )
  }

  if (!market) {
    return (
      <div className="text-center py-20">
        <p className="text-zinc-400">Market not found.</p>
        <Link href="/markets" className="text-wraith-purple text-sm mt-2 block">
          ← Back to markets
        </Link>
      </div>
    )
  }

  const now = Math.floor(Date.now() / 1000)
  const deadlinePassed = now >= Number(market.config.deadline)
  const isOpen = market.status === MarketStatus.OPEN
  const isSettled = market.status === MarketStatus.SETTLED
  const isOptimistic = market.config.resolutionType === ResolutionType.OPTIMISTIC
  const showBetForm = isOpen && !deadlinePassed
  const showSettlementActions = isOpen && deadlinePassed && !isOptimistic
  const showOptimisticActions =
    isOptimistic &&
    (isOpen || market.status === MarketStatus.PENDING_RESOLUTION)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back link */}
      <Link href="/markets" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
        ← Markets
      </Link>

      {/* Header */}
      <Card>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <StatusBadge status={market.status} />
          <ResolutionTypeBadge type={market.config.resolutionType} />
          {isSettled && (
            <span
              className={`text-sm font-semibold ${
                market.outcome === Outcome.YES ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {market.outcome === Outcome.YES ? '✓ YES' : '✗ NO'}
            </span>
          )}
        </div>
        <h1 className="text-xl font-bold text-white mb-4 leading-snug">
          {market.question}
        </h1>
        <div className="grid grid-cols-2 gap-4 text-sm text-zinc-500">
          <div>
            <span className="text-zinc-600">Creator </span>
            <span className="text-zinc-400 font-mono">{fmtAddress(market.creator)}</span>
          </div>
          <div>
            <span className="text-zinc-600">Deadline </span>
            <span className="text-zinc-400">{fmtDeadline(market.config.deadline)}</span>
          </div>
        </div>
      </Card>

      {/* AI Reasoning (settled markets) */}
      {isSettled && market.reasoning && (
        <ReasoningCard reasoning={market.reasoning} />
      )}

      {/* Pool stats */}
      <Card>
        <PoolStats marketId={marketId} />
      </Card>

      {/* Action panels */}
      {showBetForm && (
        <Card>
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Place a Bet</h3>
          <BetForm marketId={marketId} question={market.question} />
        </Card>
      )}

      {showSettlementActions && (
        <Card>
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Settle Market</h3>
          <SettlementActions marketId={marketId} onSuccess={refetch} />
        </Card>
      )}

      {showOptimisticActions && (
        <Card>
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Optimistic Resolution</h3>
          <OptimisticActions market={market} onSuccess={refetch} />
        </Card>
      )}

      {/* Resolution config details */}
      <Card className="text-xs text-zinc-600 space-y-1">
        <p className="text-zinc-500 font-medium mb-2">Resolution Config</p>
        {market.config.source && <p>Source: {market.config.source}</p>}
        {market.config.condition && <p>Condition: {market.config.condition}</p>}
        {market.config.resolutionPrompt && (
          <p>Prompt: {market.config.resolutionPrompt}</p>
        )}
      </Card>
    </div>
  )
}
