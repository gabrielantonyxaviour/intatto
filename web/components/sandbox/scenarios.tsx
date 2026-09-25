"use client"

import { HistoryIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SCENARIOS } from "./copy"
import { ActionButton, LookAt, type Admin } from "./admin-controls"

/** Named replays, each with what its data is, where it came from, what it does and what to look at next. */
export function Scenarios({ admin }: { admin: Admin }) {
  return (
    <Card data-testid="scenarios">
      <CardHeader>
        <CardTitle>
          <h2 className="flex items-center gap-2">
            <HistoryIcon aria-hidden className="size-4" />
            Scenarios
          </h2>
        </CardTitle>
        <CardDescription>
          Replays run on this fork with real contract code. Each ledger entry records the data&apos;s source URL, retrieval time and
          sha256.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {SCENARIOS.map((s) => (
          <section key={s.name} aria-labelledby={`scenario-${s.name}`} data-testid={`scenario-${s.name}`} className="grid content-start gap-2 rounded-lg border p-3">
            <h3 id={`scenario-${s.name}`} className="text-sm font-medium">
              {s.title}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={s.provenance.startsWith("Synthetic") ? "warning-outline" : "info-outline"}>{s.provenance.split(":")[0]}</Badge>
              {s.followUp ? <Badge variant="outline">Follows the split</Badge> : null}
              {s.duration ? <Badge variant="outline">{s.duration}</Badge> : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {s.provenance}. Source: {s.source}.
            </p>
            <p className="font-mono text-xs break-words text-muted-foreground">{s.method}</p>
            <p className="text-sm">
              <span className="font-medium">What you should see next: </span>
              {s.next}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <ActionButton admin={admin} request={{ kind: "scenario", name: s.name }} label={s.label} busy={s.busy} variant="outline" />
              <LookAt {...s.look} />
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  )
}
