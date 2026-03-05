'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Button } from '@/components/ui/Button'
import { ResolutionTypeSelector } from './ResolutionTypeSelector'
import { useCreateMarket } from '@/hooks/useCreateMarket'
import { ResolutionType } from '@/lib/types'
import type { MarketSuggestion, ResolutionConfig } from '@/lib/types'

interface CreateMarketFormProps {
  prefill?: MarketSuggestion | null
}

export function CreateMarketForm({ prefill }: CreateMarketFormProps) {
  const { isConnected } = useAccount()
  const { createMarket, txHash, isPending, isSuccess, error } = useCreateMarket()

  const [question, setQuestion] = useState('')
  const [resolutionType, setResolutionType] = useState<ResolutionType>(ResolutionType.AI_VERDICT)
  const [source, setSource] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [field, setField] = useState('')
  const [condition, setCondition] = useState('')
  const [resolutionPrompt, setResolutionPrompt] = useState('')
  const [deadline, setDeadline] = useState('')

  // Pre-fill form when a suggestion is selected
  useEffect(() => {
    if (!prefill) return
    setQuestion(prefill.question)
    setResolutionType(prefill.resolutionType as ResolutionType)
    setSource(prefill.source ?? '')
    setEndpoint(prefill.endpoint ?? '')
    setField(prefill.field ?? '')
    setCondition(prefill.condition ?? '')
    setResolutionPrompt(prefill.resolutionPrompt ?? '')
    // Convert unix timestamp to datetime-local format
    const dt = new Date(prefill.deadlineTimestamp * 1000)
    setDeadline(dt.toISOString().slice(0, 16))
  }, [prefill])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!question || !deadline) return

    const deadlineTs = BigInt(Math.floor(new Date(deadline).getTime() / 1000))

    const config: ResolutionConfig = {
      resolutionType,
      source,
      endpoint,
      field,
      condition,
      resolutionPrompt,
      deadline: deadlineTs,
    }

    createMarket(question, config)
  }

  if (isSuccess && txHash) {
    return (
      <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-5 text-sm text-green-400 space-y-2">
        <p className="font-semibold">Market created!</p>
        <a
          href={`https://sepolia.arbiscan.io/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-xs"
        >
          View on Arbiscan ↗
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Question</label>
        <textarea
          rows={3}
          placeholder="Will ETH hit $5,000 by March 31, 2026?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-wraith-purple resize-none"
        />
      </div>

      <div>
        <label className="text-xs text-zinc-400 mb-2 block">Resolution Type</label>
        <ResolutionTypeSelector value={resolutionType} onChange={setResolutionType} />
      </div>

      {/* Conditional fields */}
      {resolutionType === ResolutionType.PRICE_FEED && (
        <>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Asset</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-wraith-purple"
            >
              <option value="">Select a price feed...</option>
              <option value="0x62CAe0FA2da220f43a51F86Db2EDb36DcA9A5A08">ETH / USD</option>
              <option value="0x56a43EB56Da12C0dc1D972ACb089c06a5dEF8e69">BTC / USD</option>
              <option value="0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298">LINK / USD</option>
            </select>
          </div>
          <Field label="Condition" value={condition} onChange={setCondition} placeholder=">= 2000" />
        </>
      )}

      {resolutionType === ResolutionType.API_POLL && (
        <>
          <Field label="API Base URL" value={source} onChange={setSource} placeholder="https://api.coingecko.com" />
          <Field label="Endpoint" value={endpoint} onChange={setEndpoint} placeholder="/api/v3/simple/price?ids=ethereum&vs_currencies=usd" />
          <Field label="JSON Field" value={field} onChange={setField} placeholder="ethereum.usd" />
          <Field label="Condition" value={condition} onChange={setCondition} placeholder=">= 5000" />
        </>
      )}

      {resolutionType === ResolutionType.AI_VERDICT && (
        <>
          <Field label="News Sources (comma-separated domains)" value={source} onChange={setSource} placeholder="reuters.com,coindesk.com" />
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Resolution Prompt</label>
            <textarea
              rows={3}
              placeholder="Did ETH hit $5,000 at any point before the deadline? Answer YES or NO."
              value={resolutionPrompt}
              onChange={(e) => setResolutionPrompt(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-wraith-purple resize-none"
            />
          </div>
        </>
      )}

      {resolutionType === ResolutionType.OPTIMISTIC && (
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3 text-xs text-yellow-400">
          Optimistic markets require a 0.01 ETH bond. You propose the outcome after deadline, then a 48-hour dispute window opens.
        </div>
      )}

      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Deadline</label>
        <input
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-wraith-purple"
        />
      </div>

      {error && <p className="text-xs text-red-400">{error.message.split('\n')[0]}</p>}

      {isConnected ? (
        <Button type="submit" loading={isPending} className="w-full" size="lg">
          {resolutionType === ResolutionType.OPTIMISTIC ? 'Create Market (0.01 ETH bond)' : 'Create Market'}
        </Button>
      ) : (
        <div className="text-center">
          <p className="text-zinc-400 text-sm mb-3">Connect your wallet to create a market.</p>
          <ConnectButton />
        </div>
      )}
    </form>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="text-xs text-zinc-400 mb-1 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-wraith-purple"
      />
    </div>
  )
}
