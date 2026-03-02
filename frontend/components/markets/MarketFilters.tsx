'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'

const FILTERS = [
  { label: 'All', value: '' },
  { label: 'Open', value: '0' },
  { label: 'Pending', value: '1' },
  { label: 'Disputed', value: '2' },
  { label: 'Settled', value: '3' },
]

export function MarketFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get('status') ?? ''

  function setFilter(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set('status', value)
    } else {
      params.delete('status')
    }
    router.push(`/markets?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => setFilter(f.value)}
          className={clsx(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
            current === f.value
              ? 'bg-wraith-purple text-white'
              : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
