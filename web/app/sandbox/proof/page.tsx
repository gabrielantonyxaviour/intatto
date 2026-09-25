import { Suspense } from "react"
import type { Metadata } from "next"
import { ChainReady } from "@/lib/chain/context"
import { ForkProofPage } from "@/components/fork-proof/fork-proof-page"
import { ProofSkeleton } from "@/components/fork-proof/proof-skeleton"

export const metadata: Metadata = {
  title: "Fork proof · Intatto",
  description: "Checks, run in your browser, that the Intatto sandbox is X Layer mainnet forked at one block.",
}

export default function Page() {
  return (
    <ChainReady fallback={<ProofSkeleton />}>
      <Suspense fallback={<ProofSkeleton />}>
        <ForkProofPage />
      </Suspense>
    </ChainReady>
  )
}
