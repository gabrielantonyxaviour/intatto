"use client"

import { formatUnits, type Address } from "viem"
import { collateralMarketAbi } from "@intatto/config/abi"
import type { AccountState, MarketState, VaultState } from "@/lib/chain"
import { AmountInput } from "@/components/ui/web3"
import { FormCta, precheckCta, simulatedCta, type Cta } from "./form-cta"
import { CollateralLine } from "./market-info"
import { LoanChips, LoanLine, RateRow, RefusedNow, RiskAck } from "./loan-details"
import { useNames } from "./names"
import { usePreflight } from "./preflight"
import { capacityUsdg, usd6 } from "./format"
import { valueOf } from "./math"
import type { BorrowPlan } from "./plan"

export type BorrowDraft = { collateral: string; loan: string; ack: boolean }

type Props = {
  m: MarketState
  v: VaultState
  a: AccountState | null
  marketAddress: Address
  decay: { floorBps: bigint; duration: number } | null
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

/** Collateral → loan → rate, each with its consequence line; Liquity V2's single-column borrow form. */
export function DepositBorrowForm({ m, v, a, marketAddress, decay, draft, onDraft, plan, onReview }: Props) {
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
        <AmountInput
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
                ≈ {usd6(valueOf(plan.deposit, m.priceE18))} · held as {names.shares(plan.depositShares)}
              </span>
            ) : (
              "Adds to your collateral"
            )
          }
        />
        <CollateralLine m={m} decay={decay} />
      </div>

      <div className="grid gap-2">
        <AmountInput
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
                  Can borrow {capacityUsdg(plan.limits.max)}
                </span>
                <LoanChips
                  chips={plan.chips}
                  session={m.session}
                  maxLtvBps={m.maxLtvBps}
                  fill={plan.limits.fill}
                  capacity={plan.limits.max}
                  refusal={plan.marketRefusal}
                  onPick={pickLoan}
                />
              </span>
            ) : undefined
          }
        />
        {a && hasCollateral && plan.marketRefusal ? <RefusedNow refusal={plan.marketRefusal} /> : null}
        <LoanLine m={m} before={plan.before} after={plan.after} previewing={!plan.empty} />
      </div>

      <RateRow v={v} debtAfter={plan.after.debt} />

      {plan.needsAck ? (
        <RiskAck after={plan.after} lt={m.liquidationThresholdBps} checked={draft.ack} onChange={(ack) => onDraft({ ack })} />
      ) : null}

      <FormCta cta={cta} onReview={onReview} />
    </div>
  )
}
