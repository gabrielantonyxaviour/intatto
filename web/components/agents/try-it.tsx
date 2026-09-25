"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useAccount } from "wagmi"
import { REFUSALS } from "@intatto/config/session"
import type { CreditReport } from "@/lib/credit/compute"
import { useIntatto, useProtocolParams } from "@/lib/chain"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { EvidenceSheet } from "@/components/ui/ix"
import { creditQuery, curlFor, type CallLog } from "./content"
import { CopyButton } from "./copy-button"
import { GUARD_ORDER, guardIsGood, guardLabel, guardOn } from "./guard-labels"

type Market = "NVDAx" | "SPYx"

function isReport(value: unknown): value is CreditReport {
  return Boolean(value && typeof value === "object" && (value as { service?: string }).service === "intatto-credit")
}

export function TryIt({ onCall }: { onCall: (entry: CallLog) => void }) {
  const { mode, sandbox } = useIntatto()
  const { address } = useAccount()
  const [wallet, setWallet] = useState("")
  const [touched, setTouched] = useState(false)
  const [market, setMarket] = useState<Market>("NVDAx")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<CreditReport | null>(null)

  useEffect(() => {
    if (!touched && address) setWallet(address)
  }, [address, touched])

  const network = mode === "sandbox" ? "sandbox" : "mainnet"
  const session = mode === "sandbox" ? sandbox?.sessionId : undefined
  const path = wallet.trim() ? creditQuery({ wallet: wallet.trim(), market, network, session }) : ""

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = wallet.trim()
    if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
      setError("Enter a 0x wallet address (40 hex characters).")
      setReport(null)
      return
    }
    setPending(true)
    setError(null)
    try {
      const res = await fetch(creditQuery({ wallet: trimmed, market, network, session }))
      const body: unknown = await res.json().catch(() => null)
      if (isReport(body)) {
        setReport(body)
        onCall({ at: new Date().toISOString(), wallet: trimmed, market })
        return
      }
      const message =
        body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
          ? (body as { error: string; code?: string }).error
          : "The credit service did not return a report."
      const code = body && typeof body === "object" && typeof (body as { code?: unknown }).code === "string"
        ? ` (${(body as { code: string }).code})`
        : ""
      setReport(null)
      setError(`${message}${code}`)
    } catch {
      setReport(null)
      setError("The credit service did not answer. Try again in a moment.")
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="grid min-w-0 gap-4">
      <h2 className="text-lg font-medium">Try it</h2>
      <form className="grid gap-3" onSubmit={onSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="credit-wallet">Wallet</Label>
            <Input
              id="credit-wallet"
              value={wallet}
              spellCheck={false}
              autoComplete="off"
              placeholder="0x…"
              onChange={(e) => {
                setTouched(true)
                setWallet(e.target.value)
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="credit-market">Market</Label>
            <Select value={market} onValueChange={(v) => setMarket(v === "SPYx" ? "SPYx" : "NVDAx")}>
              <SelectTrigger id="credit-market" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NVDAx">NVDAx</SelectItem>
                <SelectItem value="SPYx">SPYx</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Calls this app&apos;s /api/credit on {network}
          {session ? ` for sandbox session ${session}` : ""}.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending} aria-busy={pending}>
            Try it
          </Button>
          {path ? <CopyButton value={curlFor(`${window.location.origin}${path}`)} label="Copy curl for this call" /> : null}
        </div>
      </form>

      {pending ? (
        <div className="grid gap-2" data-testid="credit-loading" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>The call did not return a report</AlertTitle>
          <AlertDescription data-testid="credit-error">{error}</AlertDescription>
        </Alert>
      ) : null}

      {!pending && !error && !report ? (
        <p className="text-sm text-muted-foreground">No call yet. Run Try it to read this wallet.</p>
      ) : null}

      {report ? <ReportView report={report} /> : null}
    </section>
  )
}

function Field({ label, testId, value }: { label: string; testId: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-lg border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span data-testid={testId} className="font-mono text-sm break-all">
        {value}
      </span>
    </div>
  )
}

function ReportView({ report }: { report: CreditReport }) {
  const params = useProtocolParams(report.market)
  const bounds = params.status === "success" ? params.data : undefined
  const reason = report.capacity.reason
  const json = JSON.stringify(report, null, 2)
  return (
    <div className="grid min-w-0 gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Session" testId="credit-session" value={report.session.state} />
        <Field label="Debt (USDG)" testId="credit-debt" value={report.position.debtUsdg} />
        <Field label="Capacity now (USDG)" testId="credit-capacity" value={report.capacity.borrowableNowUsdg} />
      </div>
      {reason ? (
        <Alert variant="warning">
          <AlertTitle>New borrowing is refused</AlertTitle>
          <AlertDescription>
            {reason}: {REFUSALS[reason]}
          </AlertDescription>
        </Alert>
      ) : null}
      <EvidenceSheet
        title="Response details"
        triggerLabel="Response details"
        summary={`${report.market} credit report on ${report.network}`}
        asOf={`Block ${report.block} · ${report.asOf}`}
        state="ready"
        evidenceFor="credit-response"
        testId="response-details"
      >
        <div className="grid min-w-0 gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Max new-borrow LTV (bps)" testId="credit-ltv" value={String(report.session.maxNewBorrowLtvBps)} />
            <Field label="Price (USD per token)" testId="credit-price" value={report.price.usdPerToken ?? "none"} />
            <Field label="Fetched by the keeper at" testId="credit-fetched" value={report.price.fetchedAt ?? "none"} />
            <Field label="Liquidation price (USD per token)" testId="credit-liq-price" value={report.liquidation.liquidationPriceUsd ?? "none"} />
            <Field
              label="Gap to liquidation (bps)"
              testId="credit-gap"
              value={report.liquidation.gapToLiquidationBps === null ? "none" : String(report.liquidation.gapToLiquidationBps)}
            />
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Price source</span>
            <p data-testid="credit-source" className="text-sm">
              {report.price.source}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {GUARD_ORDER.map((key) => {
              const on = guardOn(report.guards, key)
              return (
                <Badge key={key} variant={guardIsGood(key, on) ? "success-light" : "warning-light"}>
                  {guardLabel(key, bounds)}: {on ? "yes" : "no"}
                </Badge>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {bounds
              ? `Freshness, pool band and peg limits read from the price relay at block ${bounds.blockNumber}.`
              : "Freshness, pool band and peg limits are omitted until the price relay read succeeds."}
          </p>
          <pre className="max-w-full overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre-wrap break-all" data-testid="credit-json">
            {json}
          </pre>
          <CopyButton value={json} label="Copy response JSON" />
        </div>
      </EvidenceSheet>
    </div>
  )
}
