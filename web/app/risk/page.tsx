import type { Metadata } from "next"
import { RiskConsole } from "@/components/risk/risk-console"

export const metadata: Metadata = {
  title: "Risk console · Intatto",
  description: "Every price post, rejection, session, cap, corporate action, liquidation and keeper action, read from the chain.",
}

export default function RiskPage() {
  return <RiskConsole />
}
