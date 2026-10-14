"use client"

import { formatUnits, type Address } from "viem"
import { collateralMarketAbi } from "@intatto/config/abi"
import type { AccountState, MarketState } from "@/lib/chain"
import { AmountField } from "./amount-field"
import { FormCta, precheckCta, simulatedCta, type Cta } from "./form-cta"
import { LoanChips, LoanLine, RefusedNow, RiskAck } from "./loan-details"
import { useNames } from "./names"
import { usePreflight } from "./preflight"
import { capacityUsdg, usd6 } from "./format"
import { valueOf } from "./math"
import type { BorrowPlan } from "./plan"

export type BorrowDraft = { collateral: string; loan: string; ack: boolean }

type Props = {
  m: MarketState
  a: AccountState | null
  marketAddress: Address
  draft: BorrowDraft
  onDraft: (patch: Partial<BorrowDraft>) => void
  plan: BorrowPlan
  onReview: () => void
}

function borrowCta(plan: BorrowPlan, ack: boolean, pure: ReturnType<typeof simulatedCta>, combined: Cta | null): Cta {
  if (plan.empty) return { label: "Enter an amount", enabled: false }
  if (plan.balanceError) return { label: plan.balanceError, enabled: false }
  const verdict = plan.deposit === 0n ? pure : combined
  if (verdict) return verdict
  if (plan.needsAck && !ack) return { label: "Tick the risk box to continue", enabled: false }
  return { label: "Review", enabled: true }
}

/** The existing deposit and borrow flow, with a compact capacity and risk preview. */
export function DepositBorrowForm({ m, a, marketAddress, draft, onDraft, plan, onReview }: Props) {
  const names = useNames()
  const pureBorrow = plan.deposit === 0n && plan.loan > 0n && !plan.balanceError
  const preflight = usePreflight(
    pureBorrow ? { address: marketAddress, abi: collateralMarketAbi, functionName: "borrow", args: [plan.loan] } : null,
  )
  const cta = borrowCta(plan, draft.ack, simulatedCta(preflight, plan.refusal), precheckCta(plan.refusal))
  const hasCollateral = plan.before.assets > 0n || plan.deposit > 0n
  const loanError = !a || plan.loan === 0n ? null : !hasCollateral ? `Add ${names.token} collateral first.` : plan.loanError
  const pickLoan = (amount: bigint) => onDraft({ loan: formatUnits(amount, 6), ack: false })

  return (
    <div className="grid gap-5" data-testid="deposit-borrow-form">
      <div className="grid gap-2">
        <AmountField
          id="borrow-collateral"
          label="Collateral"
          token={names.token}
          decimals={18}
          value={draft.collateral}
          onChange={(value) => onDraft({ collateral: value, ack: false })}
          balance={a?.walletToken}
          balanceLabel="Wallet"
          max={a ? a.walletToken : undefined}
          tooLargeMessage={`Insufficient ${names.token} balance`}
          footer={
            plan.deposit > 0n ? (
              <span className="tabular-nums">
                ≈ {usd6(valueOf(plan.deposit, m.priceE18))}
              </span>
            ) : (
              "Adds to your collateral"
            )
          }
        />
      </div>

      <div className="grid gap-2">
        <AmountField
          id="borrow-loan"
          label="Loan"
          token="USDG"
          decimals={6}
          value={draft.loan}
          onChange={(value) => onDraft({ loan: value, ack: false })}
          error={loanError}
          footer={
            a && hasCollateral ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums" data-testid="borrow-capacity">
                  You can borrow up to {capacityUsdg(plan.limits.max)} now
                </span>
                <LoanChips
                  fill={plan.limits.fill}
                  capacity={plan.limits.max}
                  refusal={plan.marketRefusal}
                  onPick={pickLoan}
                />
              </span>
            ) : undefined
          }
        />
        {a ? <LoanLine m={m} before={plan.before} after={plan.after} previewing={!plan.empty} /> : <p className="text-xs text-muted-foreground">Position preview requires account data.</p>}
      </div>

      {a && plan.needsAck ? (
        <RiskAck after={plan.after} lt={m.liquidationThresholdBps} checked={draft.ack} onChange={(ack) => onDraft({ ack })} />
      ) : null}

      {(!cta.note || !a) && plan.marketRefusal ? <RefusedNow refusal={plan.marketRefusal} /> : null}
      <FormCta cta={a ? cta : { label: "Account data unavailable or loading", enabled: false }} onReview={onReview} />
    </div>
  )
}
