import type { Metadata } from "next"
import Link from "next/link"
import { SandboxPageHeader } from "@/components/sandbox/page-header"
import { TxView } from "@/components/sandbox/explorer/tx-view"

export const metadata: Metadata = {
  title: "Transaction · Sandbox explorer · Intatto",
  description: "A transaction on your sandbox fork of X Layer mainnet, read from the fork's RPC.",
}

export default async function Page({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params
  return (
    <div className="grid gap-6">
      <SandboxPageHeader title="Transaction" description="Read directly from your sandbox fork’s RPC.">
        <Link href="/sandbox/explorer" className="text-sm text-muted-foreground underline-offset-4 hover:underline">All blocks</Link>
      </SandboxPageHeader>
      <TxView hash={hash} />
    </div>
  )
}
