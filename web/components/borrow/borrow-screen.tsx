"use client"

import { useState } from "react"
import type { Address } from "viem"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DepositBorrowForm, type BorrowDraft } from "./deposit-borrow-form"
import { MarketStatusAlert, SessionBadge } from "./market-info"
import { borrowPlan, repayPlan } from "./plan"
import { PositionPanel } from "./position-panel"
import { RepayWithdrawForm, type RepayDraft } from "./repay-withdraw-form"
import { DepositBorrowReview } from "./review-deposit-borrow"
import { RepayWithdrawReview } from "./review-repay-withdraw"
import { BorrowSkeleton, LoadError, NotDeployed, WrongNetwork } from "./states"
import { useBorrowData } from "./use-borrow-data"

type Tab = "borrow" | "repay"
const EMPTY_BORROW: BorrowDraft = { collateral: "", loan: "", ack: false }
const EMPTY_REPAY: RepayDraft = { repay: "", withdraw: "", all: false }

function Header({ session }: { session?: Parameters<typeof SessionBadge>[0]["session"] }) {
  return (
    <header className="grid gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">Borrow USDG with NVDAx</h1>
        {session ? <SessionBadge session={session} /> : null}
      </div>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Deposit NVDAx and borrow USDG against it. How much you can borrow follows the US market session; the liquidation
        line stays at 65% LTV around the clock.
      </p>
    </header>
  )
}

/** The borrow screen: one vertical form per tab, a review step, and the position panel beside it. */
export function BorrowScreen() {
  const data = useBorrowData()
  const [tab, setTab] = useState<Tab>("borrow")
  const [reviewing, setReviewing] = useState(false)
  const [borrowDraft, setBorrowDraft] = useState<BorrowDraft>(EMPTY_BORROW)
  const [repayDraft, setRepayDraft] = useState<RepayDraft>(EMPTY_REPAY)

  if (!data.deployment || !data.market) {
    return (
      <div className="grid gap-6">
        <Header />
        <NotDeployed />
      </div>
    )
  }
  const { m, v, a } = data
  if (!m || !v) {
    return (
      <div className="grid gap-6">
        <Header />
        {data.failed ? <LoadError error={data.error} retry={data.retry} /> : <BorrowSkeleton />}
      </div>
    )
  }

  const market = { market: data.market.market as Address, token: data.market.token as Address }
  const bPlan = borrowPlan(m, v, a, borrowDraft)
  const rPlan = repayPlan(m, v, a, repayDraft)
  const active = tab === "borrow" ? bPlan : rPlan
  const refetch = async () => {
    await data.refetchAccount()
  }

  return (
    <div className="grid gap-6" data-testid="borrow-screen">
      <Header session={m.session} />
      {data.failed ? <LoadError error={data.error} retry={data.retry} /> : null}
      {data.wrongNetwork ? <WrongNetwork /> : null}
      <MarketStatusAlert m={m} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]">
        <Card>
          <CardContent>
            <Tabs
              value={tab}
              onValueChange={(t) => {
                setTab(t as Tab)
                setReviewing(false)
              }}
            >
              <TabsList className="w-full">
                <TabsTrigger value="borrow">Deposit & borrow</TabsTrigger>
                <TabsTrigger value="repay">Repay & withdraw</TabsTrigger>
              </TabsList>
              <TabsContent value="borrow" className="pt-4">
                {reviewing && tab === "borrow" ? (
                  <DepositBorrowReview
                    m={m}
                    v={v}
                    market={market}
                    plan={bPlan}
                    onBack={() => setReviewing(false)}
                    onDeposited={async () => {
                      await refetch()
                      setBorrowDraft((d) => ({ ...d, collateral: "" }))
                    }}
                    onBorrowed={async () => {
                      await refetch()
                      setBorrowDraft(EMPTY_BORROW)
                    }}
                  />
                ) : (
                  <DepositBorrowForm
                    m={m}
                    v={v}
                    a={a}
                    marketAddress={market.market}
                    decay={data.decay}
                    draft={borrowDraft}
                    onDraft={(patch) => setBorrowDraft((d) => ({ ...d, ...patch }))}
                    plan={bPlan}
                    onReview={() => setReviewing(true)}
                  />
                )}
              </TabsContent>
              <TabsContent value="repay" className="pt-4">
                {reviewing && tab === "repay" ? (
                  <RepayWithdrawReview
                    m={m}
                    v={v}
                    market={market}
                    usdgAddress={data.deployment.usdg as Address}
                    plan={rPlan}
                    onBack={() => setReviewing(false)}
                    onRepaid={async () => {
                      await refetch()
                      setRepayDraft((d) => ({ ...d, repay: "", all: false }))
                    }}
                    onWithdrawn={async () => {
                      await refetch()
                      setRepayDraft(EMPTY_REPAY)
                    }}
                  />
                ) : (
                  <RepayWithdrawForm
                    m={m}
                    a={a}
                    marketAddress={market.market}
                    draft={repayDraft}
                    onDraft={(patch) => setRepayDraft((d) => ({ ...d, ...patch }))}
                    plan={rPlan}
                    onReview={() => setReviewing(true)}
                  />
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <PositionPanel
          m={m}
          a={a}
          connected={Boolean(data.address)}
          loading={Boolean(data.address) && !a && !data.failed}
          before={active.before} after={active.empty ? null : active.after} />
      </div>
    </div>
  )
}
