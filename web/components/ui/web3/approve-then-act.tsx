"use client"

import type { ReactNode } from "react"
import { useAccount } from "wagmi"
import { useQuery } from "@tanstack/react-query"
import { erc20Abi, type Address, type Hex, type TransactionReceipt } from "viem"
import { CheckIcon } from "lucide-react"
import { useIntatto } from "@/lib/chain"
import { cn } from "@/lib/utils"
import { TxButton } from "./tx-button"
import { TokenAmount } from "./token-amount"
import type { ContractRequest, TokenInfo } from "./types"

export type ApproveThenActProps = {
  token: TokenInfo
  spender: Address
  /** Amount the action will pull, in base units. null while the form is incomplete. */
  amount: bigint | null
  action: ContractRequest | null | (() => ContractRequest | null)
  actionLabel: string
  approveLabel?: string
  disabledReason?: string | null
  reasons?: Record<string, string>
  successMessage?: string
  onSuccess?: (receipt: TransactionReceipt, hash: Hex) => void
  className?: string
}

type StepState = "done" | "current" | "upcoming"

/** Two steps, 1 Approve and 2 Act; approve is skipped when the allowance already covers the amount. */
export function ApproveThenAct(props: ApproveThenActProps) {
  const { hydrated } = useIntatto()
  // wagmi mounts after hydration; the inner component reads the wallet.
  return hydrated ? <ApproveThenActInner {...props} /> : null
}

function ApproveThenActInner({
  token,
  spender,
  amount,
  action,
  actionLabel,
  approveLabel = `Approve ${token.symbol}`,
  disabledReason,
  reasons,
  successMessage,
  onSuccess,
  className,
}: ApproveThenActProps) {
  const { publicClient, chain } = useIntatto()
  const { address: owner } = useAccount()

  const allowance = useQuery({
    queryKey: ["intatto:allowance", chain.id, token.address, owner ?? null, spender],
    queryFn: () =>
      publicClient.readContract({ address: token.address, abi: erc20Abi, functionName: "allowance", args: [owner!, spender] }),
    enabled: !!owner,
    retry: 1,
  })

  const wanted = amount !== null && amount > 0n ? amount : null
  const known = allowance.data !== undefined
  const needsApproval = wanted !== null && known && allowance.data! < wanted
  const approveState: StepState = needsApproval ? "current" : wanted !== null && known ? "done" : "upcoming"
  const actState: StepState = wanted !== null && known && !needsApproval ? "current" : "upcoming"

  const approveNote =
    !owner || wanted === null ? (
      `Lets the contract move your ${token.symbol}.`
    ) : allowance.isError && !known ? (
      <span className="text-destructive">
        Could not read your allowance.{" "}
        <button type="button" className="underline underline-offset-4" onClick={() => void allowance.refetch()}>
          Try again
        </button>
      </span>
    ) : !known ? (
      "Checking your allowance…"
    ) : needsApproval ? (
      <>
        Allow <TokenAmount value={wanted} decimals={token.decimals} symbol={token.symbol} />.
      </>
    ) : (
      "Not needed: your allowance already covers this amount."
    )

  return (
    <div data-slot="approve-then-act" className={cn("grid gap-3", className)}>
      <ol className="grid gap-2">
        <Step n={1} state={approveState} title={approveLabel} note={approveNote} />
        <Step n={2} state={actState} title={actionLabel} />
      </ol>
      {needsApproval ? (
        <TxButton
          key="approve"
          label={approveLabel}
          request={{ address: token.address, abi: erc20Abi, functionName: "approve", args: [spender, wanted] }}
          disabledReason={disabledReason}
          successMessage={`${token.symbol} approved`}
          onSuccess={() => void allowance.refetch()}
        />
      ) : (
        <TxButton
          key="act"
          label={actionLabel}
          request={action}
          disabledReason={
            disabledReason ??
            (owner && wanted !== null && !known
              ? allowance.isError
                ? "Allowance unavailable"
                : "Checking allowance…"
              : null)
          }
          reasons={reasons}
          successMessage={successMessage}
          onSuccess={onSuccess}
        />
      )}
    </div>
  )
}

function Step({ n, state, title, note }: { n: number; state: StepState; title: ReactNode; note?: ReactNode }) {
  return (
    <li data-state={state} aria-current={state === "current" ? "step" : undefined} className="flex items-start gap-3">
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums",
          state === "current" && "border-primary bg-primary text-primary-foreground",
          state === "done" && "border-success bg-success text-white",
          state === "upcoming" && "text-muted-foreground",
        )}
      >
        {state === "done" ? <CheckIcon aria-hidden className="size-3.5" /> : n}
      </span>
      <div className="grid min-w-0 gap-0.5 pt-0.5">
        <span className={cn("text-sm", state === "current" ? "font-medium" : "text-muted-foreground")}>
          {title}
          {state === "current" ? <span className="sr-only"> (current step)</span> : null}
        </span>
        {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
      </div>
    </li>
  )
}
