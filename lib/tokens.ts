import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { MintEntry } from './solana'

function loadCsv(): MintEntry[] {
  const raw = readFileSync(join(process.cwd(), 'tokens.csv'), 'utf8')
  const lines = raw.trim().split('\n')
  // header: token_mint_address,symbol,sol_balance,adjusted_sol_balance
  return lines.slice(1).map((line) => {
    const [address, symbol, , adjusted] = line.split(',')
    const excessSol = parseFloat(adjusted)
    return {
      address: address.trim(),
      symbol: symbol.trim(),
      excessSol,
      excessLamports: Math.round(excessSol * 1_000_000_000),
      mintAuthority: null,   // not in CSV — shown when user does a live lookup
      recoveryPath: 'keypair' as const, // conservative default; live lookup confirms
    }
  }).filter((e) => e.excessSol > 0)
}

export const TOP_MINTS: MintEntry[] = loadCsv()
