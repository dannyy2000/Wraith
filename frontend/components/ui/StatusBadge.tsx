import { Badge } from './Badge'
import { MarketStatus, ResolutionType } from '@/lib/types'

export function StatusBadge({ status }: { status: MarketStatus }) {
  switch (status) {
    case MarketStatus.OPEN:
      return <Badge label="Open" color="green" />
    case MarketStatus.PENDING_RESOLUTION:
      return <Badge label="Pending" color="yellow" />
    case MarketStatus.DISPUTED:
      return <Badge label="Disputed" color="orange" />
    case MarketStatus.SETTLED:
      return <Badge label="Settled" color="zinc" />
  }
}

export function ResolutionTypeBadge({ type }: { type: ResolutionType }) {
  switch (type) {
    case ResolutionType.PRICE_FEED:
      return <Badge label="Price Feed" color="blue" />
    case ResolutionType.API_POLL:
      return <Badge label="API Poll" color="cyan" />
    case ResolutionType.AI_VERDICT:
      return <Badge label="AI Verdict" color="purple" />
    case ResolutionType.OPTIMISTIC:
      return <Badge label="Optimistic" color="yellow" />
  }
}
