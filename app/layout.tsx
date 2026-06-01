import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { WalletProvider } from "./_components/WalletProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bricked SOL Recovery",
  description:
    "Find and recover excess SOL locked in SPL token mint accounts using p-token's withdraw_excess_lamports instruction.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
