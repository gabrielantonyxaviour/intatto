import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSrt } from "../src/lib/captions";

const out = resolve(dirname(fileURLToPath(import.meta.url)), "../out/intatto-demo.srt");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, renderSrt());
console.log(out);
