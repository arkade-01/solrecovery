import data from '@/lib/leaderboard-data.json'
import type { MintEntry } from '@/lib/solana'
import { LeaderboardTable } from './LeaderboardTable'

export function LeaderboardSection() {
  const entries = data as MintEntry[]
  return (
    <LeaderboardTable
      initial={{ entries, total: entries.length, lastUpdated: null, totalScanned: 0 }}
    />
  )
}
