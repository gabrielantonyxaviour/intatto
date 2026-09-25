"use client"

/** Corporate actions: the pending split or dividend with its pause window, and every post, resolve and clear. */
import type { ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { corporateActionGuardAbi } from "@intatto/config/abi"
import { Badge } from "@/components/ui/badge"
import { ValueChange } from "@/components/ui/web3"
import { useIntatto } from "@/lib/chain"
import { useRisk } from "./risk-data"
import { Check } from "./badges"
import { DataTable } from "./data-table"
import { EventSourceNote } from "./status-bar"
import { Empty, LoadError, Panel, RowsSkeleton, Section, TxRef } from "./states"
import { ago, clock, day, duration, multiplier, pctBps, usd18, utc } from "./format"
import type { ActionEvent } from "./events"

function useGuard(address: Address) {
  const { publicClient, chainId } = useIntatto()
  return useQuery({
    queryKey: ["risk-guard", chainId, address],
    refetchInterval: 15_000,
    queryFn: async () => {
      const read = <T,>(functionName: string) =>
        publicClient.readContract({ address, abi: corporateActionGuardAbi, functionName } as never) as Promise<T>
      const [pending, windowRange, paused, resolvable, current, lastResolved] = await Promise.all([
        read<{ activationAt: bigint; expectedMultiplier: bigint; preActionMultiplier: bigint; preActionPrice: bigint; active: boolean }>("pendingAction"),
        read<readonly [bigint, bigint]>("pauseWindow"),
        read<boolean>("isPaused"),
        read<boolean>("resolvable"),
        read<bigint>("currentMultiplier"),
        read<bigint>("lastResolvedActivation"),
      ])
      return { pending, windowStart: Number(windowRange[0]), paused, resolvable, current, lastResolved: Number(lastResolved) }
    },
  })
}

const EVENT_LABEL: Record<ActionEvent["event"], string> = { posted: "Posted", resolved: "Resolved", cleared: "Cleared" }

export function ActionsView() {
  const { market, rows, logs, senders, params, now } = useRisk()
  const guard = useGuard(market.corporateActionGuard as Address)
  const g = guard.data
  const keeper = params.data?.keeper?.toLowerCase()
  const tolerance = params.data?.guard.toleranceBps

  return (
    <Section
      id="actions"
      title="Corporate actions"
      description={`A split or dividend changes ${market.symbol}'s multiplier. Borrowing and liquidation pause from shortly before activation until a price posted after it agrees with the new multiplier${tolerance !== undefined ? ` (value per share within ${pctBps(tolerance, 0)})` : ""}.`}
    >
      {guard.isError ? <LoadError what="the corporate action guard" error={guard.error} onRetry={() => guard.refetch()} /> : null}
      <Panel title={g?.pending.active ? "Pending action" : "Nothing pending"}>
        {!g ? (
          <RowsSkeleton rows={3} />
        ) : g.pending.active ? (
          <dl className="grid gap-2 text-sm" data-testid="pending-action">
            <Item k="Activation" v={<>{utc(Number(g.pending.activationAt))} ({ago(Number(g.pending.activationAt), now)})</>} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <dt className="text-muted-foreground">Multiplier</dt>
              <dd>
                <ValueChange before={g.pending.preActionMultiplier} after={g.pending.expectedMultiplier} format={(x) => multiplier(BigInt(x))} />
              </dd>
            </div>
            <Item k="Multiplier now" v={multiplier(g.current)} />
            <Item k="Price before the action" v={usd18(g.pending.preActionPrice)} />
            <Item
              k="Pause window"
              v={<>From {utc(g.windowStart)} until a consistent post after {clock(Number(g.pending.activationAt))} UTC</>}
            />
            <Item k="Paused now" v={<Check ok={!g.paused} label={g.paused ? "paused" : "not paused"} />} />
            <Item k="Resolvable" v={<Check ok={g.resolvable} label={g.resolvable ? "yes: anyone can resolve" : "not yet"} />} />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            No split or dividend is scheduled. Multiplier {multiplier(g.current)}
            {g.lastResolved ? `; the last action activated at ${utc(g.lastResolved)}` : ""}.
            {params.data?.guard.window !== undefined ? ` A future one pauses the market ${duration(params.data.guard.window)} before it activates.` : ""}
          </p>
        )}
      </Panel>

      <Panel title="Action history" description={<>ActionPosted, ActionResolved and ActionCleared events. <EventSourceNote /></>}>
        {logs.status === "pending" ? <RowsSkeleton rows={2} /> : null}
        {logs.range && rows.actions.length === 0 ? <Empty>No corporate action events in the scanned blocks.</Empty> : null}
        {rows.actions.length ? (
          <DataTable<ActionEvent>
            label="Corporate action events"
            breakpoint="lg"
            rows={rows.actions}
            rowKey={(r) => `${r.tx}:${r.logIndex}`}
            rowAttrs={(r) => ({ "data-row": "action", "data-event": r.event, "data-tx-hash": r.tx })}
            columns={[
              { id: "event", header: "Event", cardTitle: true, cell: (r) => <Badge variant={r.event === "posted" ? "warning-light" : r.event === "resolved" ? "success-light" : "secondary"}>{EVENT_LABEL[r.event]}</Badge> },
              { id: "time", header: "Mined (UTC)", cell: (r) => `${day(r.time)} ${clock(r.time)}` },
              { id: "activation", header: "Activation (UTC)", cell: (r) => `${day(r.activationAt)} ${clock(r.activationAt)}` },
              {
                id: "multiplier",
                header: "Multiplier",
                cell: (r) =>
                  r.event === "posted" ? `${multiplier(r.preActionMultiplier!)} → ${multiplier(r.expectedMultiplier!)}` : r.newMultiplier !== null ? `now ${multiplier(r.newMultiplier)}` : "–",
              },
              { id: "price", header: "Price", align: "right", cell: (r) => (r.preActionPrice !== null ? `${usd18(r.preActionPrice)} before` : r.postActionPrice !== null ? `${usd18(r.postActionPrice)} after` : "–") },
              {
                id: "by",
                header: "Sent by",
                cell: (r) => {
                  if (r.event === "posted") return "keeper"
                  const from = senders.get(r.tx)?.toLowerCase()
                  return from ? (from === keeper ? "keeper" : <span className="font-mono text-xs">{from.slice(0, 10)}…</span>) : "–"
                },
              },
              { id: "tx", header: "Transaction", cell: (r) => <TxRef hash={r.tx} /> },
            ]}
          />
        ) : null}
      </Panel>
    </Section>
  )
}

function Item({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right tabular-nums">{v}</dd>
    </div>
  )
}
