import { PublicKey } from '@solana/web3.js'

export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
export const MINT_ACCOUNT_SIZE = 82

// 2 years of rent for an 82-byte account (1 lamport = 1e-9 SOL)
// Fetched at runtime via getMinimumBalanceForRentExemption, but this is the approximate value.
export const APPROXIMATE_RENT_EXEMPT_LAMPORTS = 1_461_600

export const PLATFORM_FEE_BPS = 1000 // 10%

export const KNOWN_LAUNCHPADS: Record<string, string> = {
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': 'pumpfun',
}

export type RecoveryPath = 'authority' | 'keypair'

export interface MintEntry {
  address: string
  excessLamports: number
  excessSol: number
  mintAuthority: string | null
  recoveryPath: RecoveryPath
  symbol?: string
  launchpad?: string
}

// COption<Pubkey> layout: 4-byte LE discriminant + 32-byte pubkey
// discriminant == 1 → Some(pubkey), == 0 → None
export function parseMintAuthority(data: Buffer): string | null {
  const discriminant = data.readUInt32LE(0)
  if (discriminant === 0) return null
  return new PublicKey(data.subarray(4, 36)).toBase58()
}

export function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000
}

export function solToLamports(sol: number): number {
  return Math.floor(sol * 1_000_000_000)
}
