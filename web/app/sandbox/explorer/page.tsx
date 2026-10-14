import type { Metadata } from "next"
import { BlocksView } from "@/components/sandbox/explorer/blocks-view"

export const metadata: Metadata = {
  title: "Sandbox explorer · Intatto",
  description: "Blocks and transactions on your sandbox fork of X Layer mainnet.",
}

export default function Page() {
  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold">Sandbox explorer</h1>
        <p className="text-muted-foreground">Every block on this session&apos;s chain, newest first, back to the X Layer mainnet block it forked from. Each block points to its parent by hash.</p>
      </header>
      <BlocksView />
    </div>
  )
}
