'use client'

import { useReadContracts } from 'wagmi'
import { CONTRACTS } from '@/lib/contracts'
import { Outcome } from '@/lib/types'

export function usePoolSizes(marketId: bigint) {
  const { data, isLoading } = useReadContracts({
    contracts: [
      {
        ...CONTRACTS.pool,
        functionName: 'getTotalPool',
        args: [marketId],
      },
      {
        ...CONTRACTS.pool,
        functionName: 'getPool',
        args: [marketId, Outcome.YES],
      },
      {
        ...CONTRACTS.pool,
        functionName: 'getPool',
        args: [marketId, Outcome.NO],
      },
    ],
  })

  return {
    total: data?.[0]?.result ?? 0n,
    yes: data?.[1]?.result ?? 0n,
    no: data?.[2]?.result ?? 0n,
    isLoading,
  }
}
