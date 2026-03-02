'use client'

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { CONTRACTS } from '@/lib/contracts'
import { ResolutionType } from '@/lib/types'
import type { ResolutionConfig } from '@/lib/types'

export function useCreateMarket() {
  const { writeContract, data: txHash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  function createMarket(question: string, config: ResolutionConfig) {
    const value =
      config.resolutionType === ResolutionType.OPTIMISTIC
        ? parseEther('0.01')
        : 0n

    writeContract({
      ...CONTRACTS.factory,
      functionName: 'createMarket',
      args: [question, config],
      value,
    })
  }

  return {
    createMarket,
    txHash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
  }
}
