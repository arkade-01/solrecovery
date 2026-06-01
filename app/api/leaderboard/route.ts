import { NextRequest, NextResponse } from 'next/server'
import { getRedis, getLeaderboardPage, KEYS } from '@/lib/redis'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0)
  const recovery = searchParams.get('recovery') ?? undefined

  const redis = getRedis()
  const { entries, total, lastUpdated } = await getLeaderboardPage(redis, offset, limit, recovery)
  const totalScanned = await redis.get(KEYS.totalScanned)

  return NextResponse.json({ entries, total, lastUpdated, totalScanned: parseInt(totalScanned ?? '0') })
}
