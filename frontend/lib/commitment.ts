import { keccak256, encodePacked, toHex } from 'viem'
import { Outcome } from './types'

export function generateSecret(): `0x${string}` {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return toHex(bytes)
}

export function generateNullifier(): `0x${string}` {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return toHex(bytes)
}

// Replicates: keccak256(abi.encodePacked(marketId, outcome, betAmount, secret, nullifier))
// from ClaimRegistry.sol — types must match exactly or claims will fail.
export function buildCommitment(
  marketId: bigint,
  outcome: Outcome,
  amount: bigint,
  secret: `0x${string}`,
  nullifier: `0x${string}`
): `0x${string}` {
  return keccak256(
    encodePacked(
      ['uint256', 'uint8', 'uint256', 'bytes32', 'bytes32'],
      [marketId, outcome, amount, secret, nullifier]
    )
  )
}
