import type { Metadata } from "next"
import { SandboxScreen } from "@/components/sandbox/sandbox-screen"

export const metadata: Metadata = {
  title: "Sandbox · Intatto",
  description:
    "Start your own fork of X Layer mainnet with Intatto deployed: move the clock to the weekend, replay a gap or a split, and read every admin call in the ledger.",
}

export default function Page() {
  return <SandboxScreen />
}
