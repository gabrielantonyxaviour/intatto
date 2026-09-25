"use client"

/**
 * The keeper service's own log, for what leaves no transaction (backoffs, skipped cycles). Shown only when
 * NEXT_PUBLIC_KEEPER_LOG_URL is set; the response is validated before anything from it is displayed.
 */
import { useQuery } from "@tanstack/react-query"
import { z } from "zod"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "./data-table"
import { KeeperReading } from "./keeper-reading"
import { Empty, LoadError, Panel, RowsSkeleton, TxRef } from "./states"

// Must stay a literal `process.env.NEXT_PUBLIC_…` read so Next inlines it at build time.
const LOG_URL = process.env.NEXT_PUBLIC_KEEPER_LOG_URL?.trim() || null

const entry = z.object({
  at: z.string().max(64),
  market: z.string().max(16),
  kind: z.string().max(32),
  detail: z.string().max(2_000),
  txHash: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/)
    .optional()
    .nullable(),
})
const payload = z.union([z.array(entry), z.object({ actions: z.array(entry) }), z.object({ log: z.array(entry) }), z.object({ entries: z.array(entry) })])
type Entry = z.infer<typeof entry>

function entries(p: z.infer<typeof payload>): Entry[] {
  if (Array.isArray(p)) return p
  return "actions" in p ? p.actions : "log" in p ? p.log : p.entries
}

export function KeeperServiceLog() {
  const query = useQuery({
    queryKey: ["keeper-service-log", LOG_URL],
    enabled: Boolean(LOG_URL),
    refetchInterval: 60_000,
    queryFn: async () => {
      const res = await fetch(`${LOG_URL!.replace(/\/$/, "")}/log?limit=50`, { headers: { accept: "application/json" } })
      if (!res.ok) throw new Error(`the keeper log answered ${res.status}`)
      const parsed = payload.safeParse(await res.json())
      if (!parsed.success) throw new Error("the keeper log returned an unexpected shape")
      return entries(parsed.data).slice(0, 50)
    },
  })
  if (!LOG_URL) return null
  return (
    <>
      <KeeperReading url={LOG_URL} />
      <Panel title="Keeper service log" description="The keeper's own record of its last 50 steps, including backoffs and skipped cycles that send no transaction.">
        {query.isPending ? <RowsSkeleton rows={3} /> : null}
        {query.isError ? <LoadError what="the keeper service log" error={query.error} onRetry={() => query.refetch()} /> : null}
        {query.data && query.data.length === 0 ? <Empty>The keeper has not logged anything yet.</Empty> : null}
        {query.data?.length ? (
          <DataTable<Entry>
            label="Keeper service log"
            rows={query.data}
            rowKey={(e) => `${e.at}:${e.kind}:${e.detail.slice(0, 40)}`}
            rowAttrs={() => ({ "data-row": "keeper-service" })}
            columns={[
              { id: "kind", header: "Step", cardTitle: true, cell: (e) => <Badge variant={e.kind === "backoff" || e.kind === "price-rejected" ? "warning-light" : "secondary"}>{e.kind}</Badge> },
              { id: "at", header: "At", cell: (e) => e.at.replace("T", " ").slice(0, 19) },
              { id: "market", header: "Market", cell: (e) => e.market },
              { id: "detail", header: "Detail", className: "whitespace-normal", cell: (e) => e.detail },
              { id: "tx", header: "Transaction", cell: (e) => (e.txHash ? <TxRef hash={e.txHash} /> : <span className="text-xs text-muted-foreground">none</span>) },
            ]}
          />
        ) : null}
      </Panel>
    </>
  )
}
