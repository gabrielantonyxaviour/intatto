"use client"

import Link from "next/link"
import { useAccount } from "wagmi"
import { useIntatto } from "@/lib/chain"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

/** Live-mode and wallet states every screen has to show before a call is useful. */
export function ChainNotices() {
  const { deployment, mode, chainId, chain } = useIntatto()
  const { chainId: walletChain, status } = useAccount()
  const wrongNetwork = status === "connected" && walletChain !== undefined && walletChain !== chainId

  return (
    <div className="grid gap-3 empty:hidden">
      {!deployment ? (
        <Alert>
          <AlertTitle>Not deployed on X Layer yet</AlertTitle>
          <AlertDescription>
            <p>
              Intatto is not deployed on X Layer yet — try the sandbox.{" "}
              <Link href="/sandbox" className="underline underline-offset-4">
                Open the sandbox
              </Link>
              .
            </p>
          </AlertDescription>
        </Alert>
      ) : null}
      {wrongNetwork ? (
        <Alert variant="warning">
          <AlertTitle>Wrong network</AlertTitle>
          <AlertDescription>
            This wallet is on chain {walletChain}. Switch it to {chain.name} (chain {chainId})
            {mode === "sandbox" ? ", the sandbox fork." : "."}
          </AlertDescription>
        </Alert>
      ) : null}

    </div>
  )
}
