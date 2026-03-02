'use client'

import { useReadContract } from 'wagmi'
import { CONTRACTS } from '@/lib/contracts'
import type { Market } from '@/lib/types'

export function useMarket(marketId: bigint) {
  const { data, isLoading, error, refetch } = useReadContract({
    ...CONTRACTS.factory,
    functionName: 'getMarket',
    args: [marketId],
  })

  return {
    market: data as Market | undefined,
    isLoading,
    error,
    refetch,
  }
}
