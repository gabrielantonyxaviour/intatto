import type { Metadata } from "next"
import { LendPage } from "@/components/lend/lend-page"

export const metadata: Metadata = {
  title: "Lend · Intatto",
  description: "Deposit USDG into the Intatto vault and see where it is lent, what it earns and who pays for a loss.",
}

export default function Page() {
  return <LendPage />
}
