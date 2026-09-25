"use client"

import { cn } from "@/lib/utils"
import { formatNumber } from "@/components/ui/web3/format"
import type { IntattoEvidence } from "./check-intatto"
import { Field, Mono, RowMark } from "./primitives"

/** Check 4 evidence: each Intatto contract's masked code hash on the sandbox against the reference. */
export function IntattoEvidenceView({ e }: { e: IntattoEvidence }) {
  const against = e.comparison === "artifacts" ? "Build artifact" : "X Layer mainnet"
  return (
    <div className="grid gap-3">
      <p className="text-sm" data-comparison={e.comparison}>
        {e.comparison === "artifacts" ? (
          <>
            <span className="font-medium">Compared with this repo&apos;s build artifacts</span>: Intatto is not deployed on X Layer
            mainnet yet, so each contract&apos;s code on the sandbox is compared with <Mono>contracts/out</Mono> ({e.compiler}).
          </>
        ) : (
          <>
            <span className="font-medium">Compared with the X Layer mainnet deployment</span>: each contract&apos;s code on the
            sandbox is compared with the code at the same role on mainnet.
          </>
        )}{" "}
        Immutables (values a constructor writes into the code, such as addresses) are zeroed on both sides first.
      </p>
      <ul className="grid gap-3" aria-label="Intatto contracts compared">
        {e.rows.map((row) => (
          <li key={row.id} data-row={row.id} data-equal={row.equal} className="grid gap-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {row.label} <span className="font-normal text-muted-foreground">({row.contract})</span>
                </p>
                <Mono className="text-muted-foreground">{row.address}</Mono>
              </div>
              <RowMark equal={row.equal} />
            </div>
            <dl className="grid gap-1.5">
              <Field label="Sandbox, masked">
                <span className="grid">
                  <Mono className={cn(!row.equal && "text-destructive")}>{row.maskedHash ?? "no code"}</Mono>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatNumber(row.size)} bytes · {row.masked} immutable {row.masked === 1 ? "range" : "ranges"} zeroed
                  </span>
                </span>
              </Field>
              <Field label={`${against}, masked`}>
                <span className="grid">
                  <Mono>{row.expectedMaskedHash ?? "no code"}</Mono>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatNumber(row.expectedSize)} bytes
                    {row.referenceAddress ? ` at ${row.referenceAddress}` : ""}
                  </span>
                </span>
              </Field>
              {row.firstDiff !== null ? (
                <Field label="First difference">
                  <span className="text-destructive tabular-nums">byte {formatNumber(row.firstDiff)}</span>
                </Field>
              ) : null}
            </dl>
          </li>
        ))}
      </ul>
      {e.missing.length > 0 ? (
        <ul className="list-disc pl-5 text-sm text-destructive">
          {e.missing.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
