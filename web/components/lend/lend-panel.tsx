"use client"

import { useAccount } from "wagmi"
import { TriangleAlertIcon } from "lucide-react"
import { useIntatto, type AccountState, type VaultState } from "@/lib/chain"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DepositForm } from "./deposit-form"
import { WithdrawForm } from "./withdraw-form"

/** The sticky side panel: Deposit and Withdraw share one card, like the captured vault page. */
export function LendPanel({
  vault,
  account,
  accountError,
  termsAccepted,
  onOpenPrimer,
}: {
  vault: VaultState
  account: AccountState | undefined
  accountError: boolean
  termsAccepted: boolean
  onOpenPrimer: () => void
}) {
  const { chain } = useIntatto()
  const { isConnected, chainId } = useAccount()
  const wrongNetwork = isConnected && chainId !== chain.id

  return (
    <Card data-testid="lend-panel">
      <CardContent className="grid gap-3">
        {!isConnected ? (
          <p className="text-sm text-muted-foreground">Connect a wallet to deposit or withdraw USDG.</p>
        ) : null}
        {wrongNetwork ? (
          <Alert variant="warning">
            <TriangleAlertIcon aria-hidden />
            <AlertTitle>Wrong network</AlertTitle>
            <AlertDescription>
              Your wallet is on chain {chainId}. Switch to {chain.name} to deposit or withdraw.
            </AlertDescription>
          </Alert>
        ) : null}
        {accountError ? (
          <Alert variant="destructive">
            <TriangleAlertIcon aria-hidden />
            <AlertTitle>Your balances could not be read</AlertTitle>
            <AlertDescription>The RPC did not answer. Amount checks use what was last read.</AlertDescription>
          </Alert>
        ) : null}
        <Tabs defaultValue="deposit">
          <TabsList className="w-full">
            <TabsTrigger value="deposit">Deposit</TabsTrigger>
            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
          </TabsList>
          <TabsContent value="deposit" className="pt-2">
            <DepositForm vault={vault} account={account} termsAccepted={termsAccepted} onOpenPrimer={onOpenPrimer} />
          </TabsContent>
          <TabsContent value="withdraw" className="pt-2">
            <WithdrawForm vault={vault} account={account} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
