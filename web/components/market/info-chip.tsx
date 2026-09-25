"use client"

import { useState, type ReactNode } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * A header chip ("Price $226.18") whose explanation opens on hover or focus, and on tap for touch screens
 * (Radix tooltips ignore taps, so a click also opens it).
 */
export function InfoChip({ label, value, children, testId }: { label: string; value: ReactNode; children: ReactNode; testId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-testid={testId}
          onClick={(e) => {
            // Radix closes the tooltip on trigger click; preventDefault skips that so a tap opens it.
            // A tap or click anywhere else (or Escape) closes it.
            e.preventDefault()
            setOpen(true)
          }}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="text-muted-foreground underline decoration-dotted underline-offset-4">{label}</span>
          <span className="truncate font-medium tabular-nums">{value}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent data-testid={`${testId}-tooltip`} className="block max-w-80 leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  )
}
