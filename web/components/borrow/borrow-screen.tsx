"use client"

import { useRef, useState } from "react"
import type { Address } from "viem"
import { InfoIcon } from "lucide-react"
import type { MarketSymbol } from "@/lib/chain"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DepositBorrowForm, type BorrowDraft } from "./deposit-borrow-form"
import { MarketStatusAlert, SessionBadge } from "./market-info"
import { MarketStrip } from "./market-strip"
import { MarketSelect, useSelectedMarket, type MarketSelection } from "./market-select"
import { NamesProvider, namesFor, useNames } from "./names"
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

function Header({ selection, session }: { selection: MarketSelection; session?: Parameters<typeof SessionBadge>[0]["session"] }) {
  return (
    <header className="grid gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-3xl font-semibold tracking-tight">Borrow USDG</h1>
        <div className="flex flex-wrap items-center gap-2">
          <MarketSelect symbol={selection.symbol} available={selection.available} />
          {session ? <SessionBadge session={session} /> : null}
        </div>
      </div>
    </header>
  )
}

/** The borrow screen for the market in `?market=` (NVDAx by default); switching markets starts a fresh form. */
export function BorrowScreen() {
  const selection = useSelectedMarket()
  return (
    <NamesProvider names={namesFor(selection.symbol)}>
      <MarketBorrow key={selection.symbol} symbol={selection.symbol} selection={selection} />
    </NamesProvider>
  )
}

function UnknownMarket({ requested, symbol }: { requested: string; symbol: MarketSymbol }) {
  return (
    <Alert variant="info" data-testid="market-unknown">
      <InfoIcon aria-hidden />
      <AlertDescription>
        There is no {requested} market in this deployment (SPYx exists only in the sandbox), so this is the {symbol} market.
      </AlertDescription>
    </Alert>
  )
}

/** One market: one vertical form per tab, a review step, and the position panel beside it. */
function MarketBorrow({ symbol, selection }: { symbol: MarketSymbol; selection: MarketSelection }) {
  const names = useNames()
  const data = useBorrowData(symbol)
  // The session schedule and chain time are re-read every minute and after a sandbox warp; keep the last read
  // for this market on screen meanwhile instead of flashing "—" (the limits themselves are constants).
  const lastParams = useRef<{ symbol: MarketSymbol; params: NonNullable<typeof data.params.data> } | null>(null)
  if (data.params.data) lastParams.current = { symbol, params: data.params.data }
  const params = data.params.data ?? (lastParams.current?.symbol === symbol ? lastParams.current.params : undefined)
  const formCard = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<Tab>("borrow")
  const [reviewing, setReviewing] = useState(false)
  const [borrowDraft, setBorrowDraft] = useState<BorrowDraft>(EMPTY_BORROW)
  const [repayDraft, setRepayDraft] = useState<RepayDraft>(EMPTY_REPAY)
  const closeReview = () => {
    setReviewing(false)
    requestAnimationFrame(() => {
      const root = formCard.current
      const target = root?.querySelector<HTMLButtonElement>('[data-state="active"] [data-slot="form-cta"] button:not(:disabled)')
        ?? root?.querySelector<HTMLInputElement>('[data-state="active"] input')
      target?.focus()
    })
  }
  const unknown = selection.unknown ? <UnknownMarket requested={selection.unknown} symbol={symbol} /> : null

  if (!data.deployment || !data.market) {
    return (
      <div className="grid gap-6">
        <Header selection={selection} />
        <NotDeployed symbol={symbol} />
      </div>
    )
  }
  const { m, v, a } = data
  if (!m || !v) {
    return (
      <div className="grid gap-6">
        <Header selection={selection} />
        {unknown}
        {data.failed ? <LoadError error={data.error} retry={data.retry} /> : <BorrowSkeleton />}
      </div>
    )
  }

  const market = { market: data.market.market as Address, token: data.market.token as Address }
  const bPlan = borrowPlan(m, v, a, borrowDraft, names)
  const rPlan = repayPlan(m, v, a, repayDraft, names)
  const active = tab === "borrow" ? bPlan : rPlan
  const refetch = async () => {
    await data.refetchAccount()
  }

  return (
    <div className="grid gap-6" data-testid="borrow-screen">
      <Header selection={selection} session={m.session} />
      <MarketStrip m={m} v={v} params={params} />
      {unknown}
      {data.failed ? <LoadError error={data.error} retry={data.retry} /> : null}
      {data.wrongNetwork ? <WrongNetwork /> : null}
      <MarketStatusAlert m={m} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card ref={formCard} className="min-w-0 shadow-none">
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
                  <DepositBorrowForm
                    m={m}
                    a={a}
                    marketAddress={market.market}
                    draft={borrowDraft}
                    onDraft={(patch) => setBorrowDraft((d) => ({ ...d, ...patch }))}
                    plan={bPlan}
                    onReview={() => setReviewing(true)}
                  />
                {reviewing && tab === "borrow" ? (
                  <DepositBorrowReview
                    m={m}
                    v={v}
                    market={market}
                    plan={bPlan}
                    onBack={closeReview}
                    onDeposited={async () => {
                      await refetch()
                      setBorrowDraft((d) => ({ ...d, collateral: "" }))
                    }}
                    onBorrowed={async () => {
                      await refetch()
                      setBorrowDraft(EMPTY_BORROW)
                    }}
                  />
                ) : null}
              </TabsContent>
              <TabsContent value="repay" className="pt-4">
                  <RepayWithdrawForm
                    m={m}
                    a={a}
                    marketAddress={market.market}
                    draft={repayDraft}
                    onDraft={(patch) => setRepayDraft((d) => ({ ...d, ...patch }))}
                    plan={rPlan}
                    onReview={() => setReviewing(true)}
                  />
                {reviewing && tab === "repay" ? (
                  <RepayWithdrawReview
                    m={m}
                    v={v}
                    market={market}
                    usdgAddress={data.deployment.usdg as Address}
                    plan={rPlan}
                    onBack={closeReview}
                    onRepaid={async () => {
                      await refetch()
                      setRepayDraft((d) => ({ ...d, repay: "", all: false }))
                    }}
                    onWithdrawn={async () => {
                      await refetch()
                      setRepayDraft(EMPTY_REPAY)
                    }}
                  />
                ) : null}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <PositionPanel
          m={m}
          a={a}
          connected={Boolean(data.address)}
          loading={Boolean(data.address) && !a && !data.failed}
          before={active.before}
          after={active.empty ? null : active.after}
          reserveUsdg={v.reserveBalance}
          penaltyBps={params?.market.penaltyBps}
          params={params}
        />
      </div>
    </div>
  )
}
