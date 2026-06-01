import { TOP_MINTS } from '@/lib/tokens'
import { LeaderboardTable } from './LeaderboardTable'

export function LeaderboardSection() {
  return (
    <LeaderboardTable
      initial={{ entries: TOP_MINTS, total: TOP_MINTS.length, lastUpdated: null, totalScanned: 0 }}
    />
  )
}
