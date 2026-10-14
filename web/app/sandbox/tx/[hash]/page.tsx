import type { Metadata } from "next"
import Link from "next/link"
import { TxView } from "@/components/sandbox/explorer/tx-view"

export const metadata: Metadata = {
  title: "Transaction · Sandbox explorer · Intatto",
  description: "A transaction on your sandbox fork of X Layer mainnet, read from the fork's RPC.",
}

export default async function Page({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params
  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <Link href="/sandbox/explorer" className="text-sm text-muted-foreground underline-offset-4 hover:underline">Sandbox explorer</Link>
        <h1 className="text-2xl font-semibold">Transaction</h1>
        <p className="text-muted-foreground">Read from this session&apos;s fork of X Layer mainnet, the same chain the app signs on.</p>
      </header>
      <TxView hash={hash} />
    </div>
  )
}
