import { WalletButton } from "./_components/WalletButton";
import { LeaderboardSection } from "./_components/LeaderboardSection";
import { MintLookup } from "./_components/MintLookup";

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-base">Bricked SOL Recovery</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            ~176,961 SOL locked in SPL mint accounts
          </p>
        </div>
        <WalletButton />
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total bricked SOL", value: "~176,961 ◎" },
            { label: "Affected mints", value: "~869,000" },
            { label: "Rent-exempt floor", value: "0.00146 ◎" },
            { label: "Platform fee", value: "7%" },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4"
            >
              <p className="text-xs text-zinc-500 mb-1">{label}</p>
              <p className="font-mono font-semibold">{value}</p>
            </div>
          ))}
        </div>

        <LeaderboardSection />

        <MintLookup />

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 text-sm space-y-2">
          <h3 className="font-medium">How recovery works</h3>
          <ul className="space-y-1 text-zinc-600 dark:text-zinc-400 list-disc list-inside">
            <li>
              <strong>Authority active:</strong> the designated mint authority
              wallet signs the recovery transaction.
            </li>
            <li>
              <strong>Authority revoked:</strong> the original mint keypair is
              required. It never leaves your browser.
            </li>
            <li>
              Recovered SOL is split atomically: ~93% to you, 7% platform fee.
            </li>
            <li>
              No upfront cost. Only the Solana transaction fee (~0.000005 ◎).
            </li>
          </ul>
        </div>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-4 text-xs text-zinc-400 flex justify-between">
        <span>Bricked SOL Recovery</span>
        <span>Data: Helius · Recovery: p-token SIMD-0266</span>
      </footer>
    </div>
  );
}
