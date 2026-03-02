'use client'

import { useState, useEffect } from 'react'
import { loadBets } from '@/lib/bets-store'
import type { StoredBet } from '@/lib/types'

export function useStoredBets(): StoredBet[] {
  const [bets, setBets] = useState<StoredBet[]>([])

  useEffect(() => {
    setBets(loadBets())
  }, [])

  return bets
}
