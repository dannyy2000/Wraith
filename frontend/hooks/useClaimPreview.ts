'use client'

import { useReadContracts } from 'wagmi'
import { CONTRACTS } from '@/lib/contracts'
import { MarketStatus, Outcome } from '@/lib/types'
import type { Market, StoredBet } from '@/lib/types'

export function useClaimPreview(bet: StoredBet) {
  const marketId = BigInt(bet.marketId)
  const betAmount = BigInt(bet.amount)

  const { data, isLoading } = useReadContracts({
    contracts: [
      {
        ...CONTRACTS.factory,
        functionName: 'getMarket',
        args: [marketId],
      },
      {
        ...CONTRACTS.registry,
        functionName: 'previewPayout',
        args: [marketId, bet.outcome, betAmount],
      },
      {
        ...CONTRACTS.registry,
        functionName: 'isNullifierUsed',
        args: [bet.nullifier],
      },
    ],
  })

  const market = data?.[0]?.result as Market | undefined
  const payout = data?.[1]?.result as bigint | undefined
  const nullifierUsed = data?.[2]?.result as boolean | undefined

  const isSettled = market?.status === MarketStatus.SETTLED
  const isWinner = isSettled && market?.outcome === bet.outcome
  const canClaim = isWinner && !nullifierUsed

  return {
    market,
    payout: payout ?? 0n,
    nullifierUsed: nullifierUsed ?? false,
    isSettled,
    isWinner,
    canClaim,
    isLoading,
  }
}
