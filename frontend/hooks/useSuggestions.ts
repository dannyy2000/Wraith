'use client'

import { useState } from 'react'
import type { MarketSuggestion } from '@/lib/types'

export function useSuggestions() {
  const [suggestions, setSuggestions] = useState<MarketSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchSuggestions() {
    const url = process.env.NEXT_PUBLIC_CRE_SUGGESTER_URL
    if (!url) {
      setError('CRE suggester URL not configured.')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuggestions([])

    try {
      // Fire 3 requests in parallel — each triggers a fresh Reddit fetch + OpenAI call,
      // so the suggestions naturally vary. CRE returns one JSON suggestion per call.
      const results = await Promise.allSettled([
        fetch(url, { method: 'POST' }).then((r) => r.json()),
        fetch(url, { method: 'POST' }).then((r) => r.json()),
        fetch(url, { method: 'POST' }).then((r) => r.json()),
      ])

      const valid = results
        .filter(
          (r): r is PromiseFulfilledResult<MarketSuggestion> =>
            r.status === 'fulfilled' && !!r.value?.question
        )
        .map((r) => r.value)
        .filter(
          (s, i, arr) =>
            arr.findIndex((x) => x.question === s.question) === i
        )
        .slice(0, 3)

      setSuggestions(valid)
      if (valid.length === 0) setError('No suggestions returned. Try again.')
    } catch {
      setError('Failed to fetch suggestions.')
    } finally {
      setIsLoading(false)
    }
  }

  return { suggestions, isLoading, error, fetchSuggestions }
}
