const CONTRACT_ERRORS: Record<string, string> = {
  InsufficientBond: 'Bond amount too low. OPTIMISTIC markets require at least 0.01 ETH.',
  DeadlinePassed: 'Market deadline has already passed.',
  DeadlineNotReached: 'Market deadline has not been reached yet.',
  DisputeWindowOpen: 'The 48-hour dispute window is still open.',
  DisputeWindowClosed: 'The dispute window has already closed.',
  NullifierAlreadyUsed: 'This bet has already been claimed.',
  MarketNotSettled: 'Market has not been settled yet.',
  NotWinningSide: 'You bet on the losing outcome.',
  CommitmentExists: 'A bet with this commitment already exists.',
  ZeroAmount: 'Bet amount must be greater than zero.',
  MarketNotOpen: 'This market is not accepting bets.',
  InvalidProof: 'Invalid claim proof — check your secret and nullifier.',
  ZeroPayout: 'Payout would be zero.',
  NotCreator: 'Only the market creator can propose an outcome.',
  NotOptimisticMarket: 'This action is only for Optimistic markets.',
  MarketNotFound: 'Market not found.',
  MarketAlreadySettled: 'Market has already been settled.',
}

export function parseContractError(error: unknown): string {
  if (error instanceof Error) {
    for (const [name, msg] of Object.entries(CONTRACT_ERRORS)) {
      if (error.message.includes(name)) return msg
    }
    // Return the first line to avoid giant viem stack traces
    return error.message.split('\n')[0]
  }
  return 'An unknown error occurred.'
}
