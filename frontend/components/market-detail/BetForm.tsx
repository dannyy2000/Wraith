'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Button } from '@/components/ui/Button'
import { usePlaceBet } from '@/hooks/usePlaceBet'
import { Outcome } from '@/lib/types'
import { clsx } from 'clsx'

interface BetFormProps {
  marketId: bigint
  question: string
}

export function BetForm({ marketId, question }: BetFormProps) {
  const { isConnected } = useAccount()
  const [outcome, setOutcome] = useState<Outcome>(Outcome.YES)
  const [amount, setAmount] = useState('')
  const { placeBet, txHash, isPending, isSuccess, error } = usePlaceBet()

  if (!isConnected) {
    return (
      <div className="text-center py-4">
        <p className="text-zinc-400 text-sm mb-3">Connect your wallet to place a bet.</p>
        <ConnectButton />
      </div>
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) return
    placeBet(marketId, outcome, amount, question)
  }

  if (isSuccess && txHash) {
    return (
      <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-4 text-sm text-green-400">
        <p className="font-medium mb-1">Bet placed!</p>
        <p className="text-xs text-green-500/80">
          Your secret and nullifier are saved locally. Use My Claims to collect
          your winnings from any wallet after the market settles.
        </p>
        <a
          href={`https://sepolia.arbiscan.io/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline mt-2 block"
        >
          View on Arbiscan ↗
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* YES / NO toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setOutcome(Outcome.YES)}
          className={clsx(
            'py-3 rounded-lg text-sm font-semibold transition-colors border',
            outcome === Outcome.YES
              ? 'bg-green-500/20 border-green-500 text-green-400'
              : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
          )}
        >
          YES
        </button>
        <button
          type="button"
          onClick={() => setOutcome(Outcome.NO)}
          className={clsx(
            'py-3 rounded-lg text-sm font-semibold transition-colors border',
            outcome === Outcome.NO
              ? 'bg-red-500/20 border-red-500 text-red-400'
              : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
          )}
        >
          NO
        </button>
      </div>

      {/* Amount */}
      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Amount (ETH)</label>
        <input
          type="number"
          min="0.001"
          step="0.001"
          placeholder="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-wraith-purple"
        />
      </div>

      {error && (
        <p className="text-xs text-red-400">{error.message.split('\n')[0]}</p>
      )}

      <Button type="submit" loading={isPending} className="w-full" size="lg">
        Place Bet
      </Button>

      <p className="text-xs text-zinc-600 text-center">
        Your commitment is private. Claim from any wallet.
      </p>
    </form>
  )
}
