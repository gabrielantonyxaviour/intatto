// Builds src/v3/footage/takes.json from film/raw/<name>-<stamp>/take.json and copies each chosen take.mp4 into
// public/takes/. The v3 Footage component resolves (take, mark, offset) through this manifest, so a re-shoot is:
// record → `node scripts/v3-takes.mjs` → re-render. The newest stamp per name wins; pin one with name=stamp.
//   node scripts/v3-takes.mjs                         newest take of every name
//   node scripts/v3-takes.mjs weekend=2026-09-25T11-00-09
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const RAW = join(here, "../../raw")
const PUBLIC = join(here, "../public/takes")
const OUT = join(here, "../src/v3/footage/takes.json")

const pins = Object.fromEntries(process.argv.slice(2).map((a) => a.split("=")))
const chosen = {}
for (const dir of readdirSync(RAW).sort()) {
  const m = dir.match(/^(.+)-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})$/)
  if (!m || !existsSync(join(RAW, dir, "take.json")) || !existsSync(join(RAW, dir, "take.mp4"))) continue
  const [, name, stamp] = m
  if (pins[name] && pins[name] !== stamp) continue
  if (!chosen[name] || chosen[name].stamp < stamp) chosen[name] = { dir, stamp }
}

const manifest = {}
for (const [name, { dir, stamp }] of Object.entries(chosen).sort()) {
  const take = JSON.parse(readFileSync(join(RAW, dir, "take.json"), "utf8"))
  if (take.error) process.stderr.write(`warning: ${dir} recorded with error: ${take.error}\n`)
  // Video t = 0 is the first captured frame; marks are relative to t0.
  const first = take.frames?.[0]?.t ?? take.t0
  const marks = Object.fromEntries(take.marks.map((mk) => [mk.label, +(mk.t + take.t0 - first).toFixed(3)]))
  const file = `${name}T${stamp.slice(11)}.mp4`
  const src = join(RAW, dir, "take.mp4")
  const dst = join(PUBLIC, file)
  mkdirSync(PUBLIC, { recursive: true })
  if (!existsSync(dst) || statSync(dst).size !== statSync(src).size) copyFileSync(src, dst)
  manifest[name] = { stamp, file: `takes/${file}`, seconds: +(take.tEnd - first).toFixed(3), marks }
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(manifest, null, 1) + "\n")
process.stdout.write(`wrote ${Object.keys(manifest).length} takes → src/v3/footage/takes.json\n`)
