import type { Metadata } from "next"
import { CreditService } from "@/components/agents/service"

export const metadata: Metadata = { title: "Intatto credit and health · Intatto" }

export default function CreditServicePage() {
  return <CreditService />
}
