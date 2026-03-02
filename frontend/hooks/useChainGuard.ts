'use client'

import { useChainId, useSwitchChain } from 'wagmi'
import { CHAIN } from '@/lib/contracts'

export function useChainGuard() {
  const chainId = useChainId()
  const { switchChain, isPending } = useSwitchChain()

  const isCorrectChain = chainId === CHAIN.id

  function switchToCorrectChain() {
    switchChain({ chainId: CHAIN.id })
  }

  return { isCorrectChain, switchToCorrectChain, isSwitching: isPending }
}
