// Copies the newest (or pinned) raw take for each shot-list name into public/takes.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const film = resolve(root, "..");
const NAMES = [
  "market",
  "borrow-mainnet",
  "explorer",
  "weekend",
  "proof",
  "replays",
  "agents",
  "keeper",
  "keeper-explorer",
];
const CUTOFF = Date.parse("2026-09-25T19:30:00Z");

const pinsPath = join(root, "src/data/take-pins.json");
const pins = existsSync(pinsPath) ? JSON.parse(readFileSync(pinsPath, "utf8")) : {};
const rawDirs = readdirSync(join(film, "raw"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const stampOf = (dir, name) => {
  const match = dir.match(new RegExp(`^${name}-(\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2})$`));
  return match ? match[1] : null;
};

const probe = (file) => {
  const result = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    { encoding: "utf8" },
  );
  const value = Number.parseFloat(result.stdout);
  return Number.isFinite(value) ? value : null;
};

mkdirSync(join(root, "public/takes"), { recursive: true });
const out = {};

for (const name of NAMES) {
  const found = rawDirs
    .map((dir) => ({ dir, stamp: stampOf(dir, name) }))
    .filter((item) => item.stamp && existsSync(join(film, "raw", item.dir, "take.mp4")));
  const pinned = pins[name]?.stamp;
  const chosen = pinned ? found.find((item) => item.stamp === pinned) : found.sort((a, b) => (a.stamp < b.stamp ? 1 : -1))[0];
  if (!chosen) {
    console.log(`${name}: no take`);
    continue;
  }
  const dir = join(film, "raw", chosen.dir);
  const take = JSON.parse(readFileSync(join(dir, "take.json"), "utf8"));
  const first = take.frames?.[0]?.t ?? take.t0;
  const marks = {};
  for (const mark of take.marks ?? []) {
    marks[mark.label] = Math.round((mark.t + take.t0 - first) * 1000) / 1000;
  }
  for (const [from, to] of Object.entries(pins[name]?.aliases ?? {})) {
    if (marks[to] == null && marks[from] != null) marks[to] = marks[from];
  }
  const src = join(dir, "take.mp4");
  const dest = join(root, "public/takes", `${name}.mp4`);
  copyFileSync(src, dest);
  const seconds = probe(dest) ?? Math.round((take.tEnd - first) * 1000) / 1000;
  const iso = chosen.stamp.replace(/T(\d\d)-(\d\d)-(\d\d)$/, "T$1:$2:$3Z");
  out[name] = {
    stamp: chosen.stamp,
    seconds: Math.round(seconds * 1000) / 1000,
    oldUi: Date.parse(iso) < CUTOFF,
    marks,
  };
  console.log(`${name}: ${chosen.stamp} ${seconds.toFixed(2)}s${out[name].oldUi ? " old-ui" : ""}`);
}

writeFileSync(join(root, "src/data/takes.json"), `${JSON.stringify(out, null, 1)}\n`);
