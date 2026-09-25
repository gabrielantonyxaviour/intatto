"use client"

import { cn } from "@/lib/utils"
import { formatNumber, formatUtc } from "@/components/ui/web3/format"
import type { BlocksEvidence } from "./check-blocks"
import type { BytecodeEvidence, CodeSummary } from "./check-bytecode"
import { Field, Mono, RowMark } from "./primitives"

const blockName = (offset: bigint) => (offset === 0n ? "fork block" : `fork block − ${offset}`)

/** Check 1 evidence: each block's hash on both RPCs. */
export function BlocksEvidenceView({ e }: { e: BlocksEvidence }) {
  return (
    <ul className="grid gap-3" aria-label="Blocks compared">
      {e.rows.map((row) => (
        <li key={String(row.number)} data-row={`block-${row.number}`} data-equal={row.equal} className="grid gap-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Block {formatNumber(row.number)} <span className="font-normal text-muted-foreground">· {blockName(row.offset)}</span>
            </p>
            <RowMark equal={row.equal} />
          </div>
          <dl className="grid gap-1.5">
            <Field label="X Layer hash">
              <Mono>{row.reference?.hash ?? "not found"}</Mono>
            </Field>
            <Field label="Sandbox hash">
              <Mono className={cn(!row.equal && "text-destructive")}>{row.sandbox?.hash ?? "not found"}</Mono>
            </Field>
            {row.offset === 0n && row.reference ? (
              <Field label="Block time">
                <span className="tabular-nums">{formatUtc(row.reference.timestamp)}</span>
              </Field>
            ) : null}
          </dl>
        </li>
      ))}
    </ul>
  )
}

function CodeLine({ c, differs }: { c: CodeSummary; differs: boolean }) {
  if (!c.hash) return <span className={cn("text-sm", differs ? "text-destructive" : "text-muted-foreground")}>no code</span>
  return (
    <span className="grid">
      <Mono className={cn(differs && "text-destructive")}>{c.hash}</Mono>
      <span className="text-xs text-muted-foreground tabular-nums">{formatNumber(c.size)} bytes</span>
    </span>
  )
}

/** Check 2 evidence: every address covered, with its code hash on X Layer and on the sandbox. */
export function BytecodeEvidenceView({ e, forkBlock }: { e: BytecodeEvidence; forkBlock: bigint }) {
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        {e.rows.length} addresses covered. keccak256 of each address&apos;s runtime code:
      </p>
      <ul className="grid gap-3" aria-label="Contracts compared">
        {e.rows.map((row) => {
          const ref = row.reference.hash
          return (
            <li key={row.address} data-row={row.address.toLowerCase()} data-equal={row.equal} className="grid gap-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{row.label}</p>
                  <Mono className="text-muted-foreground">{row.address}</Mono>
                  <p className="text-xs text-muted-foreground">{row.how}</p>
                </div>
                <RowMark equal={row.equal} />
              </div>
              {row.sandboxResolved ? (
                <p className="text-sm text-destructive">
                  The sandbox now resolves this to a different address: <Mono>{row.sandboxResolved}</Mono>
                </p>
              ) : null}
              <dl className="grid gap-1.5">
                <Field label={`X Layer, block ${formatNumber(forkBlock)}`}>
                  <CodeLine c={row.reference} differs={!ref} />
                </Field>
                <Field label="Sandbox now">
                  <CodeLine c={row.sandboxNow} differs={row.sandboxNow.hash !== ref} />
                </Field>
              </dl>
            </li>
          )
        })}
      </ul>
      {e.omitted.length > 0 ? (
        <div className="grid gap-1 text-sm">
          <p className="font-medium">Not covered</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {e.omitted.map((o) => (
              <li key={o.label}>
                {o.label}: {o.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
