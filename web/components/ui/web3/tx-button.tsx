"use client"

import { useState, type ReactNode } from "react"
import { useAccount, useSwitchChain, useWriteContract } from "wagmi"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { Hex, TransactionReceipt } from "viem"
import { Loader2Icon } from "lucide-react"
import { REFUSALS } from "@intatto/config"
import { useIntatto } from "@/lib/chain"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ExplorerLink } from "./explorer-link"
import { decodeTxError, type DecodedTxError } from "./errors"
import type { ContractRequest } from "./types"

export type TxButtonProps = {
  /** Button text while idle. */
  label: ReactNode
  /** The write, or a builder for it. Null (or a builder returning null) disables the button. */
  request: ContractRequest | null | (() => ContractRequest | null)
  /** Why the form cannot be sent yet ("Enter an amount"); shown as the disabled label. */
  disabledReason?: string | null
  /** Custom error name → sentence. Defaults to the CollateralMarket refusals. */
  reasons?: Record<string, string>
  successMessage?: string
  onSuccess?: (receipt: TransactionReceipt, hash: Hex) => void
  onError?: (error: unknown) => void
  /** Simulate before sending (default true). */
  simulate?: boolean
  className?: string
  size?: "default" | "sm" | "lg"
}

type Phase =
  | { name: "idle" }
  | { name: "confirm" }
  | { name: "pending"; hash: Hex }
  | { name: "success"; hash: Hex }
  | { name: "error"; error: DecodedTxError }

const keyOf = (req: ContractRequest | null) =>
  req
    ? JSON.stringify([req.address, req.functionName, req.args ?? [], req.value ?? null], (_, v) =>
        typeof v === "bigint" ? `${v}n` : v,
      )
    : null

/**
 * Simulate → wallet → receipt, with the refusal as the label. Liquity V2's tx-flow states
 * (idle → awaiting-commit → awaiting-verify → confirmed | error) on one button.
 */
export function TxButton(props: TxButtonProps) {
  const { hydrated } = useIntatto()
  // wagmi mounts after hydration; until then show the idle label, disabled.
  if (!hydrated) {
    return (
      <div data-slot="tx-button" className={cn("grid gap-2", props.className)}>
        <Button type="button" size={props.size ?? "lg"} className="w-full" disabled>
          {props.label}
        </Button>
      </div>
    )
  }
  return <TxButtonInner {...props} />
}

function TxButtonInner({
  label,
  request,
  disabledReason,
  reasons = REFUSALS,
  successMessage = "Transaction confirmed",
  onSuccess,
  onError,
  simulate = true,
  className,
  size = "lg",
}: TxButtonProps) {
  const { chain, publicClient } = useIntatto()
  const { address, chainId: walletChainId, isConnected } = useAccount()
  const { switchChain, isPending: switching } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<Phase>({ name: "idle" })

  const req = typeof request === "function" ? request() : request
  const reqKey = keyOf(req)
  const onChain = isConnected && walletChainId === chain.id
  const busy = phase.name === "confirm" || phase.name === "pending"

  const sim = useQuery({
    queryKey: ["intatto:simulate", chain.id, address ?? null, reqKey],
    queryFn: async () => {
      await publicClient.simulateContract({ ...req!, account: address! } as Parameters<typeof publicClient.simulateContract>[0])
      return true
    },
    enabled: simulate && onChain && !!req && !!address && !disabledReason && !busy,
    retry: false,
    staleTime: 5_000,
    refetchInterval: 15_000,
  })
  const simError = sim.error ? decodeTxError(sim.error, reasons) : null

  async function send() {
    if (!req || !address) return
    setPhase({ name: "confirm" })
    try {
      const hash = await writeContractAsync({
        ...req,
        account: address,
        chainId: chain.id,
      } as Parameters<typeof writeContractAsync>[0])
      setPhase({ name: "pending", hash })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status === "reverted") throw new Error(`The transaction was mined but reverted (${hash}).`)
      setPhase({ name: "success", hash })
      toast.success(successMessage, { description: `Transaction ${hash.slice(0, 10)}…` })
      onSuccess?.(receipt, hash)
      void queryClient.invalidateQueries()
    } catch (err) {
      setPhase({ name: "error", error: decodeTxError(err, reasons) })
      onError?.(err)
    }
  }

  let text: ReactNode = label
  let onClick: (() => void) | undefined = send
  let spinning = false
  if (!isConnected) {
    text = "Connect a wallet"
    onClick = undefined
  } else if (!onChain) {
    text = switching ? "Switching…" : `Switch to ${chain.name}`
    onClick = switching ? undefined : () => switchChain({ chainId: chain.id })
    spinning = switching
  } else if (phase.name === "confirm") {
    text = "Confirm in your wallet…"
    onClick = undefined
    spinning = true
  } else if (phase.name === "pending") {
    text = "Pending…"
    onClick = undefined
    spinning = true
  } else if (disabledReason) {
    text = disabledReason
    onClick = undefined
  } else if (!req) {
    onClick = undefined
  } else if (simulate && sim.isPending) {
    text = "Checking…"
    onClick = undefined
    spinning = true
  } else if (simError?.kind === "refused") {
    text = `Refused: ${simError.errorName ?? "reverted"}`
    onClick = undefined
  } else if (simError) {
    text = "Retry check"
    onClick = () => void sim.refetch()
  } else if (phase.name === "error") {
    text = "Retry"
  }

  const note = (() => {
    if (!onChain) return null
    if (phase.name === "pending" || phase.name === "success") {
      return (
        <p className="text-xs text-muted-foreground">
          {phase.name === "pending" ? "Waiting for the receipt · " : "Confirmed · "}
          <ExplorerLink hash={phase.hash} />
        </p>
      )
    }
    if (busy || disabledReason || !req) return null
    if (simError) return <ErrorNote error={simError} />
    if (phase.name === "error") return <ErrorNote error={phase.error} />
    return null
  })()

  return (
    <div data-slot="tx-button" className={cn("grid gap-2", className)}>
      <Button
        type="button"
        size={size}
        className="w-full"
        disabled={!onClick}
        aria-busy={spinning || undefined}
        data-phase={phase.name}
        onClick={onClick}
      >
        {spinning ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
        {text}
      </Button>
      {note}
    </div>
  )
}

function ErrorNote({ error }: { error: DecodedTxError }) {
  return (
    <div role="status" className="grid gap-1 text-xs">
      <p className={error.kind === "rejected" ? "text-muted-foreground" : "text-destructive"}>{error.message}</p>
      <details className="text-muted-foreground">
        <summary className="cursor-pointer select-none">More details</summary>
        <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted p-2 text-[11px] break-all whitespace-pre-wrap">
          {error.details}
        </pre>
      </details>
    </div>
  )
}
