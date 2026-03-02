'use client'

import { useState, useEffect } from 'react'

interface Countdown {
  days: number
  hours: number
  minutes: number
  seconds: number
  isPast: boolean
}

export function useCountdown(deadlineTs: bigint): Countdown {
  function calc(): Countdown {
    const diffMs = Number(deadlineTs) * 1000 - Date.now()
    if (diffMs <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true }

    const diffSec = Math.floor(diffMs / 1000)
    return {
      days: Math.floor(diffSec / 86400),
      hours: Math.floor((diffSec % 86400) / 3600),
      minutes: Math.floor((diffSec % 3600) / 60),
      seconds: diffSec % 60,
      isPast: false,
    }
  }

  const [countdown, setCountdown] = useState<Countdown>(calc)

  useEffect(() => {
    const id = setInterval(() => setCountdown(calc()), 1000)
    return () => clearInterval(id)
  }, [deadlineTs]) // eslint-disable-line react-hooks/exhaustive-deps

  return countdown
}
