'use client'

import { useState, useRef, FormEvent } from 'react'
import { RecoveryModal } from './RecoveryModal'

interface MintResult {
  address: string
  excessSol: number
  excessLamports: number
  mintAuthority: string | null
  recoveryPath: 'authority' | 'keypair'
  clientReceivesSol: number
  platformFeeSol: number
  launchpad?: string
}

export function MintLookup() {
  const [result, setResult] = useState<MintResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const address = inputRef.current?.value.trim()
    if (!address) return

    setLoading(true)
    setError(null)
    setResult(null)
    setShowRecovery(false)

    try {
      const res = await fetch(`/api/mint/${encodeURIComponent(address)}`)
      const text = await res.text()
      const data = text ? JSON.parse(text) : {}
      if (!res.ok) {
        setError(data.error ?? `Server error ${res.status}`)
      } else {
        setResult(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    }
    setLoading(false)
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Look up a mint address</h2>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="Paste a Solana mint address…"
          className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 placeholder:text-zinc-400"
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {loading ? 'Checking…' : 'Look up'}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {result && (
        <div className="mt-4 rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
          <div className="px-4 py-3">
            <span className="font-mono text-sm text-zinc-500">{result.address}</span>
          </div>

          {result.excessLamports <= 0 ? (
            <div className="px-4 py-4 text-sm text-zinc-500">
              No excess SOL — this mint is at or below its rent-exempt minimum.
            </div>
          ) : (
            <>
              <div className="px-4 py-3 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Excess SOL</p>
                  <p className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 text-lg">
                    ◎ {result.excessSol.toFixed(6)}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">You receive (~93%)</p>
                  <p className="font-mono font-semibold text-lg">◎ {result.clientReceivesSol.toFixed(6)}</p>
                </div>
              </div>

              <div className="px-4 py-3 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Recovery path</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    result.recoveryPath === 'authority'
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  }`}>
                    {result.recoveryPath === 'authority' ? 'Mint authority' : 'Mint keypair required'}
                  </span>
                </div>
                {result.mintAuthority && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Authority</span>
                    <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {result.mintAuthority.slice(0, 8)}…{result.mintAuthority.slice(-4)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-zinc-500">Platform fee (10%)</span>
                  <span className="font-mono text-xs text-zinc-500">◎ {result.platformFeeSol.toFixed(6)}</span>
                </div>
              </div>

              <div className="px-4 py-3">
                <button
                  onClick={() => setShowRecovery(true)}
                  className="w-full py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Recover ◎ {result.clientReceivesSol.toFixed(4)}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {showRecovery && result && (
        <RecoveryModal
          mint={result}
          onClose={() => setShowRecovery(false)}
        />
      )}
    </section>
  )
}
