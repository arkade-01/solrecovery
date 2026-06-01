'use client'

import { useState, useCallback } from 'react'
import type { MintEntry } from '@/lib/solana'

interface LeaderboardData {
  entries: MintEntry[]
  total: number
  lastUpdated: string | null
  totalScanned: number
}

interface Props {
  initial: LeaderboardData
}

const RECOVERY_LABELS: Record<string, string> = {
  authority: 'Mint authority',
  keypair: 'Mint keypair',
}

function shortAddress(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

function formatSol(sol: number) {
  return sol.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
}

export function LeaderboardTable({ initial }: Props) {
  const [data, setData] = useState<LeaderboardData>(initial)
  const [loading, setLoading] = useState(false)
  const [recovery, setRecovery] = useState<string>('')
  const [offset, setOffset] = useState(0)
  const LIMIT = 20

  const load = useCallback(async (newOffset: number, newRecovery: string) => {
    setLoading(true)
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(newOffset) })
    if (newRecovery) params.set('recovery', newRecovery)
    const res = await fetch(`/api/leaderboard?${params}`)
    const json = await res.json()
    setData(json)
    setOffset(newOffset)
    setLoading(false)
  }, [])

  function handleFilter(value: string) {
    setRecovery(value)
    load(0, value)
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Top recoverable mints</h2>
          {data.lastUpdated && (
            <p className="text-xs text-zinc-500 mt-0.5">
              Last scanned {new Date(data.lastUpdated).toLocaleString()} · {data.totalScanned.toLocaleString()} mints checked
            </p>
          )}
        </div>

        <div className="flex gap-2 text-sm">
          {[['', 'All'], ['keypair', 'Keypair'], ['authority', 'Authority']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => handleFilter(val)}
              className={`px-3 py-1 rounded-full border transition-colors ${
                recovery === val
                  ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                  : 'border-zinc-300 text-zinc-600 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500 text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left w-10">#</th>
              <th className="px-4 py-3 text-left">Mint address</th>
              <th className="px-4 py-3 text-right">Excess SOL</th>
              <th className="px-4 py-3 text-left">Recovery path</th>
              <th className="px-4 py-3 text-left">Launchpad</th>
            </tr>
          </thead>
          <tbody className={loading ? 'opacity-50' : ''}>
            {data.entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                  {data.totalScanned === 0
                    ? 'No data yet — trigger a scan to populate the leaderboard.'
                    : 'No results for this filter.'}
                </td>
              </tr>
            ) : (
              data.entries.map((entry, i) => (
                <tr
                  key={entry.address}
                  className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                >
                  <td className="px-4 py-3 text-zinc-400">{offset + i + 1}</td>
                  <td className="px-4 py-3 font-mono">
                    <a
                      href={`https://solscan.io/token/${entry.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline text-zinc-700 dark:text-zinc-300"
                      title={entry.address}
                    >
                      {shortAddress(entry.address)}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-emerald-700 dark:text-emerald-400">
                    ◎ {formatSol(entry.excessSol)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        entry.recoveryPath === 'authority'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      }`}
                    >
                      {RECOVERY_LABELS[entry.recoveryPath]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 capitalize">{entry.launchpad || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data.total > LIMIT && (
        <div className="flex items-center justify-between mt-4 text-sm text-zinc-500">
          <span>{data.total.toLocaleString()} total mints with excess SOL</span>
          <div className="flex gap-2">
            <button
              disabled={offset === 0 || loading}
              onClick={() => load(offset - LIMIT, recovery)}
              className="px-3 py-1 rounded border border-zinc-300 dark:border-zinc-700 disabled:opacity-40 hover:border-zinc-500 transition-colors"
            >
              ← Prev
            </button>
            <button
              disabled={offset + LIMIT >= data.total || loading}
              onClick={() => load(offset + LIMIT, recovery)}
              className="px-3 py-1 rounded border border-zinc-300 dark:border-zinc-700 disabled:opacity-40 hover:border-zinc-500 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
