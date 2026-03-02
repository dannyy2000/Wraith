import { clsx } from 'clsx'
import { ResolutionType } from '@/lib/types'

const TYPES = [
  {
    type: ResolutionType.PRICE_FEED,
    label: 'Price Feed',
    icon: '📈',
    desc: 'Resolved by a Chainlink price feed against a condition',
  },
  {
    type: ResolutionType.API_POLL,
    label: 'API Poll',
    icon: '🔌',
    desc: 'Resolved by calling an external API endpoint',
  },
  {
    type: ResolutionType.AI_VERDICT,
    label: 'AI Verdict',
    icon: '🤖',
    desc: 'Claude reads news sources and gives a YES/NO verdict',
  },
  {
    type: ResolutionType.OPTIMISTIC,
    label: 'Optimistic',
    icon: '🤝',
    desc: 'Creator proposes outcome; 48h dispute window',
  },
]

interface ResolutionTypeSelectorProps {
  value: ResolutionType
  onChange: (type: ResolutionType) => void
}

export function ResolutionTypeSelector({ value, onChange }: ResolutionTypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {TYPES.map(({ type, label, icon, desc }) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(type)}
          className={clsx(
            'text-left p-3 rounded-lg border transition-colors',
            value === type
              ? 'border-wraith-purple bg-purple-500/10 text-white'
              : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
          )}
        >
          <div className="text-base mb-1">{icon}</div>
          <div className="text-xs font-medium">{label}</div>
          <div className="text-xs text-zinc-600 mt-0.5 leading-tight">{desc}</div>
        </button>
      ))}
    </div>
  )
}
