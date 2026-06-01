import { unstable_cache } from 'next/cache'
import { Connection, PublicKey } from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  MINT_ACCOUNT_SIZE,
  PLATFORM_FEE_BPS,
  parseMintAuthority,
  lamportsToSol,
  type MintEntry,
} from './solana'

function getRpcUrl(): string {
  const key = process.env.HELIUS_API_KEY
  if (!key) throw new Error('HELIUS_API_KEY is not set')
  return `https://mainnet.helius-rpc.com/?api-key=${key}`
}

export function getConnection(): Connection {
  return new Connection(getRpcUrl(), { commitment: 'confirmed' })
}

// Helius getProgramAccountsV2 — paginated, required for large programs like the token program.
// Uses Connection._rpcRequest so it shares the same HTTP transport (cross-fetch / node-fetch)
// that successfully reaches Helius, rather than the native fetch which has issues in this env.
async function fetchAllMintAccounts(connection: Connection): Promise<Array<{
  pubkey: string
  lamports: number
  data: Buffer
}>> {
  const PAGE_SIZE = 1000
  const out: Array<{ pubkey: string; lamports: number; data: Buffer }> = []
  let cursor: string | undefined

  // _rpcRequest is marked @internal but is the only way to send non-standard methods
  const rpc = (connection as unknown as {
    _rpcRequest: (method: string, args: unknown[]) => Promise<{ result: unknown; error?: { message: string } }>
  })._rpcRequest

  do {
    const res = await rpc('getProgramAccountsV2', [
      TOKEN_PROGRAM_ID.toBase58(),
      {
        commitment: 'confirmed',
        encoding: 'base64',
        filters: [{ dataSize: MINT_ACCOUNT_SIZE }],
        dataSlice: { offset: 0, length: 36 },
        limit: PAGE_SIZE,
        ...(cursor ? { cursor } : {}),
      },
    ])

    if (res.error) throw new Error(`getProgramAccountsV2: ${res.error.message}`)

    const result = res.result as { accounts: Array<{ pubkey: string; account: { lamports: number; data: [string, string] } }>; cursor?: string }

    for (const { pubkey, account } of result.accounts) {
      out.push({
        pubkey,
        lamports: account.lamports,
        data: Buffer.from(account.data[0], 'base64'),
      })
    }

    cursor = result.cursor ?? undefined
  } while (cursor)

  return out
}

export interface ScanResult {
  entries: MintEntry[]
  scannedAt: string
  totalScanned: number
}

export async function scanExcessLamports(): Promise<ScanResult> {
  const connection = getConnection()
  const rentExemptMin = await connection.getMinimumBalanceForRentExemption(MINT_ACCOUNT_SIZE)

  const accounts = await fetchAllMintAccounts(connection)

  const entries: MintEntry[] = []
  for (const { pubkey, lamports, data } of accounts) {
    const excess = lamports - rentExemptMin
    if (excess <= 0) continue

    const mintAuthority = parseMintAuthority(data)
    entries.push({
      address: pubkey,
      excessLamports: excess,
      excessSol: lamportsToSol(excess),
      mintAuthority,
      recoveryPath: mintAuthority ? 'authority' : 'keypair',
    })
  }

  entries.sort((a, b) => b.excessLamports - a.excessLamports)

  return { entries, scannedAt: new Date().toISOString(), totalScanned: accounts.length }
}

export const getTopMints = unstable_cache(
  async (limit: number = 50): Promise<MintEntry[]> => {
    const result = await scanExcessLamports()
    return result.entries.slice(0, limit)
  },
  ['leaderboard-top-mints'],
  { revalidate: 3600 } // refresh once per hour
)

export async function getMintInfo(address: string): Promise<MintEntry | null> {
  const connection = getConnection()
  const rentExemptMin = await connection.getMinimumBalanceForRentExemption(MINT_ACCOUNT_SIZE)

  let pubkey: PublicKey
  try {
    pubkey = new PublicKey(address)
  } catch {
    return null
  }

  const account = await connection.getAccountInfo(pubkey, { dataSlice: { offset: 0, length: 36 } })
  if (!account || account.data.length < 36 || account.owner.toBase58() !== TOKEN_PROGRAM_ID.toBase58()) {
    return null
  }

  const excess = account.lamports - rentExemptMin
  const mintAuthority = parseMintAuthority(account.data as Buffer)

  return {
    address,
    excessLamports: Math.max(0, excess),
    excessSol: lamportsToSol(Math.max(0, excess)),
    mintAuthority,
    recoveryPath: mintAuthority ? 'authority' : 'keypair',
  }
}

export function calcPlatformFee(excessLamports: number): number {
  return Math.floor((excessLamports * PLATFORM_FEE_BPS) / 10_000)
}

export function calcClientReceives(excessLamports: number): number {
  return excessLamports - calcPlatformFee(excessLamports)
}
