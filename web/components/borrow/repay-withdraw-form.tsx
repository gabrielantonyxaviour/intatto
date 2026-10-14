"use client"

import { formatUnits, type Address } from "viem"
import { ShieldCheckIcon } from "lucide-react"
import { collateralMarketAbi } from "@intatto/config/abi"
import type { AccountState, MarketState } from "@/lib/chain"
import { AmountField } from "./amount-field"
import { FormCta, precheckCta, simulatedCta, type Cta } from "./form-cta"
import { Button } from "@/components/ui/button"
import { LoanLine } from "./loan-details"
import { usePreflight } from "./preflight"
import { distinct, usdg } from "./format"
import { useNames } from "./names"
import type { RepayPlan } from "./plan"

export type RepayDraft = { repay: string; withdraw: string; all: boolean }

type Props = {
  m: MarketState
  a: AccountState | null
  marketAddress: Address
  draft: RepayDraft
  onDraft: (patch: Partial<RepayDraft>) => void
  plan: RepayPlan
  onReview: () => void
}

function repayCta(plan: RepayPlan, pure: Cta | null, combined: Cta | null): Cta {
  if (plan.empty) return { label: "Enter an amount", enabled: false }
  if (plan.repayError) return { label: plan.repayError, enabled: false }
  if (plan.withdrawError && !plan.refusal) return { label: plan.withdrawError, enabled: false }
  const verdict = plan.withdrawShares > 0n ? (plan.repay === 0n ? pure : combined) : null
  if (verdict) return verdict
  return { label: "Review", enabled: true }
}

/** Morpho's mirrored panel: repay the loan and withdraw collateral, one summary for both. */
export function RepayWithdrawForm({ m, a, marketAddress, draft, onDraft, plan, onReview }: Props) {
  const pureWithdraw = plan.repay === 0n && plan.withdrawShares > 0n && plan.withdrawShares <= plan.before.shares
  const preflight = usePreflight(
    pureWithdraw
      ? { address: marketAddress, abi: collateralMarketAbi, functionName: "withdrawCollateral", args: [plan.withdrawShares, true] }
      : null,
  )
  const cta = repayCta(plan, simulatedCta(preflight, plan.refusal), precheckCta(plan.refusal))
  const names = useNames()
  const debt = plan.before.debt
  const wallet = a?.walletUsdg ?? 0n
  // Enough decimals that a wallet just short of the debt never reads "holds 0.40, owes 0.40".
  const [held, owed] = distinct(wallet, debt, 6, 2)
  const [left] = distinct(debt - plan.repayMax, 0n, 6, 2)

  return (
    <div className="grid gap-5" data-testid="repay-withdraw-form">
      <div className="grid gap-2">
        <AmountField
          id="repay-amount"
          label="Repay loan"
          token="USDG"
          decimals={6}
          value={draft.repay}
          onChange={(value, amount) => onDraft({ repay: value, all: amount !== null && amount === plan.repayMax && !plan.walletShort })}
          balance={a?.walletUsdg}
          balanceLabel="Wallet"
          max={a && debt > 0n ? plan.repayMax : undefined}
          tooLargeMessage={plan.walletShort ? "Insufficient USDG balance" : "More than you owe"}
          error={plan.repayError === "Nothing to repay" ? "You have no debt to repay." : null}
          footer={<span className="tabular-nums">Debt: {a ? usdg(debt) : "—"}</span>}
        />
        {a && debt > 0n ? <div role="group" aria-label="Repay presets" className="flex gap-1.5">
          {[25, 50, 75, 100].map((percent) => <Button key={percent} variant="outline" size="xs"
            onClick={() => onDraft({ repay: formatUnits(plan.repayMax * BigInt(percent) / 100n, 6), all: percent === 100 && !plan.walletShort })}>
            {percent === 100 ? "Max" : `${percent}%`}
          </Button>)}
        </div> : null}
        {plan.walletShort ? (
          <div className="grid gap-1 text-xs text-warning-foreground" data-testid="repay-wallet-short">
            <p>Max repays your available USDG. The remaining debt keeps accruing interest.</p>
            <details className="text-muted-foreground">
              <summary className="cursor-pointer">Exact balances</summary>
              <p>Wallet: {held} USDG. Debt: {owed} USDG. After Max: {left} USDG still owed.</p>
            </details>
          </div>
        ) : plan.repayAll ? (
          <p className="text-xs text-muted-foreground">Repays the whole loan, including interest that accrues until it lands.</p>
        ) : null}
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <ShieldCheckIcon aria-hidden className="mt-px size-3.5 shrink-0" />
          Repaying works in every market session.
        </p>
      </div>

      <div className="grid gap-2">
        <AmountField
          id="withdraw-amount"
          label="Withdraw collateral"
          token={names.token}
          decimals={18}
          value={draft.withdraw}
          onChange={(value) => onDraft({ withdraw: value })}
          balance={a ? plan.maxAssets : undefined}
          balanceLabel="Withdrawable"
          max={a && plan.before.shares > 0n ? plan.maxAssets : undefined}
          tooLargeMessage={plan.withdrawError ?? `More than you can withdraw now: up to ${names.tokens(plan.maxAssets)}.`}
          error={plan.withdrawError}
          footer={
            <span className="tabular-nums">
              {a ? `Deposited ${names.tokens(plan.before.assets)}` : "Deposited collateral unavailable or loading"}
            </span>
          }
        />
        <p className="text-xs text-muted-foreground">
          {!a ? "Account data is needed to calculate how much you can withdraw." : debt === 0n
            ? "With no debt you can take everything out, whatever the session."
            : `Keep enough collateral for the ${m.session} limit. Withdrawals with debt also need a fresh price.`}
        </p>
      </div>

      {a ? <LoanLine m={m} before={plan.before} after={plan.after} previewing={!plan.empty} /> : null}
      <FormCta cta={a ? cta : { label: "Account data unavailable or loading", enabled: false }} onReview={onReview} />
    </div>
  )
}
