"use client"

/** Keeper log: who the keeper is, and every onchain action it sent, merged newest first, each with its transaction. */
import { useMemo, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AddressDisplay } from "@/components/ui/web3"
import { shortAddress } from "@/components/ui/web3/format"
import { useRisk, type RiskData } from "./risk-data"
import { DataTable } from "./data-table"
import { Empty, LoadError, Panel, RowsSkeleton, Section, TxRef } from "./states"
import { EventSourceNote } from "./status-bar"
import { KeeperServiceLog } from "./keeper-service-log"
import { clock, day, multiplier, usd18, usdg, utc } from "./format"

const KINDS = ["price", "session", "cap", "action", "liquidation"] as const
type Kind = (typeof KINDS)[number]
const KIND_LABEL: Record<Kind, string> = { price: "Price", session: "Session", cap: "Cap", action: "Corporate action", liquidation: "Liquidation" }

export type KeeperEntry = { key: string; tx: string; block: bigint; logIndex: number; time: number | null; kind: Kind; warn: boolean; text: string }

/** Every keeper-sent event. Posts are keeper-only onchain; permissionless calls count when the keeper sent them. */
export function keeperEntries({ rows, senders }: Pick<RiskData, "rows" | "senders">, keeper: string | undefined): KeeperEntry[] {
  const k = keeper?.toLowerCase()
  const byKeeper = (tx: string) => Boolean(k) && senders.get(tx)?.toLowerCase() === k
  const out: KeeperEntry[] = []
  const add = (r: { tx: string; block: bigint; logIndex: number; time: number | null }, kind: Kind, text: string, warn = false) =>
    out.push({ key: `${r.tx}:${r.logIndex}`, tx: r.tx, block: r.block, logIndex: r.logIndex, time: r.time, kind, warn, text })
  for (const p of rows.prices) {
    add(p, "price", p.accepted ? `Posted price ${usd18(p.quoteE18)}: accepted` : `Posted price ${usd18(p.quoteE18)}: rejected (${p.reason ?? "unknown"})`, !p.accepted)
  }
  for (const s of rows.sessions) add(s, "session", `Posted session ${s.session} (period began ${utc(s.periodChangedAt)})`)
  for (const c of rows.caps) add(c, "cap", `Posted cap target ${usdg(c.targetUsdg)}, slice ${usdg(c.sliceUsdg)}; cap now ${usdg(c.effectiveUsdg)}`)
  for (const a of rows.actions) {
    if (a.event === "posted") add(a, "action", `Posted corporate action: ${multiplier(a.preActionMultiplier!)} → ${multiplier(a.expectedMultiplier!)} at ${utc(a.activationAt)}`, true)
    else if (byKeeper(a.tx)) add(a, "action", a.event === "resolved" ? "Resolved the corporate action pause" : "Cleared the pending corporate action")
  }
  for (const s of rows.slices) {
    const sent = s.executed ? Boolean(k) && s.settlement?.keeper.toLowerCase() === k : byKeeper(s.tx)
    if (!sent) continue
    add(s, "liquidation", s.executed ? `Liquidation slice for ${shortAddress(s.borrower)}: ${usdg(s.proceeds ?? 0n)} proceeds` : `Liquidation slice for ${shortAddress(s.borrower)} waiting at its floor`, true)
  }
  return out.sort((x, y) => (x.block === y.block ? y.logIndex - x.logIndex : x.block > y.block ? -1 : 1))
}

export function KeeperLogView() {
  const data = useRisk()
  const { params, logs, deployment } = data
  const [kind, setKind] = useState<"all" | Kind>("all")
  const keeper = params.data?.keeper ?? (deployment.keeper as `0x${string}`)
  const all = useMemo(() => keeperEntries(data, keeper), [data, keeper])
  const shown = all.filter((e) => kind === "all" || e.kind === kind)

  return (
    <Section
      id="keeper"
      title="Keeper log"
      description={
        <>
          The keeper is Intatto&apos;s agent: an off-chain service that relays the issuer&apos;s quote and the market session, samples pool depth and runs liquidations. The onchain actions below are event history. <EventSourceNote /> The keeper service log and last issuer read, when shown, come from the keeper service.
        </>
      }
    >
      <Panel title="Keeper identity">
        <dl className="grid gap-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-6">
          <dt className="text-muted-foreground">Keeper address</dt>
          <dd className="min-w-0">
            <AddressDisplay address={keeper} explorer />
          </dd>
          <dt className="text-muted-foreground">Actions read</dt>
          <dd className="tabular-nums" data-testid="keeper-count">
            {all.length.toLocaleString("en-US")} in the scanned blocks · {all.filter((e) => e.kind === "price" && e.warn).length} price posts rejected by the relay
          </dd>
          <dt className="text-muted-foreground">Agent profile</dt>
          <dd>
            <Link href="/agents" className="underline underline-offset-4">
              See the keeper&apos;s agent identity
            </Link>
          </dd>
        </dl>
      </Panel>
      <Tabs value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
        <TabsList aria-label="Filter keeper actions" className="h-auto flex-wrap">
          <TabsTrigger value="all">All {all.length}</TabsTrigger>
          {KINDS.map((k) => (
            <TabsTrigger key={k} value={k}>
              {KIND_LABEL[k]} {all.filter((e) => e.kind === k).length}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {logs.status === "pending" ? <RowsSkeleton rows={5} label="Loading keeper actions" /> : null}
      {logs.status === "error" && !logs.range ? <LoadError what="the keeper's actions" error={logs.error} onRetry={logs.refresh} /> : null}
      {logs.range && shown.length === 0 ? <Empty>No keeper actions of this kind in the scanned blocks.</Empty> : null}
      {shown.length ? (
        <DataTable<KeeperEntry>
          label="Keeper actions"
          rows={shown}
          rowKey={(e) => e.key}
          rowAttrs={(e) => ({ "data-row": "keeper-action", "data-kind": e.kind, "data-tx-hash": e.tx })}
          columns={[
            { id: "kind", header: "Action", cardTitle: true, cell: (e) => <Badge variant={e.warn ? "warning-light" : "secondary"}>{KIND_LABEL[e.kind]}</Badge> },
            { id: "time", header: "Mined (UTC)", cell: (e) => `${day(e.time)} ${clock(e.time)}` },
            { id: "text", header: "What it did", className: "whitespace-normal", cell: (e) => e.text },
            { id: "tx", header: "Transaction", cell: (e) => <TxRef hash={e.tx} /> },
          ]}
        />
      ) : null}
      <KeeperServiceLog />
    </Section>
  )
}
