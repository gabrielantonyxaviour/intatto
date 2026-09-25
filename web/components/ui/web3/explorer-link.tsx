"use client"

import type { ReactNode } from "react"
import { ExternalLinkIcon } from "lucide-react"
import { useIntatto } from "@/lib/chain"
import { cn } from "@/lib/utils"
import { shortAddress } from "./format"

export type ExplorerLinkProps = {
  /** A transaction hash. Give either `hash` or `address`. */
  hash?: string
  address?: string
  children?: ReactNode
  className?: string
}

/** Links to OKLink on X Layer mainnet; on a sandbox fork (no explorer) it renders the value as text. */
export function ExplorerLink({ hash, address, children, className }: ExplorerLinkProps) {
  const { explorerTxUrl, explorerAddressUrl } = useIntatto()
  const value = hash ?? address ?? ""
  const url = hash ? explorerTxUrl(hash) : address ? explorerAddressUrl(address) : null
  const content = children ?? <span className="font-mono">{shortAddress(value, hash ? 6 : 4)}</span>
  if (!url) {
    return (
      <span data-slot="explorer-link" className={className} title={value}>
        {content}
      </span>
    )
  }
  return (
    <a
      data-slot="explorer-link"
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      title={value}
      className={cn("inline-flex items-center gap-1 underline-offset-4 hover:underline", className)}
    >
      {content}
      <ExternalLinkIcon aria-hidden className="size-3" />
      <span className="sr-only">(opens OKLink)</span>
    </a>
  )
}
