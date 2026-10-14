// Tiny client for Abel's demo-production API. Usage: node board.mjs <METHOD> <path-after-demo-production> [json-file]
import { readFileSync } from "node:fs"
const [method, sub, file] = process.argv.slice(2)
const token = readFileSync("/Users/gabrielantonyxaviour/Documents/products/abel/abel-token.txt", "utf8").trim()
const url = `http://127.0.0.1:4179/api/work/demo-production${sub}${sub.includes("?") ? "&" : "?"}productId=close-guard&v=1.0.0`
const res = await fetch(url, { method, headers: { "content-type": "application/json", "x-abel-token": token }, body: file ? readFileSync(file, "utf8") : undefined })
const text = await res.text()
if (!res.ok) { console.error(res.status, text.slice(0, 800)); process.exit(1) }
process.stdout.write(text)
