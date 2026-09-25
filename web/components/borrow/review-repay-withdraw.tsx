"use client"

import { useState } from "react"
import { ReviewDialog } from "@/components/ui/ix"
import type { Address, Hex } from "viem"
import { collateralMarketAbi } from "@intatto/config/abi"
import { useIntatto, type MarketState, type VaultState } from "@/lib/chain"
import { ApproveThenAct, TxButton } from "@/components/ui/web3"
import { pct, usdg } from "./format"
import { useNames } from "./names"
import type { RepayPlan } from "./plan"
import { DoneRow, FinishedNote, PreviewCard, ReceiptRow, UpcomingRow, type DoneStep } from "./review-parts"

type Props = {
  m: MarketState
  v: VaultState
  market: { market: Address }
  usdgAddress: Address
  plan: RepayPlan
  onBack: () => void
  onRepaid: () => Promise<void>
  onWithdrawn: () => Promise<void>
}

/** Review & send for the mirrored panel: approve → repay, then withdraw (collateral comes back unwrapped to the stock token). */
export function RepayWithdrawReview({ m, v, market, usdgAddress, plan, onBack, onRepaid, onWithdrawn }: Props) {
  const [before] = useState(plan.before)
  const [snap] = useState(() => ({
    repay: plan.repayAll ? plan.before.debt : plan.repay,
    repayAll: plan.repayAll,
    // Fixed at review time: the live debt keeps accruing, and a moving target would ask for a new approval each block.
    approve: plan.repayApprove,
    assets: plan.withdrawAssets,
    shares: plan.withdrawShares,
  }))
  const [done, setDone] = useState<DoneStep[]>([])
  const names = useNames()
  const { chain, mode } = useIntatto()
  const nvdax = names.tokens
  const pendingRepay = plan.repay > 0n
  const pendingWithdraw = plan.withdrawShares > 0n
  const finished = !pendingRepay && !pendingWithdraw && done.length > 0
  const add = (title: string, hash: Hex) => setDone((d) => [...d, { title, hash }])
  const repayTitle = plan.repayAll ? "Repay the whole loan" : `Repay ${usdg(plan.repay)}`

  return (
    <ReviewDialog open onOpenChange={(open) => { if (!open) onBack() }}
      title="Review repay & withdraw" amount={snap.repay > 0n ? usdg(snap.repay) : nvdax(snap.assets)} asset=""
      chain={`${chain.name}${mode === "sandbox" ? " · no real money" : ""}`}
      beforeAfter={<PreviewCard caption={finished ? "Your position" : "Position after · preview"} before={before} after={plan.after} v={v} />}
      limit={<p className="text-xs text-muted-foreground">{m.session} session · new-borrow limit {pct(m.maxLtvBps)} · liquidation at {pct(m.liquidationThresholdBps)}</p>}
      testId="repay-review" actionLabel="Transaction steps" action={
      <div className="grid gap-3">
        {done.length > 0 ? (
          <ol className="grid gap-2">
            {done.map((s) => (
              <DoneRow key={s.hash} step={s} />
            ))}
          </ol>
        ) : null}

        {pendingRepay ? (
          <>
            <ApproveThenAct
              token={{ address: usdgAddress, symbol: "USDG", decimals: 6 }}
              spender={market.market}
              amount={snap.approve}
              action={{ address: market.market, abi: collateralMarketAbi, functionName: "repay", args: [plan.repayArg] }}
              actionLabel={repayTitle}
              successMessage="Loan repaid"
              onSuccess={async (_receipt, hash) => {
                add(plan.repayAll ? `Repaid the whole loan (${usdg(plan.before.debt)})` : `Repaid ${usdg(plan.repay)}`, hash)
                await onRepaid()
              }}
            />
            {pendingWithdraw ? (
              <ol>
                <UpcomingRow n={3} title={`Withdraw ${nvdax(plan.withdrawAssets)}`} note="Checked by the contract again once the repayment is in." />
              </ol>
            ) : null}
          </>
        ) : pendingWithdraw ? (
          <TxButton
            label={`Withdraw ${nvdax(plan.withdrawAssets)}`}
            request={{
              address: market.market,
              abi: collateralMarketAbi,
              functionName: "withdrawCollateral",
              args: [plan.withdrawShares, true],
            }}
            successMessage="Collateral withdrawn"
            onSuccess={async (_receipt, hash) => {
              add(`Withdrew ${nvdax(plan.withdrawAssets)}`, hash)
              await onWithdrawn()
            }}
          />
        ) : null}

        {finished ? (
          <FinishedNote onDone={onBack}>
            {plan.before.debt === 0n ? "Your loan is fully repaid." : `You now owe ${usdg(plan.before.debt)}.`}
          </FinishedNote>
        ) : (
          <p className="text-xs text-muted-foreground">Each button opens your wallet to sign one transaction.</p>
        )}
      </div>
      }
      feeInfo="Network fees are estimated by your wallet before signing each transaction."
    >
      <div>
        {snap.repay > 0n ? (
          <ReceiptRow
            label="Repay"
            value={usdg(snap.repay)}
            sub={snap.repayAll ? "The whole loan, plus interest accrued until it lands" : "From your wallet"}
          />
        ) : null}
        {snap.shares > 0n ? (
          <ReceiptRow label="Withdraw collateral" value={nvdax(snap.assets)} sub={`${names.shares(snap.shares)} unwrapped to ${names.token}`} />
        ) : null}
        <ReceiptRow label="Price or session checks on repay" value="None" sub="Repay works in every session, even when borrowing is paused" />
      </div>
    </ReviewDialog>
  )
}
