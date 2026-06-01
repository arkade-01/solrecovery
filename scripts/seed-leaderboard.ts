/**
 * Fetches the top 50 recoverable mints from Dune and writes them to
 * lib/leaderboard-data.json.
 *
 * Run with:  DUNE_API_KEY=your_key npx tsx scripts/seed-leaderboard.ts
 *
 * Dune query: https://dune.com/queries/4885823
 * Columns expected: mint_address, excess_lamports, excess_sol, mint_authority
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DUNE_API_KEY = process.env.DUNE_API_KEY
const QUERY_ID = '4885823'
const TOP_N = 50

if (!DUNE_API_KEY) {
  console.error('Set DUNE_API_KEY in your environment first.')
  process.exit(1)
}

async function fetchDuneResults(queryId: string): Promise<unknown[]> {
  // Trigger a fresh execution
  console.log(`Executing Dune query ${queryId}…`)
  const execRes = await fetch(`https://api.dune.com/api/v1/query/${queryId}/execute`, {
    method: 'POST',
    headers: { 'X-Dune-API-Key': DUNE_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ performance: 'medium' }),
  })
  const { execution_id } = await execRes.json() as { execution_id: string }

  // Poll until done
  let status = 'QUERY_STATE_PENDING'
  while (status !== 'QUERY_STATE_COMPLETED' && status !== 'QUERY_STATE_FAILED') {
    await new Promise(r => setTimeout(r, 3000))
    const statusRes = await fetch(`https://api.dune.com/api/v1/execution/${execution_id}/status`, {
      headers: { 'X-Dune-API-Key': DUNE_API_KEY! },
    })
    const body = await statusRes.json() as { state: string }
    status = body.state
    process.stdout.write(`\r  Status: ${status}   `)
  }
  console.log()

  if (status === 'QUERY_STATE_FAILED') throw new Error('Dune query failed')

  // Fetch results
  const resultsRes = await fetch(
    `https://api.dune.com/api/v1/execution/${execution_id}/results?limit=${TOP_N}&sort_by=excess_lamports+desc`,
    { headers: { 'X-Dune-API-Key': DUNE_API_KEY! } }
  )
  const { result } = await resultsRes.json() as { result: { rows: unknown[] } }
  return result.rows
}

async function main() {
  const rows = await fetchDuneResults(QUERY_ID)
  console.log(`Got ${rows.length} rows from Dune`)

  // Map Dune columns → MintEntry shape
  const entries = rows.map((row: any) => ({
    address: row.mint_address as string,
    excessLamports: Number(row.excess_lamports),
    excessSol: Number(row.excess_sol),
    mintAuthority: (row.mint_authority as string) || null,
    recoveryPath: row.mint_authority ? 'authority' : 'keypair',
  }))

  const outPath = join(import.meta.dirname, '..', 'lib', 'leaderboard-data.json')
  writeFileSync(outPath, JSON.stringify(entries, null, 2))
  console.log(`Wrote ${entries.length} entries to lib/leaderboard-data.json`)
}

main().catch(err => { console.error(err); process.exit(1) })
