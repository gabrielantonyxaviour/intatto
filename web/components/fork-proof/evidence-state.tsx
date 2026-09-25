"use client"

import type { ReactNode } from "react"
import { InfoIcon } from "lucide-react"
import { formatNumber } from "@/components/ui/web3/format"
import type { MovingRow, StateEvidence, ValueRow } from "./check-state"
import { DiffLines, Mono, RowMark } from "./primitives"

function RowHead({ row, mark }: { row: ValueRow; mark: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm wrap-anywhere">
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

function MovingItem({ row, at }: { row: MovingRow; at: string }) {
  const note =
    row.equal || row.explanations.length > 0
      ? null
      : row.ledger === "ok"
        ? "No ledger entry names this change; ordinary sandbox transactions (not admin calls) are not in the ledger."
        : "This sandbox has no ledger to show here."
  return (
    <li data-row={row.id} data-equal={row.equal} className="grid gap-2 rounded-lg border p-3">
      <RowHead
        row={row}
        mark={
          row.equal ? (
            <RowMark equal label="unchanged since the fork" />
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
              <InfoIcon aria-hidden className="size-3.5" />
              moved by sandbox use
            </span>
          )
        }
      />
      <p className="text-xs text-muted-foreground wrap-anywhere">{row.why}</p>
      <DiffLines
        equal={row.equal}
        oldLabel={`X Layer, ${at}`}
        newLabel="Sandbox now"
        oldValue={row.reference.raw}
        newValue={row.sandbox.raw}
        oldShown={row.reference.shown}
        newShown={row.sandbox.shown}
      />
      {row.explanations.length > 0 ? (
        <ul className="grid min-w-0 gap-1 text-xs text-muted-foreground" aria-label="Ledger entries that explain this change">
          {row.explanations.map((e, i) => (
            <li key={i} className="min-w-0 wrap-anywhere">
              Ledger ({e.kind}): {e.summary}
            </li>
          ))}
        </ul>
      ) : null}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </li>
  )
}

/** Check 3 evidence: what must equal X Layer, then what sandbox use moves, listed apart. */
export function StateEvidenceView({ e, forkBlock }: { e: StateEvidence; forkBlock: bigint }) {
  const at = `block ${formatNumber(forkBlock)}`
  return (
    <div className="grid gap-5">
      <Group
        title={`a. Equal to X Layer at the fork block (${e.unchanged.length} reads)`}
        note={`Contract reads and raw storage no sandbox action writes (proxy implementations and admins, total supplies, since the sandbox moves balances but never mints, the token's name, and the feed's answer, aggregator and owner). The sandbox is read now, X Layer at ${at}. Any difference means the sandbox state was edited outside its recorded actions.`}
      >
        {e.unchanged.map((row) => (
          <ValueItem key={row.id} row={row} oldLabel={`X Layer, ${at}`} newLabel="Sandbox now" />
        ))}
      </Group>
      <Group
        title={`b. Moved by sandbox use, listed apart (${e.moving.length} values)`}
        note={`Balances, the pool price and the multiplier move as the sandbox is used: funding, swaps, time warps and scenarios. Each shows X Layer at ${at}, the sandbox now, and the ledger entries that explain a change. These never fail the check.`}
      >
        {e.moving.map((row) => (
          <MovingItem key={row.id} row={row} at={at} />
        ))}
      </Group>
    </div>
  )
}
