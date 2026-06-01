import { NextRequest, NextResponse } from 'next/server'

const HELIUS_URL = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`

// Proxies wallet adapter RPC calls through the server so HELIUS_API_KEY never
// reaches the browser. The client connects to /api/rpc instead of Helius directly.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text()

  const upstream = await fetch(HELIUS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })

  const data = await upstream.text()
  return new NextResponse(data, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
