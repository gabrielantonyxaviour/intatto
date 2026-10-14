import type { Metadata } from "next"
import { SandboxPageHeader } from "@/components/sandbox/page-header"
import { BlocksView } from "@/components/sandbox/explorer/blocks-view"

export const metadata: Metadata = {
  title: "Sandbox explorer · Intatto",
  description: "Blocks and transactions on your sandbox fork of X Layer mainnet.",
}

export default function Page() {
  return (
    <div className="grid gap-6">
      <SandboxPageHeader title="Sandbox explorer" description="Recent blocks and transactions on your simulated fork of X Layer." />
      <BlocksView />
    </div>
  )
}
