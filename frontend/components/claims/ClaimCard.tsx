'use client'

import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useClaimPreview } from '@/hooks/useClaimPreview'
import { useClaim } from '@/hooks/useClaim'
import { fmtEth } from '@/lib/format'
import { Outcome } from '@/lib/types'
import type { StoredBet } from '@/lib/types'

export function ClaimCard({ bet }: { bet: StoredBet }) {
  const { payout, nullifierUsed, isSettled, isWinner, canClaim, isLoading } =
    useClaimPreview(bet)
  const { claim, txHash, isPending, isSuccess, error } = useClaim()

  const outcomeLabel = bet.outcome === Outcome.YES ? 'YES' : 'NO'
  const outcomeColor = bet.outcome === Outcome.YES ? 'green' : 'red'

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-zinc-200 font-medium leading-snug flex-1">
          {bet.question}
        </p>
        <Badge label={outcomeLabel} color={outcomeColor} />
      </div>

      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span>Bet: {fmtEth(BigInt(bet.amount), 4)} ETH</span>
        <span>Market #{bet.marketId}</span>
      </div>

      {isLoading && (
        <p className="text-xs text-zinc-600">Checking status…</p>
      )}

      {!isLoading && (
        <>
          {!isSettled && (
            <p className="text-xs text-zinc-500">Market not yet settled.</p>
          )}

          {isSettled && !isWinner && (
            <p className="text-xs text-red-400">This outcome did not win.</p>
          )}

          {isSettled && isWinner && nullifierUsed && (
            <p className="text-xs text-zinc-500">Already claimed.</p>
          )}

          {canClaim && !isSuccess && (
            <div className="space-y-2">
              <p className="text-xs text-green-400 font-medium">
                Estimated payout: {fmtEth(payout, 4)} ETH
              </p>
              <Button
                onClick={() => claim(bet)}
                loading={isPending}
                className="w-full"
                size="sm"
              >
                Claim Winnings
              </Button>
              {error && (
                <p className="text-xs text-red-400">{error.message.split('\n')[0]}</p>
              )}
            </div>
          )}

          {isSuccess && txHash && (
            <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-xs text-green-400">
              Claimed!{' '}
              <a
                href={`https://sepolia.arbiscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                View on Arbiscan ↗
              </a>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
