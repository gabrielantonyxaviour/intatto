"use client"

import { useState } from "react"
import { formatUnits } from "viem"
import { AmountInput, type AmountInputProps } from "@/components/ui/web3"
import { formatTokenAmount, parseAmount } from "@/components/ui/web3/format"
import { cn } from "@/lib/utils"

/** Compact visual value at rest; the shared input always retains the exact, editable draft. */
export function AmountField({ balance, balanceLabel = "Wallet", footer, ...props }: AmountInputProps) {
  const [editing, setEditing] = useState(false)
  const amount = parseAmount(props.value, props.decimals)
  const format = (value: bigint) => formatTokenAmount(value, props.decimals, {
    maxFractionDigits: props.decimals === 6 ? 2 : 4, minFractionDigits: props.decimals === 6 ? 2 : 0,
  })
  const compact = !editing && amount !== null
  const invalid = props.invalid || props.error || (amount !== null && props.max !== undefined && amount > props.max)
  return <div className="relative" title={props.value ? `Exact amount: ${props.value}` : undefined}
    onFocusCapture={(event) => { if (event.target instanceof HTMLInputElement) setEditing(true) }}
    onBlurCapture={(event) => { if (event.target instanceof HTMLInputElement) setEditing(false) }}>
    <AmountInput {...props} className={cn("min-w-0 bg-muted/25 p-4", compact && "[&_input]:text-transparent")}
      footer={<div className="grid gap-1.5">
        {balance !== undefined ? <span title={`${formatUnits(balance, props.decimals)} ${typeof props.token === "string" ? props.token : ""}`} className="tabular-nums">
          {balanceLabel} {format(balance)} {props.token}
        </span> : null}
        {footer}
      </div>} />
    {compact ? <span aria-hidden className={cn("pointer-events-none absolute top-[45px] left-[17px] max-w-[calc(100%-7rem)] truncate text-2xl font-medium tabular-nums", invalid && "text-destructive")}>
      {format(amount)}
    </span> : null}
  </div>
}
