"use client"

import { useEffect, useState } from "react"
import { CheckIcon, CopyIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ExplorerLink } from "./explorer-link"
import { shortAddress } from "./format"

export type AddressDisplayProps = {
  address: string
  /** Characters kept on each side (default 4). */
  chars?: number
  /** Show a copy button (default true). */
  copy?: boolean
  /** Link the address to the explorer in live mode (default false). */
  explorer?: boolean
  className?: string
}

export function AddressDisplay({ address, chars = 4, copy = true, explorer = false, className }: AddressDisplayProps) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  const text = <span className="font-mono">{shortAddress(address, chars)}</span>
  return (
    <span data-slot="address-display" className={cn("inline-flex items-center gap-1", className)} title={address}>
      {explorer ? <ExplorerLink address={address}>{text}</ExplorerLink> : text}
      {copy ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={copied ? "Address copied" : "Copy address"}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(address)
              setCopied(true)
            } catch {
              setCopied(false)
            }
          }}
        >
          {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
        </Button>
      ) : null}
    </span>
  )
}
