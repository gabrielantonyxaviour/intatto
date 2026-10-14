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
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y py-2 text-xs text-muted-foreground"
    >
      {logs.range ? (
        <p className="min-w-0 flex-1" title={`Events ${blockNo(logs.range.from)}–${blockNo(logs.range.to)} · chain time ${utc(now)}${latestBlock !== null ? ` · latest ${blockNo(latestBlock)}` : ""}`}>
          {logs.logs.length.toLocaleString("en-US")} events read
          {logs.range.from <= logs.floor ? (mode === "sandbox" ? " · since this session began" : " · since deployment") : " · partial history"}
        </p>
      ) : (
        <Skeleton className="h-4 w-full max-w-72" aria-label="Reading events" />
      )}
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={logs.refresh} disabled={logs.refreshing || logs.status === "pending"}>
        {logs.refreshing ? <Loader2Icon aria-hidden className="animate-spin" /> : <RotateCwIcon aria-hidden />}
        Refresh
      </Button>
      {logs.range && logs.backfilling ? (
        <p className="flex w-full items-center gap-1.5" data-testid="risk-backfill">
          <Loader2Icon aria-hidden className="size-3 shrink-0 animate-spin" />
          Still loading older blocks ({Math.round(logs.progress * 100)}% read)
        </p>
      ) : null}
      {logs.eventSource ? (
        <details className="w-full min-w-0" data-testid="event-source">
          <summary className="cursor-pointer">Read details</summary>
          <p className="pt-1">{eventSourceLabel(logs.eventSource)}. {logs.range ? `Blocks ${blockNo(logs.range.from)}–${blockNo(logs.range.to)}.` : ""} Chain time {utc(now)}.</p>
        </details>
      ) : null}
      {logs.error && logs.range ? (
        <p className="w-full text-warning-foreground">Reads are being limited; retrying with backoff. Rows read so far stay on screen.</p>
      ) : null}
    </div>
  )
}

const GUARD_SUMMARIES: Record<string, string> = {
  UnknownSession: "Session unavailable · waiting for a keeper update.",
  SessionLimit: "Trading paused · the current session allows no new borrowing.",
  StalePrice: "Price is stale · waiting for a fresh keeper post.",
  PriceOutOfBand: "Price is outside the pool’s permitted band.",
  UsdgOffPeg: "USDG peg check is stale or outside its permitted range.",
  CorporateActionPending: "Corporate action pending · waiting for reconciliation.",
  IssuerPaused: "Issuer paused · borrowing waits for the pause to clear.",
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
            <li key={f.name} data-guard={f.name} title={`${f.name}: ${f.text}`}>
              {GUARD_SUMMARIES[f.name] ?? f.text}
            </li>
          ))}
        </ul>
        <p>
          Borrowing is paused{liquidationPaused ? "; liquidations wait" : ""}. Repayments and collateral deposits stay open.
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
