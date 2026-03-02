import { Card } from '@/components/ui/Card'

export function ReasoningCard({ reasoning }: { reasoning: string }) {
  if (!reasoning) return null

  return (
    <Card className="border-wraith-purple/30 bg-purple-950/20">
      <h3 className="text-sm font-medium text-purple-400 mb-2">AI Reasoning</h3>
      <p className="text-sm text-zinc-300 leading-relaxed">{reasoning}</p>
    </Card>
  )
}
