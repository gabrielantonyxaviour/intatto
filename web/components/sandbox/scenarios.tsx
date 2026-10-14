"use client"

import { DefinitionPopover } from "@/components/ui/ix"
import { SCENARIOS } from "./copy"
import { ActionButton, type Admin } from "./admin-controls"

/** Compact actions with provenance alongside each, rather than a wall of method cards. */
export function Scenarios({ admin, compact = false }: { admin: Admin; compact?: boolean }) {
  return (
    <section data-testid="scenarios" className="grid min-w-0 gap-3">
      <h3 className="text-sm font-semibold">Scenarios</h3>
      <div className={`grid min-w-0 gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
        {SCENARIOS.map((s) => (
          <div key={s.name} data-testid={`scenario-${s.name}`} className="grid min-w-0 gap-1">
            <div className="flex min-w-0 items-start gap-1">
              <ActionButton admin={admin} request={{ kind: "scenario", name: s.name }} label={s.label} busy={s.busy} variant="outline" />
              <DefinitionPopover term={`Sources and method: ${s.title}`}>
                <div className="grid gap-2 text-sm"><p>{s.provenance}.</p><p>Source: {s.source}.</p><p>{s.method}</p><p>{s.next}</p></div>
              </DefinitionPopover>
            </div>
            <p className="text-xs text-muted-foreground">{s.provenance.split(":")[0]}{s.duration ? ` · ${s.duration}` : ""}{s.followUp ? " · Follows the split" : ""}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
