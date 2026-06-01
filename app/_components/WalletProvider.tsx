'use client'

import { Buffer } from 'buffer'
import { useMemo } from 'react'
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import '@solana/wallet-adapter-react-ui/styles.css'

// Inject Buffer globally for @solana/web3.js client-side usage
if (typeof globalThis !== 'undefined' && !globalThis.Buffer) {
  globalThis.Buffer = Buffer
}

const RPC_ENDPOINT = '/api/rpc'

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new CoinbaseWalletAdapter()],
    []
  )

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <SolanaWalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  )
}
