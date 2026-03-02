'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { SuggestionPanel } from '@/components/create-market/SuggestionPanel'
import { CreateMarketForm } from '@/components/create-market/CreateMarketForm'
import type { MarketSuggestion } from '@/lib/types'

export default function CreatePage() {
  const [prefill, setPrefill] = useState<MarketSuggestion | null>(null)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Create Market</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Use AI suggestions or define your own resolution criteria.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left: AI suggestions */}
        <Card>
          <SuggestionPanel onSelect={setPrefill} />
        </Card>

        {/* Right: form */}
        <Card>
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">
            {prefill ? 'Review & Create' : 'Custom Market'}
          </h2>
          <CreateMarketForm prefill={prefill} />
        </Card>
      </div>
    </div>
  )
}
