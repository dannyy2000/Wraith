'use client'

import { useChainGuard } from '@/hooks/useChainGuard'
import { Button } from './Button'

export function ChainGuard({ children }: { children: React.ReactNode }) {
  const { isCorrectChain, switchToCorrectChain, isSwitching } = useChainGuard()

  if (!isCorrectChain) {
    return (
      <div className="text-center py-4 space-y-2">
        <p className="text-zinc-400 text-sm">Switch to Arbitrum Sepolia to continue.</p>
        <Button onClick={switchToCorrectChain} loading={isSwitching} variant="secondary" size="sm">
          Switch Network
        </Button>
      </div>
    )
  }

  return <>{children}</>
}
