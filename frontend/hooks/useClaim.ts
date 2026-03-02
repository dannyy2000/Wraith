'use client'

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACTS } from '@/lib/contracts'
import type { StoredBet } from '@/lib/types'

export function useClaim() {
  const { writeContract, data: txHash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  function claim(bet: StoredBet) {
    writeContract({
      ...CONTRACTS.registry,
      functionName: 'claim',
      args: [
        BigInt(bet.marketId),
        bet.outcome,
        BigInt(bet.amount),
        bet.secret,
        bet.nullifier,
      ],
    })
  }

  return {
    claim,
    txHash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
  }
}
