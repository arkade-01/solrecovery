import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  SimulatedTransactionResponse,
} from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, PLATFORM_FEE_BPS } from './solana'

const PLATFORM_FEE_WALLET = new PublicKey(
  process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET ?? 'He3dANsDEn6WZM8NXCVvgxVFuB7r9MKtNHAaUzQoPFZV'
)

// Instruction 38 in the SPL token program — no data beyond the discriminator.
// Accounts: [source writable, destination writable, authority signer]
// Source: https://github.com/solana-program/token/blob/main/interface/src/instruction.rs
function withdrawExcessLamportsInstruction(
  mint: PublicKey,
  destination: PublicKey,
  authority: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: Buffer.from([38]),
  })
}

export interface RecoveryTxParams {
  mint: PublicKey
  authority: PublicKey    // mint authority OR the mint's own keypair (if authority revoked)
  clientWallet: PublicKey // receives the net SOL (93%) and pays the fee split
  excessLamports: number
}

// Builds the recovery transaction:
//   1. withdraw_excess_lamports(mint → clientWallet, signed by authority)
//   2. SystemProgram.transfer(clientWallet → platformFeeWallet, 7%)
// Both instructions are atomic. The client wallet must sign as feePayer (instruction 2).
// If authority !== clientWallet, the authority keypair must also sign (instruction 1).
export async function buildRecoveryTransaction(
  connection: Connection,
  params: RecoveryTxParams
): Promise<Transaction> {
  const { mint, authority, clientWallet, excessLamports } = params
  const platformFee = Math.floor((excessLamports * PLATFORM_FEE_BPS) / 10_000)

  const { blockhash } = await connection.getLatestBlockhash('confirmed')

  const tx = new Transaction({
    feePayer: clientWallet,
    recentBlockhash: blockhash,
  })

  tx.add(withdrawExcessLamportsInstruction(mint, clientWallet, authority))

  if (platformFee > 0) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: clientWallet,
        toPubkey: PLATFORM_FEE_WALLET,
        lamports: platformFee,
      })
    )
  }

  return tx
}

export interface SimulationResult {
  ok: boolean
  error: string | null
  logs: string[]
  unitsConsumed: number | null
}

// Simulate without requiring any signatures. Safe to call before asking the user to sign.
// Uses VersionedTransaction so we can pass SimulateTransactionConfig (sigVerify: false).
export async function simulateRecovery(
  connection: Connection,
  params: RecoveryTxParams
): Promise<SimulationResult> {
  const tx = await buildRecoveryTransaction(connection, params)

  const { blockhash } = await connection.getLatestBlockhash('confirmed')
  const message = new TransactionMessage({
    payerKey: params.clientWallet,
    recentBlockhash: blockhash,
    instructions: tx.instructions,
  }).compileToV0Message()

  const versionedTx = new VersionedTransaction(message)

  const { value }: { value: SimulatedTransactionResponse } = await connection.simulateTransaction(
    versionedTx,
    { sigVerify: false, replaceRecentBlockhash: true }
  )

  return {
    ok: value.err === null,
    error: value.err ? JSON.stringify(value.err) : null,
    logs: value.logs ?? [],
    unitsConsumed: value.unitsConsumed ?? null,
  }
}
