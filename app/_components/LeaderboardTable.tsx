'use client'

import { useState, useMemo } from 'react'
import type { MintEntry } from '@/lib/solana'

interface Props {
  initial: {
    entries: MintEntry[]
    total: number
    lastUpdated: string | null
    totalScanned: number
  }
}

const LIMIT = 20

function shortAddress(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

function formatSol(sol: number) {
  return sol.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function LeaderboardTable({ initial }: Props) {
  const [offset, setOffset] = useState(0)

  // All filtering/pagination is client-side — data comes from the static CSV
  const page = useMemo(
    () => initial.entries.slice(offset, offset + LIMIT),
    [initial.entries, offset]
  )

  return (
    <section>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Top recoverable mints</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {initial.entries.length} mints · look up any address below to check live auth state
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500 text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left w-8">#</th>
              <th className="px-4 py-3 text-left">Token</th>
              <th className="px-4 py-3 text-left hidden sm:table-cell">Mint address</th>
              <th className="px-4 py-3 text-right">Excess SOL</th>
              <th className="px-4 py-3 text-left hidden md:table-cell">Launchpad</th>
            </tr>
          </thead>
          <tbody>
            {page.map((entry, i) => (
              <tr
                key={entry.address}
                className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
              >
                <td className="px-4 py-3 text-zinc-400 tabular-nums">{offset + i + 1}</td>
                <td className="px-4 py-3">
                  <a
                    href={`https://solscan.io/token/${entry.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline"
                  >
                    {entry.symbol ?? '—'}
                  </a>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="font-mono text-xs text-zinc-500" title={entry.address}>
                    {shortAddress(entry.address)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  ◎ {formatSol(entry.excessSol)}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-zinc-500 capitalize">
                  {entry.launchpad ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {initial.entries.length > LIMIT && (
        <div className="flex items-center justify-between mt-4 text-sm text-zinc-500">
          <span>
            {offset + 1}–{Math.min(offset + LIMIT, initial.entries.length)} of {initial.entries.length}
          </span>
          <div className="flex gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
              className="px-3 py-1 rounded border border-zinc-300 dark:border-zinc-700 disabled:opacity-40 hover:border-zinc-500 transition-colors"
            >
              ← Prev
            </button>
            <button
              disabled={offset + LIMIT >= initial.entries.length}
              onClick={() => setOffset((o) => o + LIMIT)}
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
