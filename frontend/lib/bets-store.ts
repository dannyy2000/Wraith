import type { StoredBet } from './types'

const KEY = 'wraith:bets'

export function loadBets(): StoredBet[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as StoredBet[]
  } catch {
    return []
  }
}

export function saveBet(bet: StoredBet): void {
  const bets = loadBets()
  localStorage.setItem(KEY, JSON.stringify([...bets, bet]))
}

export function getBetsForMarket(marketId: string): StoredBet[] {
  return loadBets().filter((b) => b.marketId === marketId)
}
