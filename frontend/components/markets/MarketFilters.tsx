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
          style={
            current === f.value
              ? { background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', color: 'white' }
              : {}
          }
          className={clsx(
            'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all',
            current === f.value
              ? 'shadow-glow-purple'
              : 'text-zinc-500 hover:text-zinc-200 border border-white/8 hover:border-white/15'
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
