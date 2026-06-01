import { Redis } from 'ioredis'
import type { MintEntry } from './solana'

let _redis: Redis | null = null

export function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.REDIS_URL
    if (!url) throw new Error('REDIS_URL is not set')
    _redis = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 })
  }
  return _redis
}

export const KEYS = {
  leaderboard: 'leaderboard:mints',
  lastUpdated: 'leaderboard:lastUpdated',
  totalScanned: 'leaderboard:totalScanned',
  mintMeta: (address: string) => `mint:${address}`,
  scanLock: 'scan:lock',
}

export async function storeLeaderboard(
  redis: Redis,
  entries: MintEntry[],
  totalScanned: number,
  scannedAt: string
): Promise<void> {
  const pipeline = redis.pipeline()

  // Clear old data
  pipeline.del(KEYS.leaderboard)

  // Store sorted set: score = excessLamports, member = address
  for (const entry of entries) {
    pipeline.zadd(KEYS.leaderboard, entry.excessLamports, entry.address)
    pipeline.hset(KEYS.mintMeta(entry.address), {
      address: entry.address,
      excessLamports: entry.excessLamports,
      excessSol: entry.excessSol.toFixed(9),
      mintAuthority: entry.mintAuthority ?? '',
      recoveryPath: entry.recoveryPath,
      launchpad: entry.launchpad ?? '',
    })
  }

  pipeline.set(KEYS.lastUpdated, scannedAt)
  pipeline.set(KEYS.totalScanned, totalScanned)

  await pipeline.exec()
}

export async function getLeaderboardPage(
  redis: Redis,
  offset: number,
  limit: number,
  recoveryFilter?: string
): Promise<{ entries: MintEntry[]; total: number; lastUpdated: string | null }> {
  const [rawAddresses, total, lastUpdated] = await Promise.all([
    redis.zrevrange(KEYS.leaderboard, offset, offset + limit * 3 - 1, 'WITHSCORES'),
    redis.zcard(KEYS.leaderboard),
    redis.get(KEYS.lastUpdated),
  ])

  const addresses: Array<{ address: string; score: number }> = []
  for (let i = 0; i < rawAddresses.length; i += 2) {
    addresses.push({ address: rawAddresses[i], score: parseInt(rawAddresses[i + 1]) })
  }

  // Batch-fetch metadata
  const pipeline = redis.pipeline()
  for (const { address } of addresses) {
    pipeline.hgetall(KEYS.mintMeta(address))
  }
  const metaResults = await pipeline.exec()

  const entries: MintEntry[] = []
  for (let i = 0; i < addresses.length; i++) {
    const meta = (metaResults?.[i]?.[1] ?? {}) as Record<string, string>
    if (!meta.address) continue

    const entry: MintEntry = {
      address: meta.address,
      excessLamports: parseInt(meta.excessLamports),
      excessSol: parseFloat(meta.excessSol),
      mintAuthority: meta.mintAuthority || null,
      recoveryPath: meta.recoveryPath as 'authority' | 'keypair',
      launchpad: meta.launchpad || undefined,
    }

    if (recoveryFilter && entry.recoveryPath !== recoveryFilter) continue
    entries.push(entry)
    if (entries.length >= limit) break
  }

  return { entries, total, lastUpdated }
}
