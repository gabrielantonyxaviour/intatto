"use client"

/** What the console has read (block range, when), the load-older control, and guard / wallet warnings. */
import { useAccount } from "wagmi"
import { HistoryIcon, Loader2Icon, RotateCwIcon, TriangleAlertIcon } from "lucide-react"
import { REFUSALS } from "@intatto/config/session"
import { useIntatto } from "@/lib/chain"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useRisk } from "./risk-data"
import { LoadError } from "./states"
import { blockNo, utc } from "./format"
import { SCAN_WINDOW } from "./use-risk-logs"

export function ScanStatus() {
  const { logs, now, latestBlock } = useRisk()
  const { mode } = useIntatto()
  if (logs.status === "error" && !logs.range) return <LoadError what="the market's events" error={logs.error} onRetry={logs.refresh} />
  return (
    <div data-testid="risk-scan" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      {logs.range ? (
        <p className="min-w-0 flex-1">
          Events from blocks <span className="font-mono tabular-nums">{blockNo(logs.range.from)}</span>–
          <span className="font-mono tabular-nums">{blockNo(logs.range.to)}</span>
          {logs.range.from <= logs.floor ? (mode === "sandbox" ? " (from the sandbox deployment)" : " (from the deployment block)") : null}
          {" · "}
          {logs.logs.length.toLocaleString("en-US")} events · chain time {utc(now)}
          {latestBlock !== null ? <> · latest {blockNo(latestBlock)}</> : null}
        </p>
      ) : (
        <Skeleton className="h-4 w-72" aria-label="Scanning events" />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {logs.canLoadOlder ? (
          <Button variant="outline" size="sm" onClick={logs.loadOlder} disabled={logs.loadingOlder}>
            {logs.loadingOlder ? <Loader2Icon aria-hidden className="animate-spin" /> : <HistoryIcon aria-hidden />}
            Load older {Number(SCAN_WINDOW).toLocaleString("en-US")} blocks
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onClick={logs.refresh} disabled={logs.refreshing || logs.status === "pending"}>
          {logs.refreshing ? <Loader2Icon aria-hidden className="animate-spin" /> : <RotateCwIcon aria-hidden />}
          Refresh
        </Button>
      </div>
      {logs.status === "error" && logs.range ? (
        <p className="w-full text-destructive">The last refresh failed; showing the blocks read before it.</p>
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
  const { address, chainId } = useAccount()
  if (!address || chainId === chain.id) return null
  return (
    <Alert data-testid="wrong-network">
      <TriangleAlertIcon aria-hidden />
      <AlertTitle>Your wallet is on another network (chain {chainId})</AlertTitle>
      <AlertDescription>
        <p>
          This console reads {chain.name} directly, so every number here is still correct. Switch to {chain.name} before you borrow or lend.
        </p>
      </AlertDescription>
    </Alert>
  )
}
