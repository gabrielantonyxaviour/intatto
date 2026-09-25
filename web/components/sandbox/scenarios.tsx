"use client"

import { HistoryIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EvidenceSheet } from "@/components/ui/ix"
import { SCENARIO_GROUPS, SCENARIOS } from "./copy"
import { ActionButton, LookAt, type Admin } from "./admin-controls"

/** Named replays grouped by experiment. Category stays on the card; method and full provenance open directly. */
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
        <CardDescription>Replays on this fork. CFD, issuer-multiplier and synthetic data stay labelled as what they are.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {SCENARIO_GROUPS.map((group) => (
          <section key={group.id} aria-labelledby={`scenario-group-${group.id}`} className="grid gap-3">
            <h3 id={`scenario-group-${group.id}`} className="text-sm font-medium">
              {group.title}
            </h3>
            <div className="grid min-w-0 gap-3 lg:grid-cols-2">
              {group.names.map((name) => {
                const s = SCENARIOS.find((item) => item.name === name)!
                return (
                  <section key={s.name} aria-labelledby={`scenario-${s.name}`} data-testid={`scenario-${s.name}`} className="grid min-w-0 content-start gap-2 rounded-lg border p-3">
                    <h4 id={`scenario-${s.name}`} className="text-sm font-medium">
                      {s.title}
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={s.provenance.startsWith("Synthetic") ? "warning-outline" : "info-outline"}>{s.provenance.split(":")[0]}</Badge>
                      {s.name === "synthetic-gap" ? <Badge variant="outline">45%</Badge> : null}
                      {s.followUp ? <Badge variant="outline">Follows the split</Badge> : null}
                      {s.duration ? <Badge variant="outline">{s.duration}</Badge> : null}
                    </div>
                    <p className="text-sm break-words text-muted-foreground">
                      {s.provenance}. {s.source}.
                    </p>
                    <p className="text-sm break-words">{s.next}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <ActionButton admin={admin} request={{ kind: "scenario", name: s.name }} label={s.label} busy={s.busy} variant="outline" />
                      <LookAt {...s.look} />
                    </div>
                    <EvidenceSheet
                      title={s.title}
                      summary="What this replay is, where it came from, and the fork method. It is not historical X Layer liquidity or a live issuer event unless the label says the multiplier itself is real."
                      state="ready"
                      triggerLabel={`Sources and method: ${s.title}`}
                    >
                      <div className="grid gap-2 text-sm">
                        <p>{s.provenance}</p>
                        <p>Source: {s.source}.</p>
                        <p className="font-mono text-xs break-words">{s.method}</p>
                        <p>{s.next}</p>
                      </div>
                    </EvidenceSheet>
                  </section>
                )
              })}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  )
}
