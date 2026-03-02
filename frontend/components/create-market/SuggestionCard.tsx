import { ResolutionTypeBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { MarketSuggestion } from '@/lib/types'
import { ResolutionType } from '@/lib/types'

interface SuggestionCardProps {
  suggestion: MarketSuggestion
  onSelect: (suggestion: MarketSuggestion) => void
}

export function SuggestionCard({ suggestion, onSelect }: SuggestionCardProps) {
  return (
    <Card className="flex flex-col gap-3 hover:border-zinc-600 transition-colors">
      <div className="flex items-center gap-2">
        <ResolutionTypeBadge type={suggestion.resolutionType as ResolutionType} />
      </div>

      <p className="text-sm text-zinc-100 font-medium leading-snug flex-1">
        {suggestion.question}
      </p>

      {suggestion.redditSource && (
        <p className="text-xs text-zinc-600 line-clamp-1">
          Inspired by: &ldquo;{suggestion.redditSource}&rdquo;
        </p>
      )}

      <Button
        variant="secondary"
        size="sm"
        onClick={() => onSelect(suggestion)}
        className="w-full"
      >
        Use this suggestion
      </Button>
    </Card>
  )
}
