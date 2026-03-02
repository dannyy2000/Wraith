'use client'

import { usePoolSizes } from '@/hooks/usePoolSizes'
import { fmtEth } from '@/lib/format'

export function PoolStats({ marketId }: { marketId: bigint }) {
  const { total, yes, no } = usePoolSizes(marketId)

  const yesPercent =
    total > 0n ? Math.round((Number(yes) / Number(total)) * 100) : 50
  const noPercent = 100 - yesPercent

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-zinc-400">Pool</h3>

      {/* Bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-zinc-800">
        <div
          className="bg-green-500 transition-all"
          style={{ width: `${yesPercent}%` }}
        />
        <div
          className="bg-red-500 transition-all"
          style={{ width: `${noPercent}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-zinc-500 mb-0.5">YES</p>
          <p className="text-base font-semibold text-green-400">{fmtEth(yes)} ETH</p>
          <p className="text-xs text-zinc-600">{yesPercent}%</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 mb-0.5">Total</p>
          <p className="text-base font-semibold text-zinc-200">{fmtEth(total)} ETH</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 mb-0.5">NO</p>
          <p className="text-base font-semibold text-red-400">{fmtEth(no)} ETH</p>
          <p className="text-xs text-zinc-600">{noPercent}%</p>
        </div>
      </div>
    </div>
  )
}
