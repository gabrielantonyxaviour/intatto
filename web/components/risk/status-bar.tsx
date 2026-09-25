"use client"

/** What the console has read (block range, when), the load-older control, and guard / wallet warnings. */
import { useAccount } from "wagmi"
import { Loader2Icon, RotateCwIcon, TriangleAlertIcon } from "lucide-react"
import { REFUSALS } from "@intatto/config/session"
import { useIntatto } from "@/lib/chain"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useRisk } from "./risk-data"
import { eventSourceLabel } from "./use-risk-logs"
import { LoadError } from "./states"
import { blockNo, utc } from "./format"

/** "X Layer" on mainnet, "the sandbox session" on a sandbox. */
export function useDirectPlace(): string {
  const { mode } = useIntatto()
  return mode === "sandbox" ? "the sandbox session" : "X Layer"
}

/** The event source that actually served the rows, once the first chunk has landed. */
export function EventSourceNote() {
  const { logs } = useRisk()
  const text = eventSourceLabel(logs.eventSource)
  if (!text) return null
  return <span data-event-source={logs.eventSource}>{text}.</span>
}

export function ScanStatus() {
  const { logs, now, latestBlock } = useRisk()
  const { mode } = useIntatto()
  if (logs.status === "error" && !logs.range) return <LoadError what="the market's events" error={logs.error} onRetry={logs.refresh} />
  return (
    <div
      data-testid="risk-scan"
      className="flex flex-col gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4"
    >
      {logs.range ? (
        <p className="min-w-0 break-words sm:min-w-72 sm:flex-1">
          Events from blocks <span className="font-mono tabular-nums">{blockNo(logs.range.from)}</span>–
          <span className="font-mono tabular-nums">{blockNo(logs.range.to)}</span>
          {logs.range.from <= logs.floor ? (mode === "sandbox" ? " (from the sandbox deployment)" : " (from the deployment block)") : null}
          {" · "}
          {logs.logs.length.toLocaleString("en-US")} events · chain time {utc(now)}
          {latestBlock !== null ? <> · latest {blockNo(latestBlock)}</> : null}
        </p>
      ) : (
        <Skeleton className="h-4 w-full max-w-72" aria-label="Reading events" />
      )}
      <Button variant="outline" size="sm" className="self-start sm:self-auto" onClick={logs.refresh} disabled={logs.refreshing || logs.status === "pending"}>
        {logs.refreshing ? <Loader2Icon aria-hidden className="animate-spin" /> : <RotateCwIcon aria-hidden />}
        Refresh
      </Button>
      {logs.range && logs.backfilling ? (
        <p className="flex w-full items-center gap-1.5" data-testid="risk-backfill">
          <Loader2Icon aria-hidden className="size-3 shrink-0 animate-spin" />
          Still loading older blocks back to the deployment ({Math.round(logs.progress * 100)}% read); rows appear as they arrive.
        </p>
      ) : null}
      {logs.eventSource ? (
        <p className="w-full min-w-0 break-words" data-testid="event-source">
          {eventSourceLabel(logs.eventSource)}.
        </p>
      ) : null}
      {logs.error && logs.range ? (
        <p className="w-full text-warning-foreground">Reads are being limited; retrying with backoff. Rows read so far stay on screen.</p>
      ) : null}
    </div>
  )
}

/** The frozen-state line: which guard is failing, what it refuses and what stays open. */
export function GuardAlerts() {
  const { marketState, market } = useRisk()
  const s = marketState.data
  if (!s) return null
  const failing: { name: string; text: string }[] = []
  if (s.session === "UNKNOWN") failing.push({ name: "UnknownSession", text: REFUSALS.UnknownSession })
  if (s.session === "HALTED" || s.session === "CORPORATE_ACTION") {
    failing.push({ name: "SessionLimit", text: `The keeper posted the ${s.session} session, whose new-borrow limit is 0%.` })
  }
  if (!s.fresh) failing.push({ name: "StalePrice", text: REFUSALS.StalePrice })
  if (!s.inBand) failing.push({ name: "PriceOutOfBand", text: REFUSALS.PriceOutOfBand })
  if (!s.pegOk) failing.push({ name: "UsdgOffPeg", text: REFUSALS.UsdgOffPeg })
  if (s.corporateActionPaused) failing.push({ name: "CorporateActionPending", text: REFUSALS.CorporateActionPending })
  if (s.issuerPaused) failing.push({ name: "IssuerPaused", text: REFUSALS.IssuerPaused })
  if (!failing.length) return null
  const liquidationPaused =
    s.corporateActionPaused || s.issuerPaused || !s.fresh || s.session === "UNKNOWN" || s.session === "HALTED" || s.session === "CORPORATE_ACTION"
  return (
    <Alert variant="warning" data-testid="guard-alert">
      <TriangleAlertIcon aria-hidden />
      <AlertTitle>
        {failing.length === 1 ? "A guard is failing" : `${failing.length} guards are failing`} on {market.symbol}
      </AlertTitle>
      <AlertDescription>
        <ul className="grid gap-1">
          {failing.map((f) => (
            <li key={f.name} data-guard={f.name}>
              <span className="font-medium text-foreground">{f.name}</span>: {f.text}
            </li>
          ))}
        </ul>
        <p>
          New borrowing is refused while this lasts{liquidationPaused ? " and liquidation waits" : ""}. Repaying and adding collateral stay
          open.
        </p>
      </AlertDescription>
    </Alert>
  )
}

export function WalletNote() {
  const { chain } = useIntatto()
  const where = useDirectPlace()
  const { address, chainId } = useAccount()
  if (!address || chainId === chain.id) return null
  return (
    <Alert data-testid="wrong-network">
      <TriangleAlertIcon aria-hidden />
      <AlertTitle>Your wallet is on another network (chain {chainId})</AlertTitle>
      <AlertDescription>
        <p>
          Contract state is read directly from {where}, not from your wallet&apos;s network, so those figures stay correct. Switch to {chain.name} before you borrow or lend.
        </p>
      </AlertDescription>
    </Alert>
  )
}
