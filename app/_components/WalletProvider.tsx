'use client'

import { Buffer } from 'buffer'
import { useState, useEffect, useMemo } from 'react'
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import '@solana/wallet-adapter-react-ui/styles.css'

if (typeof globalThis !== 'undefined' && !globalThis.Buffer) {
  globalThis.Buffer = Buffer
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  // Defer to client-side only — @solana/web3.js rejects relative URLs during SSR prerender.
  // window.location.origin works on localhost and any deployment without any env vars.
  const [endpoint, setEndpoint] = useState<string | null>(null)

  useEffect(() => {
    setEndpoint(`${window.location.origin}/api/rpc`)
  }, [])

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new CoinbaseWalletAdapter()],
    []
  )

  if (!endpoint) return <>{children}</>

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  )
}
