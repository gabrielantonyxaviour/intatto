// Scratch voice-over for timing only (macOS `say`). Writes public/vo/scratch/<id>.wav and src/data/vo-scratch.json.
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs"
import { execFileSync } from "node:child_process"
const beats = JSON.parse(readFileSync("src/data/script.json", "utf8"))
mkdirSync("public/vo/scratch", { recursive: true })
const out = {}
for (const [index, b] of beats.entries()) {
  const name = `${String(index + 1).padStart(2, "0")}-${b.id}`
  const aiff = `public/vo/scratch/${name}.aiff`, wav = `public/vo/scratch/${name}.wav`
  execFileSync("say", ["-v", "Daniel", "-r", "172", "-o", aiff, b.vo.replace(/NVDAx/g, "N V D A x").replace(/USDG/g, "U S D G").replace(/\bAPI\b/g, "A P I")])
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", aiff, "-ar", "48000", "-ac", "1", wav])
  const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav]).toString())
  out[b.id] = { file: `vo/scratch/${name}.wav`, seconds: +dur.toFixed(3), words: null }
  unlinkSync(aiff)
  process.stdout.write(`${b.id} ${dur.toFixed(2)}s\n`)
}
writeFileSync("src/data/vo-scratch.json", JSON.stringify(out, null, 1))
