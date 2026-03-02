export function TxLink({ hash }: { hash: `0x${string}` }) {
  return (
    <a
      href={`https://sepolia.arbiscan.io/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs underline text-zinc-400 hover:text-zinc-200 transition-colors"
    >
      View on Arbiscan ↗
    </a>
  )
}
