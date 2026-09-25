"use client"

import { useState } from "react"
import Link from "next/link"
import { useAccount } from "wagmi"
import { RotateCwIcon, TriangleAlertIcon } from "lucide-react"
import { useAccountState, useIntatto, useVaultState } from "@/lib/chain"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AllocationSection } from "./allocation-section"
import { DeficitsSection } from "./deficits-section"
import { LendPanel } from "./lend-panel"
import { OverviewSection, PositionSection } from "./overview-section"
import { PrimerDialog } from "./primer-dialog"
import { RatesSection } from "./rates-section"
import { RiskSection } from "./risk-section"
import { useLendMarkets } from "./use-lend-reads"
import { useLendTerms } from "./use-lend-terms"
import { SectionNav, VaultHero } from "./vault-hero"

function NotDeployed() {
  return (
    <Card data-testid="lend-not-deployed" className="mx-auto max-w-xl">
      <CardContent className="grid gap-3">
        <h1 className="text-xl font-semibold">Lend USDG</h1>
        <p className="text-muted-foreground">
          Intatto is not deployed on X Layer yet, so there is no vault to deposit into. Try the sandbox: a fork of X Layer
          with Intatto deployed and a funded throwaway wallet.
        </p>
        <Button asChild className="justify-self-start">
          <Link href="/sandbox">Open the sandbox</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function LoadingState() {
  return (
    <div data-testid="lend-loading" className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid content-start gap-5">
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-5 w-full max-w-lg" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

function ErrorState({ onRetry, message }: { onRetry: () => void; message: string }) {
  const { chain } = useIntatto()
  return (
    <Alert variant="destructive" data-testid="lend-error">
      <TriangleAlertIcon aria-hidden />
      <AlertTitle>Could not read the vault</AlertTitle>
      <AlertDescription className="grid gap-2">
        <span className="break-words">
          {chain.name} did not answer: {message}
        </span>
        <Button variant="outline" size="sm" className="justify-self-start" onClick={onRetry}>
          <RotateCwIcon aria-hidden /> Try again
        </Button>
      </AlertDescription>
    </Alert>
  )
}

/** The lend screen: primer → vault page with deposit/withdraw → allocation → rates → risk → deficits. */
export function LendPage() {
  const { deployment } = useIntatto()
  if (!deployment) return <NotDeployed />
  return <LendScreen />
}

function LendScreen() {
  const { address } = useAccount()
  const terms = useLendTerms()
  const [primer, setPrimer] = useState<"auto" | "open" | "closed">("auto")
  const vault = useVaultState()
  const markets = useLendMarkets()
  const account = useAccountState(address)
  const primerOpen = primer === "open" || (primer === "auto" && !terms.accepted)

  const dialog = (
    <PrimerDialog
      open={primerOpen}
      onOpenChange={(open) => setPrimer(open ? "open" : "closed")}
      accepted={terms.accepted}
      onAccept={() => {
        terms.accept()
        setPrimer("closed")
      }}
    />
  )

  const failed = !vault.data || !markets.data ? vault.error ?? markets.error : null
  // The primer stays mounted across loading → loaded. It is absent on the error branch so it never covers retry.
  if (failed) {
    return (
      <ErrorState
        message={failed instanceof Error ? failed.message.split("\n")[0]! : "The RPC did not answer."}
        onRetry={() => {
          void vault.refetch()
          markets.refetch()
        }}
      />
    )
  }

  const v = vault.data
  const list = markets.data
  return (
    <>
      {dialog}
      {v && list ? (
        <div data-testid="lend-page" className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid min-w-0 grid-cols-1 content-start gap-6 lg:col-start-1">
            <VaultHero vault={v} />
            {vault.isRefetchError ? (
              <p className="text-xs text-destructive">Showing the last numbers read; the latest refresh failed.</p>
            ) : null}
          </div>
          <aside className="min-w-0 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
            <LendPanel
              vault={v}
              account={account.data}
              accountError={account.isError}
              termsAccepted={terms.accepted}
              onOpenPrimer={() => setPrimer("open")}
            />
            <Button variant="link" size="sm" className="mt-1 px-0" onClick={() => setPrimer("open")}>
              How lending works
            </Button>
          </aside>
          <div className="grid min-w-0 grid-cols-1 content-start gap-10 lg:col-start-1">
            <SectionNav />
            <OverviewSection vault={v} />
            <AllocationSection vault={v} markets={list} />
            <RatesSection vault={v} />
            <RiskSection vault={v} markets={list} />
            <DeficitsSection vault={v} />
            <PositionSection vault={v} account={account.data} loading={account.isPending && Boolean(address)} />
          </div>
        </div>
      ) : (
        <LoadingState />
      )}
    </>
  )
}
