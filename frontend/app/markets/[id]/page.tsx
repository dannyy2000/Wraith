export default function MarketDetailPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Market #{params.id}</h1>
      <p className="text-zinc-400">Loading market…</p>
    </div>
  )
}
