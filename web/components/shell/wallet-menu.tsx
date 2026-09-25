"use client"

import { useConnect, useDisconnect, type Connector } from "wagmi"
import { toast } from "sonner"
import { ChevronDownIcon } from "lucide-react"
import { OKX_CONNECTOR_ID, useIntatto, type ChainMode } from "@/lib/chain"
import { shortAddress } from "@/components/ui/web3/format"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AddressAvatar } from "./avatar"

function hasWindowProvider(key: "okxwallet" | "ethereum"): boolean {
  return typeof window !== "undefined" && Boolean((window as unknown as Record<string, unknown>)[key])
}

/** OKX Wallet first; the generic injected entry only when no EIP-6963 wallet announced itself. */
function listConnectors(connectors: readonly Connector[]) {
  const okx = connectors.find((c) => c.id === OKX_CONNECTOR_ID)
  const discovered = connectors.filter((c) => c.id !== OKX_CONNECTOR_ID && c.id !== "injected")
  const generic = connectors.find((c) => c.id === "injected")
  const list: { connector: Connector; label: string; available: boolean }[] = []
  if (okx) list.push({ connector: okx, label: "OKX Wallet", available: hasWindowProvider("okxwallet") })
  for (const c of discovered) list.push({ connector: c, label: c.name, available: true })
  if (generic && discovered.length === 0) {
    list.push({ connector: generic, label: "Browser wallet", available: hasWindowProvider("ethereum") })
  }
  return list
}

async function writeText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return
    } catch {
      // A denied async clipboard still allows a selection copy during this click.
    }
  }
  const area = document.createElement("textarea")
  area.value = value
  area.setAttribute("readonly", "")
  area.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0"
  document.body.appendChild(area)
  area.focus()
  area.select()
  const ok = document.execCommand("copy")
  area.remove()
  if (!ok) throw new Error("copy failed")
}

async function copyAddress(address: string) {
  try {
    await writeText(address)
    toast.success("Address copied")
  } catch {
    toast.error("Could not copy the address")
  }
}

/** The same connector list the disconnected control opens, reused by Switch wallet. */
export function ConnectorMenuItems() {
  const { chain } = useIntatto()
  const { connectors, connect } = useConnect()
  return listConnectors(connectors).map(({ connector, label, available }) =>
    available ? (
      <DropdownMenuItem key={connector.uid} onSelect={() => connect({ connector, chainId: chain.id })}>
        {label}
      </DropdownMenuItem>
    ) : connector.id === OKX_CONNECTOR_ID ? (
      <DropdownMenuItem key={connector.uid} asChild>
        <a href="https://web3.okx.com/download" target="_blank" rel="noreferrer noopener">
          OKX Wallet (not installed)
        </a>
      </DropdownMenuItem>
    ) : (
      <DropdownMenuItem key={connector.uid} disabled>
        {label} (none found)
      </DropdownMenuItem>
    ),
  )
}

/**
 * Connected account: avatar and shortened address, not a filled button.
 * Live opens copy, OKLink, switch and disconnect. Sandbox opens copy and end session.
 */
export function ConnectedWallet({
  address,
  mode,
  explorerUrl,
  onEndSandbox,
}: {
  address: string
  mode: ChainMode
  explorerUrl: string | null
  onEndSandbox: () => void
}) {
  const { disconnect } = useDisconnect()
  const short = shortAddress(address)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="wallet-menu"
        aria-label={`Account ${address}`}
        className="inline-flex min-h-9 min-w-0 items-center gap-1.5 rounded-md px-1 py-1 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <AddressAvatar address={address} />
        <span data-testid="wallet-address" className="truncate font-mono text-xs">
          {short}
        </span>
        <ChevronDownIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        collisionPadding={8}
        className="!w-64 !min-w-64 !max-w-[calc(100vw-1.5rem)] !overflow-hidden"
      >
        <DropdownMenuLabel asChild>
          <p
            className="font-mono text-xs font-normal text-muted-foreground"
            style={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
          >
            {address}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void copyAddress(address)}>Copy address</DropdownMenuItem>
        {explorerUrl ? (
          <DropdownMenuItem asChild>
            <a href={explorerUrl} target="_blank" rel="noreferrer noopener">
              View on OKLink
            </a>
          </DropdownMenuItem>
        ) : null}
        {mode === "live" ? (
          <>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Switch wallet</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-60">
                <ConnectorMenuItems />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onSelect={() => disconnect()}>Disconnect</DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onSelect={onEndSandbox}>End sandbox session</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
