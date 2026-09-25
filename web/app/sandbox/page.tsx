import type { Metadata } from "next"
import { SandboxScreen } from "@/components/sandbox/sandbox-screen"

export const metadata: Metadata = {
  title: "Sandbox · Intatto",
  description:
    "A fork of X Layer mainnet with a throwaway wallet. No real money moves.",
}

export default function Page() {
  return <SandboxScreen />
}
