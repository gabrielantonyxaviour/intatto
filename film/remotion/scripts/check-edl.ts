import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FOOTAGE_BEATS } from "../src/data/types";
import { TAKES } from "../src/data/takes";
import { cueWarnings } from "../src/lib/cues";
import { TIMELINE } from "../src/lib/timeline";
import { FPS } from "../src/theme";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let placeholders = 0;
let freezes = 0;

for (const beat of FOOTAGE_BEATS) {
  for (const seg of TIMELINE[beat]) {
    const label = `${seg.take}/${seg.mark}`.padEnd(34);
    if (seg.placeholder) {
      placeholders += 1;
      console.log(`${beat.padEnd(10)} ${seg.label.padEnd(10)} ${label} PLACEHOLDER`);
      continue;
    }
    const visible = (seg.endFrame - seg.startFrame) / FPS;
    const sourceOut = seg.sourceStart + visible * seg.rate;
    const take = TAKES[seg.take];
    const have = (take?.seconds ?? 0) - seg.sourceStart;
    const file = resolve(root, "public", seg.src);
    const freeze = !existsSync(file) || seg.sourceStart < -0.02 || sourceOut > (take?.seconds ?? 0) + 0.08;
    if (freeze) freezes += 1;
    const mark = freeze ? "FREEZE" : "OK";
    const old = seg.oldUi ? "  old-ui" : "";
    console.log(
      `${beat.padEnd(10)} ${seg.label.padEnd(10)} ${label} src ${seg.sourceStart.toFixed(2)}→${sourceOut.toFixed(2)}  rate ${seg.rate}  need ${visible.toFixed(2)}s have ${have.toFixed(2)}s  ${mark}${old}`,
    );
  }
}

const warnings = cueWarnings();
for (const warning of warnings) console.log(`WARN ${warning}`);
console.log(`--- ${placeholders} placeholders, ${freezes} freezes, ${warnings.length} cue fallbacks`);
if (freezes > 0 || warnings.length > 0) process.exit(1);
