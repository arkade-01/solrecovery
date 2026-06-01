import { NextRequest, NextResponse } from 'next/server'
import { getMintInfo, calcPlatformFee, calcClientReceives } from '@/lib/helius'
import { lamportsToSol } from '@/lib/solana'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse> {
  const { address } = await params

  try {
    const entry = await getMintInfo(address)
    if (!entry) {
      return NextResponse.json({ error: 'Not a valid SPL mint address' }, { status: 404 })
    }

    const platformFeeLamports = calcPlatformFee(entry.excessLamports)
    const clientReceivesLamports = calcClientReceives(entry.excessLamports)

    return NextResponse.json({
      ...entry,
      platformFeeLamports,
      platformFeeSol: lamportsToSol(platformFeeLamports),
      clientReceivesLamports,
      clientReceivesSol: lamportsToSol(clientReceivesLamports),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
