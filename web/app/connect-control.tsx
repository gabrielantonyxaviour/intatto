"use client"

import { useAccount, useConnect, useSwitchChain } from "wagmi"
import { Loader2Icon, TriangleAlertIcon, WalletIcon } from "lucide-react"
import { useIntatto } from "@/lib/chain"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConnectedWallet, ConnectorMenuItems } from "@/components/shell/wallet-menu"

/** Wallet state for the active chain: burner in sandbox mode, OKX / injected wallets on X Layer. */
export function ConnectControl() {
  const { hydrated } = useIntatto()
  return hydrated ? <WalletControl /> : <Skeleton className="h-9 w-28 shrink-0" />
}

function WalletControl() {
  const { mode, chain, endSandbox, explorerAddressUrl } = useIntatto()
  const { address, chainId, status } = useAccount()
  const { connectors, connect, isPending } = useConnect()
  const { switchChain, isPending: switching } = useSwitchChain()

  if (status === "connecting" || status === "reconnecting" || isPending) {
    return (
      <Button variant="outline" className="h-9" disabled>
        <Loader2Icon className="animate-spin" aria-hidden />
        <span className="hidden sm:inline">{mode === "sandbox" ? "Connecting burner…" : "Connecting…"}</span>
        <span className="sm:hidden">Connecting…</span>
      </Button>
    )
  }

  if (mode === "sandbox" && !address) {
    return (
      <Button className="h-9" onClick={() => connectors[0] && connect({ connector: connectors[0], chainId: chain.id })}>
        Connect burner
      </Button>
    )
  }

  if (!address) {
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
          <DropdownMenuLabel>Connect a wallet</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <ConnectorMenuItems />
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const wrongNetwork = chainId !== chain.id
  return (
    <div className="flex min-w-0 items-center gap-2">
      {wrongNetwork ? (
        <Button
          variant="destructive"
          className="h-9 shrink-0"
          disabled={switching}
          onClick={() => switchChain({ chainId: chain.id })}
          aria-label={`Wrong network. Switch to ${chain.name}`}
        >
          {switching ? <Loader2Icon className="animate-spin" aria-hidden /> : <TriangleAlertIcon aria-hidden />}
          <span className="hidden sm:inline">Wrong network ·</span> Switch
          <span className="hidden md:inline"> to {chain.name}</span>
        </Button>
      ) : null}
      <ConnectedWallet
        address={address}
        mode={mode}
        explorerUrl={mode === "live" ? explorerAddressUrl(address) : null}
        onEndSandbox={endSandbox}
      />
    </div>
  )
}
