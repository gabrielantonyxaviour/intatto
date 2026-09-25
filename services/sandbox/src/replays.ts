/**
 * The replay data the sandbox scenarios run on (data/replays, written by blk_replays), bundled into the Worker
 * and read by the local server alike. Every scenario's ledger entry carries its provenance from here.
 */
import { z } from "zod"
import type { GapReplay, SyntheticGap } from "../../../checks/fork/lib/scenarios.ts"
import index from "../../../data/replays/index.json" with { type: "json" }
import gapJson from "../../../data/replays/nvda-2025-01-gap.json" with { type: "json" }
import corporateJson from "../../../data/replays/nvda-corporate-action.json" with { type: "json" }
import syntheticJson from "../../../data/replays/synthetic-gap.json" with { type: "json" }

const source = z.object({ url: z.string(), retrievedAt: z.string(), sha256: z.string() })
const indexSchema = z.array(z.object({ id: z.string(), kind: z.string(), label: z.string(), file: z.string(), sha256: z.string() }))

const gapSchema = z.object({
  id: z.literal("nvda-2025-01-gap"),
  label: z.string(),
  kind: z.string(),
  sources: z.array(source),
  anchors: z.object({ fridayClose: z.object({ t: z.number(), c: z.number() }), mondayOpen: z.object({ t: z.number(), o: z.number() }) }),
  bars: z.array(z.object({ t: z.number(), o: z.number(), h: z.number(), l: z.number(), c: z.number() })).min(1),
  contentSha256: z.string(),
})

const corporateSchema = z.object({
  id: z.literal("nvda-corporate-action"),
  label: z.string(),
  kind: z.string(),
  sources: z.array(source),
  scenario: z.object({ splitRatio: z.number().int().min(2), note: z.string() }),
  contentSha256: z.string(),
})

const syntheticSchema = z.object({
  id: z.literal("synthetic-gap"),
  label: z.string(),
  kind: z.string(),
  gapBps: z.number().int().min(100).max(9000),
  note: z.string(),
  sources: z.array(source),
  contentSha256: z.string(),
})

const files = indexSchema.parse(index)
export const gapReplayData = gapSchema.parse(gapJson)
export const corporateActionData = corporateSchema.parse(corporateJson)
export const syntheticGapData = syntheticSchema.parse(syntheticJson)

export const gapReplay: GapReplay = gapReplayData
export const syntheticGap: SyntheticGap = { id: syntheticGapData.id, label: syntheticGapData.label, gapBps: syntheticGapData.gapBps }

/** What a ledger entry records about the data a scenario ran on: label, sources (URL, retrievedAt, sha256), hashes. */
export type Provenance = {
  replay: string
  label: string
  kind: string
  sources: z.infer<typeof source>[]
  fileSha256: string
  contentSha256: string
  note?: string
}

function provenance(d: { id: string; label: string; kind: string; sources: z.infer<typeof source>[]; contentSha256: string }, note?: string): Provenance {
  const file = files.find((f) => f.id === d.id)
  if (!file) throw new Error(`data/replays/index.json has no entry for ${d.id}`)
  return { replay: d.id, label: d.label, kind: d.kind, sources: d.sources, fileSha256: file.sha256, contentSha256: d.contentSha256, ...(note ? { note } : {}) }
}

export const PROVENANCE = {
  gap: provenance(gapReplayData),
  corporateAction: provenance(corporateActionData, corporateActionData.scenario.note),
  synthetic: provenance(syntheticGapData, syntheticGapData.note),
} as const
