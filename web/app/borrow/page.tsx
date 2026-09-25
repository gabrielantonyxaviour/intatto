import type { Metadata } from "next"
import { ChainReady } from "@/lib/chain"
import { BorrowScreen } from "@/components/borrow/borrow-screen"
import { BorrowSkeleton } from "@/components/borrow/states"

export const metadata: Metadata = {
  title: "Borrow · Intatto",
  description: "Borrow USDG against NVDAx on X Layer, with limits that follow the US market session.",
}

export default function BorrowPage() {
  return (
    <ChainReady fallback={<BorrowSkeleton />}>
      <BorrowScreen />
    </ChainReady>
  )
}
