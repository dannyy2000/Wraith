'use client'

import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { Button } from '@/components/ui/Button'
import { CONTRACTS } from '@/lib/contracts'
import { MarketStatus, Outcome } from '@/lib/types'
import type { Market } from '@/lib/types'

export function OptimisticActions({
  market,
  onSuccess,
}: {
  market: Market
  onSuccess?: () => void
}) {
  const { address } = useAccount()
  const [challengeAmount, setChallengeAmount] = useState('')
  const { writeContract, data: txHash, isPending, error } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const now = Math.floor(Date.now() / 1000)
  const deadlinePassed = now >= Number(market.config.deadline)
  const disputeOpen =
    market.status === MarketStatus.PENDING_RESOLUTION &&
    now < Number(market.disputeDeadline)
  const disputeClosed =
    market.status === MarketStatus.PENDING_RESOLUTION &&
    now >= Number(market.disputeDeadline)
  const isCreator = address?.toLowerCase() === market.creator.toLowerCase()

  function proposeOutcome(outcome: Outcome) {
    writeContract(
      { ...CONTRACTS.factory, functionName: 'proposeOutcome', args: [market.id, outcome] },
      { onSuccess }
    )
  }

  function challenge() {
    if (!challengeAmount) return
    writeContract(
      { ...CONTRACTS.factory, functionName: 'challenge', args: [market.id], value: parseEther(challengeAmount) },
      { onSuccess }
    )
  }

  function finalize() {
    writeContract(
      { ...CONTRACTS.factory, functionName: 'finalizeOptimistic', args: [market.id] },
      { onSuccess }
    )
  }

  if (isSuccess) {
    return (
      <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-4 text-sm text-green-400">
        Transaction confirmed.
        {txHash && (
          <a
            href={`https://sepolia.arbiscan.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline ml-1"
          >
            View ↗
          </a>
        )}
      </div>
    )
  }

  // Creator can propose after deadline
  if (market.status === MarketStatus.OPEN && deadlinePassed && isCreator) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-400">Propose the outcome for this market:</p>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => proposeOutcome(Outcome.YES)} loading={isPending} variant="secondary">
            Propose YES
          </Button>
          <Button onClick={() => proposeOutcome(Outcome.NO)} loading={isPending} variant="secondary">
            Propose NO
          </Button>
        </div>
        {error && <p className="text-xs text-red-400">{error.message.split('\n')[0]}</p>}
      </div>
    )
  }

  // Challenge window open
  if (disputeOpen) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-400">
          Creator proposed{' '}
          <span className={market.proposedOutcome === Outcome.YES ? 'text-green-400' : 'text-red-400'}>
            {market.proposedOutcome === Outcome.YES ? 'YES' : 'NO'}
          </span>
          . Challenge by matching the bond:
        </p>
        <input
          type="number"
          min="0.01"
          step="0.001"
          placeholder={`Min ${parseFloat(market.creatorBond.toString()) / 1e18} ETH`}
          value={challengeAmount}
          onChange={(e) => setChallengeAmount(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-wraith-purple"
        />
        <Button onClick={challenge} loading={isPending} variant="danger" className="w-full">
          Challenge
        </Button>
        {error && <p className="text-xs text-red-400">{error.message.split('\n')[0]}</p>}
      </div>
    )
  }

  // Dispute window closed, unchallenged — anyone can finalize
  if (disputeClosed) {
    return (
      <div className="space-y-2">
        <Button onClick={finalize} loading={isPending} variant="secondary" className="w-full">
          Finalize (Unchallenged)
        </Button>
        {error && <p className="text-xs text-red-400">{error.message.split('\n')[0]}</p>}
        <p className="text-xs text-zinc-600 text-center">
          48-hour dispute window closed with no challenge. Anyone can finalize.
        </p>
      </div>
    )
  }

  return null
}
