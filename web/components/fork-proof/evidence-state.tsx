"use client"

import type { ReactNode } from "react"
import { formatNumber } from "@/components/ui/web3/format"
import type { ExplainedRow, StateEvidence, ValueRow, Verdict } from "./check-state"
import { DiffLines, Mono, RowMark } from "./primitives"

function RowHead({ row, mark }: { row: ValueRow; mark: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm">
          <span className="font-medium">{row.contract}</span> · <Mono>{row.what}</Mono>
          {row.note ? <span className="text-muted-foreground"> · {row.note}</span> : null}
        </p>
        <Mono className="text-muted-foreground">{row.address}</Mono>
      </div>
      {mark}
    </div>
  )
}

function Group({ title, note, children }: { title: string; note: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{note}</p>
      </div>
      <ul className="grid gap-3">{children}</ul>
    </section>
  )
}

function ValueItem({ row, oldLabel, newLabel }: { row: ValueRow; oldLabel: string; newLabel: string }) {
  return (
    <li data-row={row.id} data-equal={row.equal} className="grid gap-2 rounded-lg border p-3">
      <RowHead row={row} mark={<RowMark equal={row.equal} />} />
      <DiffLines
        equal={row.equal}
        oldLabel={oldLabel}
        newLabel={newLabel}
        oldValue={row.reference.raw}
        newValue={row.sandbox.raw}
        oldShown={row.reference.shown}
        newShown={row.sandbox.shown}
      />
    </li>
  )
}

const VERDICT: Record<Verdict, { text: string; ok: boolean }> = {
  unchanged: { text: "unchanged since the fork", ok: true },
  explained: { text: "changed, explained by the ledger", ok: true },
  expected: { text: "changed by sandbox transactions", ok: true },
  unexplained: { text: "changed, and no ledger entry explains it", ok: false },
  "no-ledger": { text: "changed; no ledger here to explain it", ok: true },
}

function ExplainedItem({ row, forkBlock }: { row: ExplainedRow; forkBlock: bigint }) {
  const v = VERDICT[row.verdict]
  return (
    <li data-row={row.id} data-verdict={row.verdict} className="grid gap-2 rounded-lg border p-3">
      <RowHead row={row} mark={<RowMark equal={v.ok} label={v.text} />} />
      <p className="text-xs text-muted-foreground">{row.why}</p>
      <DiffLines
        equal={row.equal}
        oldLabel={`X Layer, block ${formatNumber(forkBlock)}`}
        newLabel="Sandbox now"
        oldValue={row.reference.raw}
        newValue={row.sandbox.raw}
        oldShown={row.reference.shown}
        newShown={row.sandbox.shown}
      />
      {row.explanations.length > 0 ? (
        <ul className="grid gap-1 text-xs text-muted-foreground">
          {row.explanations.map((e, i) => (
            <li key={i}>Ledger: {e.summary}</li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/** Check 3 evidence, in its three parts. */
export function StateEvidenceView({ e, forkBlock }: { e: StateEvidence; forkBlock: bigint }) {
  const at = `block ${formatNumber(forkBlock)}`
  return (
    <div className="grid gap-5">
      <Group
        title={`a. State at the fork block (${e.atFork.length} reads)`}
        note={`Contract calls and raw storage words, read at ${at} on both RPCs.`}
      >
        {e.atFork.map((row) => (
          <ValueItem key={row.id} row={row} oldLabel={`X Layer, ${at}`} newLabel={`Sandbox, ${at}`} />
        ))}
      </Group>
      <Group
        title={`b. Unchanged since the fork (${e.untouched.length} slots)`}
        note={`Storage no sandbox action writes (proxy implementations and admins, total supplies, since the sandbox moves balances but never mints, and the feed's aggregator and owner), read on the sandbox now and on X Layer at ${at}. A difference means the sandbox state was edited outside the recorded actions.`}
      >
        {e.untouched.map((row) => (
          <ValueItem key={row.id} row={row} oldLabel={`X Layer, ${at}`} newLabel="Sandbox now" />
        ))}
      </Group>
      <Group
        title={`c. Values sandbox use may change (${e.explained.length})`}
        note={`Listed apart, read on the sandbox now and on X Layer at ${at}. A multiplier change must match a ledger entry; pool and wrapper values move with ordinary transactions.`}
      >
        {e.explained.map((row) => (
          <ExplainedItem key={row.id} row={row} forkBlock={forkBlock} />
        ))}
      </Group>
    </div>
  )
}
