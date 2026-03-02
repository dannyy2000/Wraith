import { formatEther } from 'viem'
import { ResolutionType } from './types'

export function fmtEth(wei: bigint, decimals = 4): string {
  return parseFloat(formatEther(wei)).toFixed(decimals)
}

export function fmtAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function fmtDeadline(deadlineTs: bigint): string {
  return new Date(Number(deadlineTs) * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function fmtResolutionType(type: ResolutionType): string {
  return ['Price Feed', 'API Poll', 'AI Verdict', 'Optimistic'][type]
}

export function fmtCountdown(deadlineTs: bigint): string {
  const diffMs = Number(deadlineTs) * 1000 - Date.now()
  if (diffMs <= 0) return 'Expired'

  const diffSec = Math.floor(diffMs / 1000)
  const d = Math.floor(diffSec / 86400)
  const h = Math.floor((diffSec % 86400) / 3600)
  const m = Math.floor((diffSec % 3600) / 60)

  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
