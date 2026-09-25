"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useProtocolParams, type VaultState } from "@/lib/chain"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { bpsText } from "./lend-format"
import { Section } from "./overview-section"
import { borrowRateAt, supplyRateAt, type RateModel } from "./use-lend-reads"

const W = 400
const H = 200
const PAD = { l: 36, r: 12, t: 12, b: 28 }

function RateCurve({ model, utilizationBps, reserveFactorBps }: { model: RateModel; utilizationBps: bigint; reserveFactorBps: bigint }) {
  const top = Number(borrowRateAt(model, 10_000n)) || 1
  const x = (u: number) => PAD.l + (u / 10_000) * (W - PAD.l - PAD.r)
  const y = (r: number) => H - PAD.b - (r / top) * (H - PAD.t - PAD.b)
  const us = [0, Number(model.kinkBps), 10_000]
  const path = (f: (u: bigint) => bigint, pts: number[]) =>
    pts.map((u, i) => `${i ? "L" : "M"}${x(u).toFixed(1)},${y(Number(f(BigInt(u)))).toFixed(1)}`).join(" ")
  const supplyPts = Array.from({ length: 41 }, (_, i) => i * 250)
  const u = Math.min(10_000, Number(utilizationBps))
  const borrowNow = Number(borrowRateAt(model, BigInt(u)))
  const ticks = [0, 2_500, 5_000, 7_500, 10_000]
  const yTicks = [0, top / 2, top]

  return (
    <figure className="grid max-w-xl gap-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Borrow rate rises from ${bpsText(model.baseBps)} to ${bpsText(
          model.baseBps + model.slope1Bps,
        )} at ${bpsText(model.kinkBps, 0)} utilisation, then to ${bpsText(top)} at 100%. Utilisation now ${bpsText(
          utilizationBps,
        )}.`}
      >
        {yTicks.map((r) => (
          <g key={r}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(r)} y2={y(r)} className="stroke-border" strokeWidth={1} />
            <text x={PAD.l - 4} y={y(r) + 3} textAnchor="end" className="fill-muted-foreground text-[11px]">
              {Math.round(r / 100)}%
            </text>
          </g>
        ))}
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={H - PAD.b + 14} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            {t / 100}%
          </text>
        ))}
        <path d={path((v) => supplyRateAt(model, v, reserveFactorBps), supplyPts)} fill="none" className="stroke-muted-foreground" strokeWidth={1.5} strokeDasharray="4 3" />
        <path d={path((v) => borrowRateAt(model, v), us)} fill="none" className="stroke-foreground" strokeWidth={2} />
        <line x1={x(u)} x2={x(u)} y1={PAD.t} y2={H - PAD.b} className="stroke-foreground" strokeWidth={1} strokeDasharray="2 2" />
        <circle cx={x(u)} cy={y(borrowNow)} r={3.5} className="fill-foreground" />
        <text
          x={u > 7_000 ? x(u) - 4 : x(u) + 4}
          y={PAD.t + 10}
          textAnchor={u > 7_000 ? "end" : "start"}
          className="fill-foreground text-[11px]"
        >
          Now {bpsText(utilizationBps, 1)}
        </text>
        <text x={x(Number(model.kinkBps))} y={y(Number(model.baseBps + model.slope1Bps)) - 6} textAnchor="end" className="fill-muted-foreground text-[11px]">
          kink {bpsText(model.kinkBps, 0)}
        </text>
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-4 bg-foreground" /> Borrow rate
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block w-4 border-t-2 border-dashed border-muted-foreground" /> Supply rate
        </span>
        <span>x: utilisation · y: rate a year</span>
      </figcaption>
    </figure>
  )
}

/** Supply rate, borrow rate and utilisation, with the kinked curve marking where the vault is now. */
export function RatesSection({ vault }: { vault: VaultState }) {
  const params = useProtocolParams("NVDAx")
  const qc = useQueryClient()
  const [curve, setCurve] = useState(false)
  const model: RateModel | undefined = params.data?.rateModel
  const reserve = params.data?.market.reserveFactorBps
  const failed = params.status === "error" || params.status === "unavailable"
  return (
    <Section id="rates" title="Interest rates">
      <dl className="grid grid-cols-3 gap-4">
        {[
          { label: "Supply rate", value: bpsText(vault.supplyRateBps), id: "rate-supply" },
          { label: "Borrow rate", value: bpsText(vault.borrowRateBps), id: "rate-borrow" },
          { label: "Utilisation", value: bpsText(vault.utilizationBps), id: "rate-utilisation" },
        ].map((s) => (
          <div key={s.id} className="grid gap-1 rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd data-testid={s.id} className="text-lg font-medium tabular-nums">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
      <Button type="button" variant="outline" aria-expanded={curve} data-testid="rate-curve-toggle" onClick={() => setCurve((v) => !v)}>
        {curve ? "Hide rate curve" : "Rate curve"}
      </Button>
      {curve && model && reserve !== undefined ? (
        <>
          <RateCurve model={model} utilizationBps={vault.utilizationBps} reserveFactorBps={reserve} />
          <p className="text-sm text-muted-foreground" data-testid="rate-model">
            Borrowers pay {bpsText(model.baseBps)} a year at zero utilisation, rising by{" "}
            {bpsText(model.slope1Bps)} up to the {bpsText(model.kinkBps, 0)} kink, then by a further{" "}
            {bpsText(model.slope2Bps)} between the kink and full utilisation, so idle USDG comes back quickly.
            Lenders receive the borrow rate × utilisation, less the {bpsText(reserve, 0)} reserve factor read at block{" "}
            {params.data?.blockNumber.toString()}.
          </p>
        </>
      ) : curve && failed ? (
        <Alert variant="destructive">
          <AlertTitle>The rate model could not be read</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            The RPC did not answer. No stand-in reserve factor is shown.
            <Button size="sm" variant="outline" onClick={() => void qc.invalidateQueries({ queryKey: ["protocol-params"] })}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : curve ? (
        <Skeleton className="aspect-[2/1] w-full" />
      ) : null}
    </Section>
  )
}
