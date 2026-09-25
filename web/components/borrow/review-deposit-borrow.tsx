"use client"

import { useState } from "react"
import type { Address, Hex } from "viem"
import { collateralMarketAbi } from "@intatto/config/abi"
import type { MarketState, VaultState } from "@/lib/chain"
import { ApproveThenAct, TxButton } from "@/components/ui/web3"
import { pct, usd6, usdg } from "./format"
import { useNames } from "./names"
import { valueOf, yearlyInterest } from "./math"
import type { BorrowPlan } from "./plan"
import { DoneRow, FinishedNote, PreviewCard, ReceiptRow, ReviewHeader, UpcomingRow, type DoneStep } from "./review-parts"

type Props = {
  m: MarketState
  v: VaultState
  market: { market: Address; token: Address }
  plan: BorrowPlan
  onBack: () => void
  /** Called after a confirmed deposit; resolves once the position has been re-read. */
  onDeposited: () => Promise<void>
  onBorrowed: () => Promise<void>
}

/** Review & send: preview card, itemised receipt, then approve → deposit → borrow, one wallet step at a time. */
export function DepositBorrowReview({ m, v, market, plan, onBack, onDeposited, onBorrowed }: Props) {
  // The receipt describes what was reviewed, even after a step clears its field.
  const [snap] = useState(() => ({ deposit: plan.deposit, shares: plan.depositShares, loan: plan.loan }))
  const [done, setDone] = useState<DoneStep[]>([])
  const names = useNames()
  const nvdax = names.tokens
  const pendingDeposit = plan.deposit > 0n
  const pendingBorrow = plan.loan > 0n
  const finished = !pendingDeposit && !pendingBorrow && done.length > 0
  const add = (title: string, hash: Hex) => setDone((d) => [...d, { title, hash }])

  return (
    <div className="grid gap-5" data-testid="borrow-review">
      <ReviewHeader title={finished ? "Done" : "Review & send"} onBack={onBack} />
      <PreviewCard caption={finished ? "Your USDG loan" : "USDG loan · preview"} after={plan.after} m={m} v={v} />

      <div>
        {snap.deposit > 0n ? (
          <ReceiptRow
            label="Collateral deposit"
            value={nvdax(snap.deposit)}
            sub={`≈ ${usd6(valueOf(snap.deposit, m.priceE18))} · held as ${names.shares(snap.shares)}`}
          />
        ) : null}
        {snap.loan > 0n ? <ReceiptRow label="Loan" value={usdg(snap.loan)} sub="Sent to your wallet" /> : null}
        <ReceiptRow
          label="Interest rate"
          value={`${pct(v.borrowRateBps)} variable`}
          sub={`≈ ${usdg(yearlyInterest(plan.after.debt, v.borrowRateBps))} per year at today's rate`}
        />
        <ReceiptRow label="Liquidation penalty" value="5%" sub="Only charged if the position is liquidated" />
      </div>

      <div className="grid gap-3">
        {done.length > 0 ? (
          <ol className="grid gap-2">
            {done.map((s) => (
              <DoneRow key={s.hash} step={s} />
            ))}
          </ol>
        ) : null}

        {pendingDeposit ? (
          <>
            <ApproveThenAct
              token={{ address: market.token, symbol: names.token, decimals: 18 }}
              spender={market.market}
              amount={plan.deposit}
              action={{ address: market.market, abi: collateralMarketAbi, functionName: "addCollateral", args: [plan.deposit] }}
              actionLabel={`Deposit ${nvdax(plan.deposit)}`}
              successMessage="Collateral deposited"
              onSuccess={async (_receipt, hash) => {
                add(`Deposited ${nvdax(plan.deposit)}`, hash)
                await onDeposited()
              }}
            />
            {pendingBorrow ? (
              <ol>
                <UpcomingRow n={3} title={`Borrow ${usdg(plan.loan)}`} note="Checked by the contract again once your collateral is in." />
              </ol>
            ) : null}
          </>
        ) : pendingBorrow ? (
          <TxButton
            label={`Borrow ${usdg(plan.loan)}`}
            request={{ address: market.market, abi: collateralMarketAbi, functionName: "borrow", args: [plan.loan] }}
            successMessage="USDG borrowed"
            onSuccess={async (_receipt, hash) => {
              add(`Borrowed ${usdg(plan.loan)}`, hash)
              await onBorrowed()
            }}
          />
        ) : null}

        {finished ? (
          <FinishedNote onDone={onBack}>
            {snap.loan > 0n ? `You borrowed ${usdg(snap.loan)}.` : `Your ${nvdax(snap.deposit)} is in.`} Watch the position panel:
            it shows what a Monday gap would do to it.
          </FinishedNote>
        ) : (
          <p className="text-xs text-muted-foreground">Each button opens your wallet to sign one transaction.</p>
        )}
      </div>
    </div>
  )
}
