// Prints each take's marks as video-time seconds (video t=0 is the first captured frame).
import { readFileSync, readdirSync, existsSync } from "node:fs"
const only = process.argv[2]
for (const d of readdirSync("raw").sort()) {
  if (only && !d.startsWith(only)) continue
  const p = `raw/${d}/take.json`; if (!existsSync(p)) continue
  const t = JSON.parse(readFileSync(p, "utf8"))
  const f0 = t.frames[0]?.t ?? t.t0
  console.log(`${d}  (${(t.tEnd - f0).toFixed(1)}s${t.error ? " ERROR " + t.error : ""})`)
  console.log("  " + t.marks.map(m => `${m.label}@${(m.t + t.t0 - f0).toFixed(2)}`).join("  "))
}
