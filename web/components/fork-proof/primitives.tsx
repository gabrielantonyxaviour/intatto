"use client"

import { useEffect, useState, type ReactNode } from "react"
import { CheckIcon, CircleAlertIcon, CircleCheckIcon, CircleMinusIcon, CircleXIcon, CopyIcon, EllipsisIcon, UnplugIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { CheckStatus } from "./types"

const STATUS: Record<CheckStatus, { icon: typeof CheckIcon; word: string; tone: string }> = {
  running: { icon: EllipsisIcon, word: "running", tone: "text-muted-foreground" },
  pass: { icon: CircleCheckIcon, word: "passed", tone: "text-success-foreground" },
  fail: { icon: CircleXIcon, word: "failed", tone: "text-destructive" },
  unreachable: { icon: UnplugIcon, word: "RPC unreachable", tone: "text-warning-foreground" },
  refused: { icon: CircleAlertIcon, word: "RPC refused a read", tone: "text-warning-foreground" },
  skipped: { icon: CircleMinusIcon, word: "not run", tone: "text-muted-foreground" },
}

export function StatusMark({ status, className }: { status: CheckStatus; className?: string }) {
  const s = STATUS[status]
  const Icon = s.icon
  return (
    <span data-slot="status-mark" className={cn("inline-flex items-center gap-1 text-sm font-medium", s.tone, className)}>
      <Icon aria-hidden className="size-4 shrink-0" />
      {s.word}
    </span>
  )
}

/** An equal / differs marker for one evidence row. */
export function RowMark({ equal, label }: { equal: boolean; label?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 text-xs font-medium", equal ? "text-success-foreground" : "text-destructive")}>
      {equal ? <CircleCheckIcon aria-hidden className="size-3.5" /> : <CircleXIcon aria-hidden className="size-3.5" />}
      {label ?? (equal ? "equal" : "differs")}
    </span>
  )
}

/** A hash, address or word shown in full and wrapped, never truncated. */
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <code className={cn("font-mono text-xs break-all", className)}>{children}</code>
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
        } catch {
          setCopied(false)
        }
      }}
    >
      {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
    </Button>
  )
}

/** One or more shell lines in a wrapped block with a copy button. */
export function CommandBlock({ lines, label }: { lines: string[]; label: string }) {
  const text = lines.join("\n")
  return (
    <div data-slot="command-block" className="relative rounded-md border bg-muted/50">
      <pre className="overflow-hidden py-2 pr-9 pl-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">{text}</pre>
      <div className="absolute top-1 right-1">
        <CopyButton text={text} label={label} />
      </div>
    </div>
  )
}

/** A labelled value in a stack that becomes two columns on wider screens. */
export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-xs text-muted-foreground sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  )
}

/**
 * Seatbelt-style evidence for one compared value: a single "=" line when both sides agree, otherwise the X Layer
 * value as the old line (red, "−") and the sandbox value as the new line (green, "+").
 */
export function DiffLines({
  equal,
  oldLabel,
  newLabel,
  oldValue,
  newValue,
  oldShown,
  newShown,
}: {
  equal: boolean
  oldLabel: string
  newLabel: string
  oldValue: string
  newValue: string
  oldShown?: string
  newShown?: string
}) {
  if (equal) {
    return (
      <div className="grid gap-0.5 rounded-md bg-muted/50 px-2 py-1.5" data-diff="equal">
        <p className="text-xs text-muted-foreground">
          = on both ({oldLabel}; {newLabel})
        </p>
        <Mono>{oldValue}</Mono>
        {oldShown && oldShown !== oldValue ? <p className="text-xs text-muted-foreground">{oldShown}</p> : null}
      </div>
    )
  }
  return (
    <div className="grid overflow-hidden rounded-md" data-diff="changed">
      <div className="grid gap-0.5 bg-destructive/10 px-2 py-1.5 text-destructive" data-side="old">
        <p className="text-xs">− {oldLabel}</p>
        <Mono>{oldValue}</Mono>
        {oldShown && oldShown !== oldValue ? <p className="text-xs">{oldShown}</p> : null}
      </div>
      <div className="grid gap-0.5 bg-success/10 px-2 py-1.5 text-success-foreground" data-side="new">
        <p className="text-xs">+ {newLabel}</p>
        <Mono>{newValue}</Mono>
        {newShown && newShown !== newValue ? <p className="text-xs">{newShown}</p> : null}
      </div>
    </div>
  )
}
