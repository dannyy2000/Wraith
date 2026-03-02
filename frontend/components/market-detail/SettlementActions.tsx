'use client'

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { Button } from '@/components/ui/Button'
import { CONTRACTS } from '@/lib/contracts'

interface SettlementActionsProps {
  marketId: bigint
  onSuccess?: () => void
}

export function SettlementActions({ marketId, onSuccess }: SettlementActionsProps) {
  const { writeContract, data: txHash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  function requestSettlement() {
    writeContract(
      { ...CONTRACTS.factory, functionName: 'requestSettlement', args: [marketId] },
      { onSuccess }
    )
  }

  if (isSuccess) {
    return (
      <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-4 text-sm text-blue-400">
        Settlement requested. Chainlink CRE will resolve this market shortly.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={requestSettlement}
        loading={isPending || isConfirming}
        variant="secondary"
        className="w-full"
      >
        Request Settlement
      </Button>
      {error && <p className="text-xs text-red-400">{error.message.split('\n')[0]}</p>}
      <p className="text-xs text-zinc-600 text-center">
        Anyone can trigger settlement after the deadline. Chainlink CRE resolves it automatically.
      </p>
    </div>
  )
}
