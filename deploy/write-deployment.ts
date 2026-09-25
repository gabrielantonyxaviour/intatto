/** Converts Deploy.s.sol's flat JSON into the shared deployment schema: `tsx deploy/write-deployment.ts <flat> <out>`. */
import { readFileSync, writeFileSync } from "node:fs"
import { deploymentFromFlat } from "../checks/fork/lib/deployment.ts"

const [flatPath, outPath] = process.argv.slice(2)
if (!flatPath || !outPath) throw new Error("usage: write-deployment.ts <flat.json> <out.json>")
const deployment = deploymentFromFlat(JSON.parse(readFileSync(flatPath, "utf8")))
writeFileSync(outPath, `${JSON.stringify(deployment, null, 2)}\n`)
process.stdout.write(`wrote ${outPath}: vault ${deployment.vault}, NVDAx market ${deployment.markets[0].market}\n`)
