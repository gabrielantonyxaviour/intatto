"use client"

import { useId, type ReactNode } from "react"
import { formatUnits } from "viem"
import { CircleAlertIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { formatTokenAmount, parseAmount } from "./format"

export type AmountInputProps = {
  /** The decimal string as typed. Keep it in state as a string; never round-trip it through a number. */
  value: string
  /** Called with the cleaned string and its value in base units (null while empty or incomplete). */
  onChange: (value: string, amount: bigint | null) => void
  decimals: number
  /** Token label shown inside the field, e.g. "NVDAx". */
  token?: ReactNode
  label?: ReactNode
  /** Shown in the footer as "{balanceLabel} {balance} {token}". */
  balance?: bigint
  balanceLabel?: string
  /** Enables the Max button; an amount above it is shown as too large. */
  max?: bigint
  maxLabel?: string
  /** Message shown when the amount exceeds `max`. */
  tooLargeMessage?: string
  /** Marks the value invalid (red value + alert icon) for a reason decided by the caller. */
  invalid?: boolean
  /** Error line under the field; implies invalid. */
  error?: ReactNode
  /** Extra footer content on the left, e.g. a USD value or a consequence line. */
  footer?: ReactNode
  disabled?: boolean
  readOnly?: boolean
  placeholder?: string
  id?: string
  name?: string
  autoFocus?: boolean
  className?: string
}

/** Accepts only a plain decimal with at most `decimals` fraction digits; returns null to reject the keystroke. */
function sanitize(next: string, decimals: number): string | null {
  let v = next.replace(/,/g, ".").replace(/\s/g, "")
  if (v === "") return ""
  if (!/^\d*\.?\d*$/.test(v)) return null
  if (decimals === 0 && v.includes(".")) return null
  if (v.startsWith(".")) v = `0${v}`
  v = v.replace(/^0+(?=\d)/, "")
  const [, fraction = ""] = v.split(".")
  return fraction.length > decimals ? null : v
}

export function AmountInput({
  value,
  onChange,
  decimals,
  token,
  label,
  balance,
  balanceLabel = "Balance",
  max,
  maxLabel = "Max",
  tooLargeMessage,
  invalid,
  error,
  footer,
  disabled,
  readOnly,
  placeholder = "0",
  id,
  name,
  autoFocus,
  className,
}: AmountInputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const messageId = `${inputId}-message`
  const amount = parseAmount(value, decimals)
  const tooLarge = amount !== null && max !== undefined && amount > max
  const isInvalid = Boolean(invalid || error || tooLarge)
  const message =
    error ??
    (tooLarge ? (tooLargeMessage ?? `More than the maximum of ${formatTokenAmount(max, decimals)}.`) : null)
  const interactive = !disabled && !readOnly

  return (
    <div
      data-slot="amount-input"
      data-invalid={isInvalid || undefined}
      className={cn(
        "grid gap-2 rounded-lg border border-input bg-background p-3 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        isInvalid && "border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
        disabled && "opacity-50",
        className,
      )}
    >
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
      ) : null}
      <div className="flex min-w-0 items-center gap-2">
        <input
          id={inputId}
          name={name}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={isInvalid || undefined}
          aria-describedby={message ? messageId : undefined}
          onChange={(e) => {
            const next = sanitize(e.target.value, decimals)
            if (next === null) return
            onChange(next, parseAmount(next, decimals))
          }}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-2xl font-medium tabular-nums outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed",
            isInvalid && "text-destructive",
          )}
        />
        {isInvalid ? <CircleAlertIcon aria-hidden className="size-4 shrink-0 text-destructive" /> : null}
        {token ? <span className="shrink-0 text-sm font-medium text-muted-foreground">{token}</span> : null}
      </div>
      {footer !== undefined || balance !== undefined || max !== undefined ? (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <div className="min-w-0">{footer}</div>
          <div className="flex items-center gap-2">
            {balance !== undefined ? (
              <span className="tabular-nums">
                {balanceLabel} {formatTokenAmount(balance, decimals)}
                {typeof token === "string" ? ` ${token}` : ""}
              </span>
            ) : null}
            {max !== undefined && interactive ? (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => onChange(formatUnits(max, decimals), max)}
              >
                {maxLabel}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {message ? (
        <p id={messageId} className="text-xs text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  )
}
