'use client'

import { useReadContract, useReadContracts } from 'wagmi'
import { CONTRACTS } from '@/lib/contracts'
import type { Market } from '@/lib/types'

export function useAllMarkets() {
  const { data: ids, isLoading: idsLoading } = useReadContract({
    ...CONTRACTS.factory,
    functionName: 'getAllMarketIds',
  })

  const contracts = (ids ?? []).map((id) => ({
    ...CONTRACTS.factory,
    functionName: 'getMarket' as const,
    args: [id] as const,
  }))

  const { data: rawMarkets, isLoading: marketsLoading } = useReadContracts({
    contracts,
    query: { enabled: !!ids && ids.length > 0 },
  })

  const markets: Market[] = (rawMarkets ?? [])
    .filter((r) => r.status === 'success')
    .map((r) => r.result as Market)

  return {
    markets,
    isLoading: idsLoading || marketsLoading,
    count: ids?.length ?? 0,
  }
}
