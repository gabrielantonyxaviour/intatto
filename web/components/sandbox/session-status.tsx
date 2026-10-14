"use client"

import Link from "next/link"
import { useAccount, useConnect } from "wagmi"
import type { Address } from "viem"
import { ArrowRightIcon, LogOutIcon } from "lucide-react"
import { FORK_FUNDING_HOLDER } from "@intatto/config/xlayer"
import type { Session } from "@intatto/config/session"
import { BURNER_CONNECTOR_ID, useIntatto, useMarketState } from "@/lib/chain"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { AddressDisplay, TokenAmount } from "@/components/ui/web3"
import { formatNumber, formatUtc } from "@/components/ui/web3/format"
import { SCREENS, SESSION_LIMIT, SESSION_TONE } from "./copy"
import { RelativeTime } from "./display"
import { useBurnerBalances, useLatestBlock, useSandboxCardRefresh } from "./use-sandbox"

const BADGE = { success: "success-light", info: "info-light", warning: "warning-light", destructive: "destructive-light" } as const

export function SessionBadge({ session }: { session: Session }) {
  return (
    <Badge variant={BADGE[SESSION_TONE[session]]} size="lg" data-testid="market-session" data-session={session}>
      {session}
    </Badge>
  )
}


/** Chain clock and the market session in force, read from the fork (block header and MarketLens). */
function ChainClock() {
  const block = useLatestBlock()
  const market = useMarketState("NVDAx")
  const session = market.data ? market.data.session : null
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
      <div className="col-span-2 grid gap-1">
        <dt className="text-muted-foreground">Chain time</dt>
        <dd data-testid="chain-time" className="tabular-nums">
          {block.data ? (
            <time className="text-lg font-medium" title={formatUtc(block.data.timestamp)} dateTime={new Date(Number(block.data.timestamp) * 1000).toISOString()}>
              {new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false }).format(new Date(Number(block.data.timestamp) * 1000))} UTC
            </time>
          ) : block.isError ? (
            <span className="text-destructive">unavailable</span>
          ) : (
            <Skeleton className="h-4 w-48" />
          )}
        </dd>
      </div>
      <div className="col-span-2 text-xs text-muted-foreground">
        <dt className="sr-only">Latest block</dt>
        <dd><details>
          <summary className="cursor-pointer">Block details</summary>
          <span data-testid="chain-block" className="mt-2 block font-mono tabular-nums">
            {block.data ? formatNumber(block.data.number ?? 0n) : block.isError ? "–" : <Skeleton className="h-4 w-24" />}
          </span>
        </details></dd>
      </div>
      <div className="col-span-2 grid gap-1">
        <dt className="sr-only">Market session</dt>
        <dd className="flex flex-wrap items-center gap-1.5">
          {session ? (
            <>
              <SessionBadge session={session} />
              <span className="text-xs text-muted-foreground">{SESSION_LIMIT[session]}</span>
            </>
          ) : market.isError ? (
            <span className="text-destructive">unavailable</span>
          ) : (
            <Skeleton className="h-5 w-20" />
          )}
        </dd>
      </div>
    </dl>
  )
}

const TOKENS = [
  { symbol: "NVDAx", decimals: 18, digits: 4 },
  { symbol: "SPYx", decimals: 18, digits: 4 },
  { symbol: "USDG", decimals: 6, digits: 2 },
  { symbol: "OKB", decimals: 18, digits: 4 },
] as const

function Balances({ address }: { address: Address }) {
  const balances = useBurnerBalances(address)
  return (
    <dl className="grid divide-y text-sm" aria-busy={balances.isPending}>
      {TOKENS.map((t) => (
        <div key={t.symbol} className="flex items-baseline justify-between gap-2 py-2.5">
          <dt className="text-muted-foreground">{t.symbol}</dt>
          <dd data-testid={`balance-${t.symbol}`}>
            {balances.data ? (
              <TokenAmount value={balances.data[t.symbol]} decimals={t.decimals} maxFractionDigits={t.digits} minFractionDigits={t.symbol === "USDG" ? 2 : 0} />
            ) : balances.isError ? (
              <span className="text-destructive">–</span>
            ) : (
              <Skeleton className="h-4 w-12" />
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** The burner the session funded and the chain state it now sees, with the screens that run on it. */
export function SessionStatus({ burner, lastActiveAt, idleMinutes, stopped = false }: { burner: Address; lastActiveAt?: string; idleMinutes?: number; stopped?: boolean }) {
  useSandboxCardRefresh(!stopped)
  const { endSandbox } = useIntatto()
  const { status, address } = useAccount()
  const { connect, connectors } = useConnect()
  const connected = status === "connected" && address?.toLowerCase() === burner.toLowerCase()
  const burnerConnector = connectors.find((c) => c.id === BURNER_CONNECTOR_ID)
  return (
    <Card data-testid="sandbox-session">
      <CardHeader>
        <CardTitle>
          <h2>Your session</h2>
        </CardTitle>
        <CardDescription>
          {stopped
            ? "This session's fork has stopped, so there is no chain time or balance to read. Start a new session to continue."
            : "Your test wallet works across every page."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {stopped ? null : (
          <>
            <ChainClock />
            <Separator />
          </>
        )}
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">Burner wallet</span>
            <AddressDisplay address={burner} chars={6} className="text-sm" />
          </div>
          <p data-testid="burner-connection" className="text-xs text-muted-foreground">
            {stopped ? (
              "Its fork has stopped; the key is useless now."
            ) : connected ? (
              "Connected · key stored only in this browser."
            ) : status === "connecting" || status === "reconnecting" ? (
              "Connecting the burner…"
            ) : (
              <>
                Not connected.{" "}
                {burnerConnector ? (
                  <Button variant="link" size="xs" className="h-auto p-0" onClick={() => connect({ connector: burnerConnector })}>
                    Connect the burner
                  </Button>
                ) : null}
              </>
            )}
          </p>
          {stopped ? null : <Balances address={burner} />}
          <p className="text-xs text-muted-foreground" data-testid="seed-balances">
            Seeded funds, transferred from{" "}
            <span className="font-mono" title={FORK_FUNDING_HOLDER}>
              {FORK_FUNDING_HOLDER.slice(0, 6)}…{FORK_FUNDING_HOLDER.slice(-4)}
            </span>
            , not minted. See the ledger for transfers.
          </p>
        </div>
        {stopped ? null : <Separator />}
        {stopped ? null : (
          <nav aria-label="Screens on this fork" className="flex flex-wrap gap-2">
              {[SCREENS.borrow, SCREENS.lend, { href: "/risk", label: "Risk" }, { href: "/sandbox/explorer", label: "Explorer" }, { href: "/sandbox/proof", label: "Fork proof" }].map((s) => (
                <Button key={s.href} asChild variant="ghost" size="sm">
                  <Link href={s.href}>
                    {s.label}
                    <ArrowRightIcon aria-hidden />
                  </Link>
                </Button>
              ))}
          </nav>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {stopped ? "Stopped" : `Expires after ${idleMinutes ?? 30} idle minutes`}
          {lastActiveAt ? <> · active <RelativeTime timestamp={Date.parse(lastActiveAt) / 1000} /></> : null}
        </span>
        <Button variant="outline" size="sm" onClick={endSandbox}>
          <LogOutIcon aria-hidden />
          End session
        </Button>
      </CardFooter>
    </Card>
  )
}

