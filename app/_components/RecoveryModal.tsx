'use client'

import { useState, useRef, useCallback } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { buildRecoveryTransaction, simulateRecovery } from '@/lib/recovery'
import { lamportsToSol } from '@/lib/solana'

interface MintResult {
  address: string
  excessLamports: number
  excessSol: number
  clientReceivesSol: number
  platformFeeSol: number
  mintAuthority: string | null
  recoveryPath: 'authority' | 'keypair'
}

interface Props {
  mint: MintResult
  onClose: () => void
}

type Step = 'auth' | 'preview' | 'sending' | 'done' | 'error'

function parseKeypairFile(text: string): Keypair {
  let bytes: unknown
  try { bytes = JSON.parse(text) } catch { throw new Error('File is not valid JSON') }
  if (!Array.isArray(bytes) || bytes.length !== 64) {
    throw new Error('Expected a 64-byte JSON array (standard Solana keypair file)')
  }
  return Keypair.fromSecretKey(Uint8Array.from(bytes as number[]))
}

export function RecoveryModal({ mint, onClose }: Props) {
  const { connection } = useConnection()
  const wallet = useWallet()

  const [step, setStep] = useState<Step>('auth')
  const [mintKeypair, setMintKeypair] = useState<Keypair | null>(null)
  const [keypairError, setKeypairError] = useState<string | null>(null)
  const [simResult, setSimResult] = useState<{ ok: boolean; error: string | null; logs: string[] } | null>(null)
  const [txSig, setTxSig] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setKeypairError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const kp = parseKeypairFile(ev.target?.result as string)
        // For authority-revoked path, the signing key must match the mint address itself
        if (mint.recoveryPath === 'keypair' && kp.publicKey.toBase58() !== mint.address) {
          setKeypairError(
            `Wrong keypair — public key ${kp.publicKey.toBase58().slice(0, 8)}… doesn't match mint ${mint.address.slice(0, 8)}…`
          )
          return
        }
        setMintKeypair(kp)
      } catch (err) {
        setKeypairError(err instanceof Error ? err.message : 'Invalid keypair file')
      }
    }
    reader.readAsText(file)
  }

  const canPreview = wallet.connected && wallet.publicKey && (
    mint.recoveryPath === 'authority' || mintKeypair !== null
  )

  const handlePreview = useCallback(async () => {
    if (!wallet.publicKey) return
    setStep('preview')
    setSimResult(null)

    const authority =
      mint.recoveryPath === 'authority'
        ? wallet.publicKey
        : mintKeypair!.publicKey

    try {
      const result = await simulateRecovery(connection, {
        mint: new PublicKey(mint.address),
        authority,
        clientWallet: wallet.publicKey,
        excessLamports: mint.excessLamports,
      })
      setSimResult(result)
    } catch (err) {
      setSimResult({ ok: false, error: err instanceof Error ? err.message : 'Simulation failed', logs: [] })
    }
  }, [connection, wallet.publicKey, mint, mintKeypair])

  const handleSend = useCallback(async () => {
    if (!wallet.publicKey || !wallet.sendTransaction) return
    setStep('sending')
    setStatusMsg('Building transaction…')

    try {
      const authority =
        mint.recoveryPath === 'authority'
          ? wallet.publicKey
          : mintKeypair!.publicKey

      const tx: Transaction = await buildRecoveryTransaction(connection, {
        mint: new PublicKey(mint.address),
        authority,
        clientWallet: wallet.publicKey,
        excessLamports: mint.excessLamports,
      })

      // For keypair path, partially sign with the mint keypair before the wallet signs
      if (mint.recoveryPath === 'keypair' && mintKeypair) {
        tx.partialSign(mintKeypair)
      }

      setStatusMsg('Waiting for wallet approval…')
      const sig = await wallet.sendTransaction(tx, connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      })

      // Set signature immediately — if confirmation times out the tx still landed
      setTxSig(sig)
      setStatusMsg('Confirming…')

      try {
        await connection.confirmTransaction(sig, 'confirmed')
      } catch {
        // Timeout or network drop — tx was already submitted, treat as done
      }

      setMintKeypair(null)
      setStep('done')
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Transaction failed')
      setStep('error')
      setMintKeypair(null)
    }
  }, [connection, wallet, mint, mintKeypair])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="font-semibold text-sm">Recover SOL</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Amount summary — always visible */}
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-500">Mint</span>
              <span className="font-mono text-xs">{mint.address.slice(0, 8)}…{mint.address.slice(-4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">You receive</span>
              <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">◎ {mint.clientReceivesSol.toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Platform fee (10%)</span>
              <span className="font-mono text-zinc-400">◎ {mint.platformFeeSol.toFixed(6)}</span>
            </div>
          </div>

          {/* Step: auth */}
          {step === 'auth' && (
            <div className="space-y-4">
              {/* Connect wallet */}
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
                  {mint.recoveryPath === 'authority' ? '1. Connect the mint authority wallet' : '1. Connect your destination wallet (receives SOL)'}
                </p>
                <WalletMultiButton />
                {wallet.connected && mint.recoveryPath === 'authority' && mint.mintAuthority && (
                  <p className="mt-1.5 text-xs text-zinc-400">
                    Required authority: <span className="font-mono">{mint.mintAuthority.slice(0, 8)}…{mint.mintAuthority.slice(-4)}</span>
                    {wallet.publicKey?.toBase58() !== mint.mintAuthority && (
                      <span className="ml-1 text-amber-600">⚠ Connected wallet doesn't match</span>
                    )}
                  </p>
                )}
              </div>

              {/* Keypair upload — only for keypair path */}
              {mint.recoveryPath === 'keypair' && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">2. Upload the mint keypair file</p>
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300 mb-2">
                    ⚠ Your private key never leaves this browser. It is used only to sign the transaction locally and is cleared from memory immediately after.
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="block text-sm text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-zinc-100 dark:file:bg-zinc-800 file:text-zinc-700 dark:file:text-zinc-300 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-700 cursor-pointer"
                  />
                  {keypairError && <p className="mt-1.5 text-xs text-red-500">{keypairError}</p>}
                  {mintKeypair && (
                    <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                      ✓ Keypair loaded — {mintKeypair.publicKey.toBase58().slice(0, 8)}…
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={handlePreview}
                disabled={!canPreview}
                className="w-full py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                Preview transaction
              </button>
            </div>
          )}

          {/* Step: preview */}
          {step === 'preview' && (
            <div className="space-y-3">
              {simResult === null ? (
                <p className="text-sm text-zinc-500 text-center py-4">Simulating…</p>
              ) : (
                <>
                  <div className={`rounded-lg border p-3 text-sm ${simResult.ok ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30' : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30'}`}>
                    <p className={`font-medium ${simResult.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                      {simResult.ok ? '✓ Simulation succeeded' : '✗ Simulation failed'}
                    </p>
                    {simResult.error && <p className="mt-1 text-xs text-red-600 dark:text-red-400 font-mono break-all">{simResult.error}</p>}
                  </div>

                  {simResult.logs.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-zinc-400 hover:text-zinc-600">Program logs ({simResult.logs.length})</summary>
                      <pre className="mt-1.5 p-2 bg-zinc-50 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap break-all">
                        {simResult.logs.join('\n')}
                      </pre>
                    </details>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep('auth')}
                      className="flex-1 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={!simResult.ok}
                      className="flex-1 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
                    >
                      Sign &amp; send
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step: sending */}
          {step === 'sending' && (
            <div className="py-6 text-center space-y-2">
              <div className="inline-block w-6 h-6 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
              <p className="text-sm text-zinc-500">{statusMsg}</p>
            </div>
          )}

          {/* Step: done */}
          {step === 'done' && txSig && (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm">
                <p className="font-medium text-emerald-700 dark:text-emerald-400 mb-1">✓ Transaction submitted</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500">◎ {mint.clientReceivesSol.toFixed(6)} recovery — verify on explorer</p>
              </div>
              <a
                href={`https://solscan.io/tx/${txSig}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-2 text-center rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm hover:border-zinc-400 transition-colors"
              >
                View on Solscan →
              </a>
              <button onClick={onClose} className="w-full py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium">
                Done
              </button>
            </div>
          )}

          {/* Step: error */}
          {step === 'error' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm">
                <p className="font-medium text-red-700 dark:text-red-400 mb-1">Transaction failed</p>
                <p className="text-xs text-red-600 dark:text-red-400 font-mono break-all">{statusMsg}</p>
              </div>
              <button onClick={() => setStep('auth')} className="w-full py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm">
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
