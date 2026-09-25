import type { Metadata } from "next"
import { AgentsCatalog } from "@/components/agents/catalog"

export const metadata: Metadata = { title: "Agents · Intatto" }

export default function AgentsPage() {
  return <AgentsCatalog />
}
