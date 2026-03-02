'use client'

import { Button } from '@/components/ui/Button'
import { SuggestionCard } from './SuggestionCard'
import { useSuggestions } from '@/hooks/useSuggestions'
import type { MarketSuggestion } from '@/lib/types'

export function SuggestionPanel({
  onSelect,
}: {
  onSelect: (suggestion: MarketSuggestion) => void
}) {
  const { suggestions, isLoading, error, fetchSuggestions } = useSuggestions()

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-300">AI Suggestions</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Powered by Reddit trends + Claude
        </p>
      </div>

      <Button
        onClick={fetchSuggestions}
        loading={isLoading}
        variant="secondary"
        className="w-full"
      >
        {suggestions.length > 0 ? 'Refresh suggestions' : 'Get AI suggestions'}
      </Button>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {suggestions.length > 0 && (
        <div className="space-y-3">
          {suggestions.map((s, i) => (
            <SuggestionCard key={i} suggestion={s} onSelect={onSelect} />
          ))}
        </div>
      )}

      {!isLoading && suggestions.length === 0 && !error && (
        <p className="text-xs text-zinc-600 text-center py-6">
          Click above to generate AI-assisted market ideas from trending crypto topics.
        </p>
      )}
    </div>
  )
}
