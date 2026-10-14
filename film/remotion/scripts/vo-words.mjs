// Word timings for Gabriel's voice-over, run locally with whisper.cpp (never a cloud API).
// Usage (through the render gate, it runs ffmpeg): bash ../render-gate.sh node scripts/vo-words.mjs [source]
//   source = a folder in film/vo/gabriel/ holding NN-*.wav (default "edit"; "polished" shares edit's timing).
// Whisper is used ONLY for timing: its words are aligned onto the script's own words (VO_SCRIPT v5.3, from
// src/data/script.json), so names it mishears ("Intato", "ufdg") never reach the screen.
// Writes src/v3/vo/words-<source>.json: { "<n>": { file, seconds, words: [{ text, start, end, heard }], whisper: [...] } }.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { transcribe, toCaptions } = require("@remotion/install-whisper-cpp");

const source = process.argv[2] ?? "edit";
const root = resolve(".");
const dir = resolve("../vo/gabriel", source);
const PROMPT = "Intatto, NVDAx, USDG, xStocks, X Layer, OKX, OKX AI, SPYx, A2MCP, x402, DeepSeek, Bybit, Kraken, Bitget, Chainlink, LTV.";
const script = JSON.parse(readFileSync("src/data/script.json", "utf8"));
const tmp = mkdtempSync(join(tmpdir(), "vo-words-"));
const round = (v) => Math.round(v * 1000) / 1000;
const norm = (w) => w.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "");

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr}`);
  return r.stdout;
};

// Script words as displayed, split on spaces and hyphens ("twenty-four" → two timed words, shown joined).
function scriptWords(text) {
  const out = [];
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    const parts = raw.split(/(?<=-)/);
    for (const p of parts) out.push({ text: p, key: norm(p) });
  }
  return out;
}

function similar(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length > 3 && b.length > 3 && (a.startsWith(b.slice(0, 4)) || b.startsWith(a.slice(0, 4)))) return true;
  let same = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] === b[i]) same++;
  return same / Math.max(a.length, b.length) >= 0.6;
}

// LCS-style alignment of script words onto heard words, then interpolation for unmatched script words.
function align(sw, heard, seconds) {
  const n = sw.length, m = heard.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = similar(sw[i].key, heard[j].key) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const hit = new Array(n).fill(null);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (similar(sw[i].key, heard[j].key) && dp[i][j] === dp[i + 1][j + 1] + 1) hit[i++] = heard[j++];
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return sw.map((w, i) => {
    if (hit[i]) return { text: w.text, start: hit[i].start, end: hit[i].end, heard: true };
    let a = i - 1; while (a >= 0 && !hit[a]) a--;
    let b = i + 1; while (b < n && !hit[b]) b++;
    const left = a >= 0 ? hit[a].end : 0;
    const right = b < n ? hit[b].start : seconds;
    const gap = b - a - 1; // unmatched words sharing [left, right]
    const p = i - a - 1;
    const step = (right - left) / gap;
    return { text: w.text, start: round(left + step * p), end: round(left + step * (p + 1)), heard: false };
  });
}

const ONES = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const n2w = (n) => (n < 20 ? [ONES[n]] : n % 10 ? [TENS[Math.floor(n / 10)], ONES[n % 10]] : [TENS[n / 10]]);
const ALIAS = { nvda: ["nvidia"], xlayer: ["x", "layer"] };

// What whisper wrote → the words the script uses ("24x7" → twenty four seven, "12.5%" → twelve and a half percent).
function expand(text) {
  const out = [];
  for (const raw of text.split(/[\s]+/).filter(Boolean)) {
    const p = raw.replace(/[,;:!?]+$/, "").replace(/\.$/, "");
    let m;
    if ((m = p.match(/^(\d+)x(\d+)$/i))) out.push(...n2w(+m[1]).flatMap((w) => (w.includes(" ") ? w.split(" ") : [w])), ...n2w(+m[2]));
    else if ((m = p.match(/^(\d{1,2})(\.5)?%$/))) out.push(...n2w(+m[1]), ...(m[2] ? ["and", "a", "half"] : []), "percent");
    else if (/^\d{1,2}$/.test(p)) out.push(...n2w(+p));
    else if (/^[a-z]+(\.[a-z]+)+$/i.test(p)) p.split(".").forEach((q, i) => out.push(...(i ? ["dot"] : []), q));
    else for (const q of p.split("-").filter(Boolean)) out.push(...(ALIAS[norm(q)] ?? [q]));
  }
  // "twenty four" from n2w(24) comes as ["twenty", "four"] already.
  return out.map(norm).filter(Boolean);
}

/** Where each pause (below −30 dB for ≥ 0.1 s) ends, in seconds. */
function silenceEnds(file) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-i", file, "-af", "silencedetect=noise=-30dB:d=0.1", "-f", "null", "-"], { encoding: "utf8" });
  return [...`${r.stderr}`.matchAll(/silence_end: ([0-9.]+)/g)].map((m) => Number(m[1]));
}

// Share a heard token's time across its expanded words, by length.
function spread(keys, start, end) {
  const total = keys.reduce((s, k) => s + Math.max(1, k.length), 0) || 1;
  let t = start;
  return keys.map((key) => {
    const d = ((end - start) * Math.max(1, key.length)) / total;
    const w = { key, start: round(t), end: round(t + d) };
    t += d;
    return w;
  });
}

const files = readdirSync(dir).filter((f) => /^\d\d-.*\.(wav|mp3|m4a)$/i.test(f)).sort();
const out = {};
mkdirSync("src/v3/vo", { recursive: true });
for (const f of files) {
  const n = Number(f.slice(0, 2));
  const input = join(dir, f);
  const seconds = round(Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", input])));
  const pcm = join(tmp, `${n}.wav`);
  // 1.5 s of padded tail: whisper drops a clip's last words when speech runs to the very end.
  run("ffmpeg", ["-y", "-loglevel", "error", "-i", input, "-af", "apad=pad_dur=1.5", "-ar", "16000", "-ac", "1", pcm]);
  const result = await transcribe({
    inputPath: pcm,
    whisperPath: join(root, "whisper"),
    whisperCppVersion: "1.5.5",
    model: "small.en",
    tokenLevelTimestamps: true,
    language: "en",
    printOutput: false,
    // DTW token timestamps: plain token offsets drift late by 1–1.5 s on the 20–25 s takes.
    additionalArgs: ["--prompt", PROMPT, "--dtw", "small.en"],
  });
  const heard = [];
  for (const c of toCaptions({ whisperCppOutput: result }).captions) {
    const text = c.text.replace(/\s+/g, " ");
    // Skip empty tokens and stray punctuation standing alone (a "." glued inside a URL is kept).
    if (!text.trim() || ((text.startsWith(" ") || heard.length === 0) && /^\s*[.,]\s*$/.test(text))) continue;
    const start = round(Math.min((c.timestampMs ?? c.startMs) / 1000, seconds));
    const end = round(Math.min(c.endMs / 1000, seconds));
    if (text.startsWith(" ") || heard.length === 0) heard.push({ text: text.trim(), start, end });
    else { heard.at(-1).text += text.trim(); heard.at(-1).end = end; }
  }
  // Special tokens ([BLANK_AUDIO] …) arrive split into pieces; drop them once merged.
  for (let i = heard.length - 1; i >= 0; i--) if (/^\[.*\]$/.test(heard[i].text)) heard.splice(i, 1);
  // DTW onsets run ~0.2–0.45 s late (checked against silencedetect on 01, 07, 11). A word starting just after a
  // pause snaps to where the pause ends (phrase starts are what visuals cue on); the rest move 0.15 s earlier.
  const ends = silenceEnds(input);
  let prev = -1;
  for (const h of heard) {
    const snap = ends.filter((e) => e <= h.start + 0.1 && e >= h.start - 0.6 && e > prev + 0.12).at(-1);
    h.start = round(Math.max(0, prev + 0.05, snap !== undefined ? snap + 0.02 : h.start - 0.15));
    prev = h.start;
  }
  // A word ends where the next begins; then expand numerals/URLs into the script's words.
  heard.forEach((h, i) => { h.end = round(heard[i + 1] ? Math.max(h.start + 0.05, heard[i + 1].start - 0.02) : Math.max(h.start + 0.05, Math.min(h.end, seconds))); });
  const heardKeys = heard.flatMap((h) => spread(expand(h.text), h.start, h.end));
  const words = align(scriptWords(script[n - 1].vo), heardKeys, seconds);
  const matched = words.filter((w) => w.heard).length;
  out[n] = { file: `vo/gabriel/${source}/${f}`, seconds, words, whisper: heard };
  process.stdout.write(`${f}: ${seconds}s, ${heard.length} heard, ${matched}/${words.length} script words matched\n`);
}
writeFileSync(`src/v3/vo/words-${source}.json`, `${JSON.stringify(out, null, 1)}\n`);
process.stdout.write(`VO_WORDS_READY src/v3/vo/words-${source}.json\n`);
