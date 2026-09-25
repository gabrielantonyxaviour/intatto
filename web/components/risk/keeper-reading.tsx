"use client"

/** The keeper's latest issuer reading, from GET /status. Shown only when the service log URL is set. */
import type { ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { CircleAlertIcon, RotateCwIcon } from "lucide-react"
import { z } from "zod"
import { SESSIONS, type Session } from "@intatto/config/session"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SessionBadge, Check } from "./badges"
import { Empty, Panel, RowsSkeleton } from "./states"

const readingSchema = z.object({
  at: z.string().max(64),
  error: z.string().max(300).optional(),
  period: z.string().max(32).nullable().optional(),
  openNow: z.boolean().nullable().optional(),
  nextChangeAt: z.string().max(64).nullable().optional(),
  halted: z.boolean().optional(),
  atomicHalted: z.boolean().optional(),
  quote: z.string().max(80).nullable().optional(),
  currentMultiplier: z.string().max(80).nullable().optional(),
  newMultiplier: z.string().max(80).nullable().optional(),
  activationDateTime: z.string().max(64).nullable().optional(),
  mappedSession: z.enum(SESSIONS).optional(),
  disagreement: z.string().max(500).nullable().optional(),
})
const statusSchema = z.object({
  lastCycle: z
    .object({
      at: z.string(),
      chainTime: z.number(),
      actions: z.number(),
      sent: z.number(),
      failures: z.number(),
      durationMs: z.number(),
    })
    .nullable(),
  readings: z.record(z.string().max(16), readingSchema),
})
type Reading = z.infer<typeof readingSchema>

const ORDER = ["NVDAx", "SPYx"]

function stamp(iso: string | null | undefined): string {
  if (!iso) return "unknown"
  const shown = iso.replace("T", " ").replace(/\.\d+Z$/, " UTC").replace(/Z$/, " UTC")
  return Number.isNaN(Date.parse(iso)) ? iso : shown
}

function money(quote: string | null | undefined): string {
  if (!quote) return "none"
  return quote.startsWith("$") ? quote : `$${quote}`
}

function times(v: string | null | undefined): string {
  if (!v) return "none"
  return v.endsWith("×") ? v : `${v}×`
}

function failed(r: Reading): boolean {
  return Boolean(r.error) && r.halted === undefined && r.quote === undefined
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="min-w-0">{v}</dd>
    </>
  )
}

function OpenFlag({ openNow }: { openNow: boolean | null | undefined }) {
  if (openNow === true) return <Badge variant="success-light">open</Badge>
  if (openNow === false) return <Badge variant="secondary">closed</Badge>
  return <Badge variant="outline">unknown</Badge>
}

function OneReading({ symbol, reading }: { symbol: string; reading: Reading }) {
  if (failed(reading)) {
    return (
      <div data-reading={symbol} className="grid gap-1 text-sm">
        <h4 className="font-medium">{symbol}</h4>
        <p className="text-destructive">
          The issuer read at {stamp(reading.at)} failed: {reading.error}
        </p>
      </div>
    )
  }
  const pending = reading.newMultiplier ? `${times(reading.newMultiplier)} at ${stamp(reading.activationDateTime)}` : "none"
  return (
    <div data-reading={symbol} className="grid gap-2">
      <h4 className="text-sm font-medium">{symbol}</h4>
      <dl className="grid gap-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-6">
        <Row k="Read at" v={stamp(reading.at)} />
        <Row
          k="Trading period"
          v={
            <span className="flex flex-wrap items-center gap-2">
              <span>{reading.period ?? "unknown"}</span>
              <OpenFlag openNow={reading.openNow} />
              {reading.nextChangeAt ? <span className="text-muted-foreground">next change {stamp(reading.nextChangeAt)}</span> : null}
            </span>
          }
        />
        <Row k="Market halt" v={reading.halted === undefined ? "unknown" : <Check ok={!reading.halted} label={reading.halted ? "halted" : "not halted"} />} />
        <Row k="Atomic halt" v={reading.atomicHalted === undefined ? "unknown" : <Check ok={!reading.atomicHalted} label={reading.atomicHalted ? "halted" : "not halted"} />} />
        <Row k="Quote" v={money(reading.quote)} />
        <Row k="Multiplier now" v={times(reading.currentMultiplier)} />
        <Row k="Pending multiplier" v={pending} />
        <Row k="Mapped session" v={reading.mappedSession ? <SessionBadge session={reading.mappedSession as Session} /> : "unknown"} />
        <Row k="Disagreement" v={reading.disagreement ? <span className="text-destructive">{reading.disagreement}</span> : "none"} />
      </dl>
    </div>
  )
}

export function KeeperReading({ url }: { url: string }) {
  const query = useQuery({
    queryKey: ["keeper-reading", url],
    refetchInterval: 60_000,
    queryFn: async () => {
      const res = await fetch(`${url.replace(/\/$/, "")}/status`, { headers: { accept: "application/json" } })
      if (!res.ok) throw new Error(`the keeper status answered ${res.status}`)
      const parsed = statusSchema.safeParse(await res.json())
      if (!parsed.success) throw new Error("the keeper status returned an unexpected shape")
      return parsed.data
    },
  })
  const readings = query.data?.readings ?? {}
  const symbols = [...ORDER.filter((s) => s in readings), ...Object.keys(readings).filter((s) => !ORDER.includes(s))]
  const detail = query.error instanceof Error ? query.error.message.split("\n")[0]?.slice(0, 180) : null
  return (
    <Panel
      title="Last issuer read"
      description="The quote, trading period, halt flags and multiplier from the keeper's latest read of the issuer. A disagreement is why that cycle posted nothing from the reading."
    >
      <div data-testid="last-issuer-read">
        {query.isPending ? <RowsSkeleton rows={3} label="Loading the last issuer read" /> : null}
        {query.isError ? (
          <Alert variant="destructive" data-state="unavailable">
            <CircleAlertIcon aria-hidden />
            <AlertTitle>Last issuer read is unavailable</AlertTitle>
            <AlertDescription>
              <p>The keeper status did not answer{detail ? `: ${detail}` : "."}</p>
              <Button variant="outline" size="sm" onClick={() => query.refetch()}>
                <RotateCwIcon aria-hidden />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        {query.data && symbols.length === 0 ? <Empty>The keeper has not read the issuer yet.</Empty> : null}
        {symbols.length ? (
          <div className="grid gap-4">
            {symbols.map((symbol) => {
              const reading = readings[symbol]
              return reading ? <OneReading key={symbol} symbol={symbol} reading={reading} /> : null
            })}
          </div>
        ) : null}
      </div>
    </Panel>
  )
}
