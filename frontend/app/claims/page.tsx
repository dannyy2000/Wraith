'use client'

import { useStoredBets } from '@/hooks/useStoredBets'
import { ClaimCard } from '@/components/claims/ClaimCard'
import Link from 'next/link'

export default function ClaimsPage() {
  const bets = useStoredBets()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">My Claims</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Your bet secrets are stored locally. Claims can be submitted from any wallet.
        </p>
      </div>

      {/* Privacy callout */}
      <div className="mb-6 rounded-lg bg-purple-500/10 border border-purple-500/20 p-4 text-xs text-purple-300">
        <span className="font-semibold">Privacy note:</span> Your secret and nullifier are stored
        only in this browser. To claim from a different wallet, copy your bet details first.
        Never share your secret.
      </div>

      {bets.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-400 text-sm">No bets found in this browser.</p>
          <Link
            href="/markets"
            className="text-wraith-purple text-sm mt-2 block hover:underline"
          >
            Browse markets to place a bet →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bets.map((bet, i) => (
            <ClaimCard key={`${bet.marketId}-${bet.nullifier}-${i}`} bet={bet} />
          ))}
        </div>
      )}
    </div>
  )
}
