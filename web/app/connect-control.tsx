"use client"

import { useAccount, useConnect, useDisconnect, useSwitchChain, type Connector } from "wagmi"
import { toast } from "sonner"
import { ChevronDownIcon, Loader2Icon, TriangleAlertIcon, WalletIcon } from "lucide-react"
import { OKX_CONNECTOR_ID, useIntatto } from "@/lib/chain"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { shortAddress } from "@/components/ui/web3/format"

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

function AccountButton({ caption, address }: { caption: string; address: string }) {
  return (
    <Button variant="outline" className="h-9 gap-2 px-2.5" aria-label={`${caption} ${address}`}>
      <span className="grid text-left leading-tight">
        <span className="text-[10px] text-muted-foreground">{caption}</span>
        <span className="font-mono text-xs">{shortAddress(address)}</span>
      </span>
      <ChevronDownIcon aria-hidden className="text-muted-foreground" />
    </Button>
  )
}

async function copy(address: string) {
  try {
    await navigator.clipboard.writeText(address)
    toast.success("Address copied")
  } catch {
    toast.error("Could not copy the address")
  }
}

/** Wallet state for the active chain: burner in sandbox mode, OKX / injected wallets on X Layer. */
export function ConnectControl() {
  const { hydrated } = useIntatto()
  // wagmi is mounted only after hydration, so its hooks live in the inner component.
  return hydrated ? <WalletControl /> : <Skeleton className="h-9 w-32" />
}

function WalletControl() {
  const { mode, chain, endSandbox, explorerAddressUrl } = useIntatto()
  const { address, chainId, status } = useAccount()
  const { connectors, connect, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: switching } = useSwitchChain()

  if (status === "connecting" || status === "reconnecting" || isPending) {
    return (
      <Button variant="outline" className="h-9" disabled>
        <Loader2Icon className="animate-spin" aria-hidden />
        {mode === "sandbox" ? "Connecting burner…" : "Connecting…"}
      </Button>
    )
  }

  if (mode === "sandbox") {
    if (!address) {
      return (
        <Button className="h-9" onClick={() => connectors[0] && connect({ connector: connectors[0], chainId: chain.id })}>
          Connect burner
        </Button>
      )
    }
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <AccountButton caption="Sandbox burner" address={address} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="grid gap-0.5">
            <span>Sandbox burner</span>
            <span className="font-mono text-xs font-normal break-all text-muted-foreground">{address}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void copy(address)}>Copy address</DropdownMenuItem>
          <DropdownMenuItem onSelect={endSandbox}>Exit sandbox</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (!address) {
    const options = listConnectors(connectors)
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="h-9">
            <WalletIcon aria-hidden />
            <span className="hidden sm:inline">Connect wallet</span>
            <span className="sm:hidden">Connect</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>Connect on {chain.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map(({ connector, label, available }) =>
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
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const wrongNetwork = chainId !== chain.id
  const explorer = explorerAddressUrl(address)
  return (
    <div className="flex items-center gap-2">
      {wrongNetwork ? (
        <Button
          variant="destructive"
          className="h-9"
          disabled={switching}
          onClick={() => switchChain({ chainId: chain.id })}
          aria-label={`Wrong network. Switch to ${chain.name}`}
        >
          {switching ? <Loader2Icon className="animate-spin" aria-hidden /> : <TriangleAlertIcon aria-hidden />}
          <span className="hidden sm:inline">Wrong network ·</span> Switch
          <span className="hidden md:inline"> to {chain.name}</span>
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <AccountButton caption={wrongNetwork ? "Wrong network" : chain.name} address={address} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="grid gap-0.5">
            <span>{wrongNetwork ? `Connected to chain ${chainId}` : chain.name}</span>
            <span className="font-mono text-xs font-normal break-all text-muted-foreground">{address}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void copy(address)}>Copy address</DropdownMenuItem>
          {explorer ? (
            <DropdownMenuItem asChild>
              <a href={explorer} target="_blank" rel="noreferrer noopener">
                View on OKLink
              </a>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => disconnect()}>Disconnect</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
