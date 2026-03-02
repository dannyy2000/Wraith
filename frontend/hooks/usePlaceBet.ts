'use client'

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { CONTRACTS } from '@/lib/contracts'
import { generateSecret, generateNullifier, buildCommitment } from '@/lib/commitment'
import { saveBet } from '@/lib/bets-store'
import { Outcome } from '@/lib/types'

export function usePlaceBet() {
  const { writeContract, data: txHash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  function placeBet(
    marketId: bigint,
    outcome: Outcome,
    amountEth: string,
    question: string
  ) {
    const amountWei = parseEther(amountEth)
    const secret = generateSecret()
    const nullifier = generateNullifier()
    const commitment = buildCommitment(marketId, outcome, amountWei, secret, nullifier)

    writeContract(
      {
        ...CONTRACTS.pool,
        functionName: 'placeBet',
        args: [marketId, outcome, commitment],
        value: amountWei,
      },
      {
        onSuccess: () => {
          saveBet({
            marketId: marketId.toString(),
            outcome,
            amount: amountWei.toString(),
            secret,
            nullifier,
            placedAt: Date.now(),
            question,
          })
        },
      }
    )
  }

  return {
    placeBet,
    txHash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
  }
}
