// Normalises the voice-over and times each word locally with whisper.cpp.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { transcribe, toCaptions } = require("@remotion/install-whisper-cpp");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const film = resolve(root, "..");
const BEATS = [
  ["01", "hook"],
  ["02", "what"],
  ["03", "mainnet"],
  ["04", "saturday"],
  ["05", "proof"],
  ["06", "replay"],
  ["07", "synthetic"],
  ["08", "agents"],
  ["09", "close"],
];
const WHISPER = "1.5.5";
const MODEL = "small.en";
const PROMPT = "Intatto, NVDAx, USDG, xStocks, X Layer, OKX, SessionLimit, Ventuals, Chainlink.";

const script = JSON.parse(readFileSync(join(root, "src/data/script.json"), "utf8"));
const lines = Object.fromEntries(script.map((beat) => [beat.id, beat.vo]));

const probe = (file) => {
  const result = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], {
    encoding: "utf8",
  });
  return Number.parseFloat(result.stdout);
};

const ffmpeg = (args) => {
  const result = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "ffmpeg failed");
};

const silences = (file, min) => {
  const result = spawnSync("ffmpeg", ["-i", file, "-af", `silencedetect=noise=-35dB:d=${min}`, "-f", "null", "-"], {
    encoding: "utf8",
  });
  const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const starts = [...text.matchAll(/silence_start: ([0-9.]+)/g)].map((match) => Number(match[1]));
  const ends = [...text.matchAll(/silence_end: ([0-9.]+)/g)].map((match) => Number(match[1]));
  return starts.map((start, index) => ({ start, end: ends[index] ?? null }));
};

const splitLong = (file) => {
  const duration = probe(file);
  let cursor = 0;
  const chunks = [];
  for (const gap of silences(file, 2.5)) {
    if (gap.start - cursor > 0.4) chunks.push({ start: cursor, end: gap.start });
    cursor = gap.end ?? duration;
  }
  if (duration - cursor > 0.4) chunks.push({ start: cursor, end: duration });
  console.log(`long take split points: ${chunks.map((chunk) => chunk.start.toFixed(2)).join(", ")}`);
  if (chunks.length !== 9) throw new Error(`expected 9 beats separated by 2.5s silence, found ${chunks.length}`);
  const mapped = {};
  chunks.forEach((chunk, index) => {
    const dest = `/tmp/cg-vo-${BEATS[index][1]}.wav`;
    ffmpeg(["-y", "-loglevel", "error", "-i", file, "-ss", chunk.start.toFixed(3), "-to", chunk.end.toFixed(3), dest]);
    mapped[BEATS[index][1]] = dest;
  });
  return mapped;
};

const gabrielSources = () => {
  const dir = join(film, "vo/gabriel");
  if (!existsSync(dir)) return {};
  const files = readdirSync(dir).filter((name) => /\.(mp3|wav|m4a|aac|caf)$/i.test(name));
  const named = {};
  for (const [nn, id] of BEATS) {
    const hit = files.find((name) => name.toLowerCase().startsWith(`${nn}-${id}`));
    if (hit) named[id] = join(dir, hit);
  }
  if (Object.keys(named).length === 9) return named;
  if (files.length === 1 && Object.keys(named).length === 0) return splitLong(join(dir, files[0]));
  return named;
};

const windowOf = (file) => {
  const duration = probe(file);
  const gaps = silences(file, 0.15);
  let start = 0;
  let end = duration;
  if (gaps[0] && gaps[0].start <= 0.05 && gaps[0].end != null) start = gaps[0].end;
  const last = gaps.at(-1);
  if (last && (last.end == null || duration - last.end < 0.08) && last.start > 0.3) end = last.start;
  return { start: Math.max(0, start - 0.2), end: Math.min(duration, end + 0.2) };
};

const estimateWords = (text, seconds) => {
  const raw = text.split(/\s+/).filter(Boolean);
  const weights = raw.map((word) => Math.max(1, word.replace(/[^A-Za-z0-9']/g, "").length));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = seconds * 0.02;
  const usable = seconds * 0.96;
  return raw.map((word, index) => {
    const slice = (weights[index] / total) * usable;
    const start = cursor;
    cursor += slice;
    return { text: word, start: round(start), end: round(start + slice * 0.92) };
  });
};

const round = (value) => Math.round(value * 1000) / 1000;

const wordsFromCaptions = (output) => {
  const { captions } = toCaptions({ whisperCppOutput: output });
  const words = [];
  for (const caption of captions) {
    const text = caption.text.replace(/\s+/g, " ");
    if (!text.trim()) continue;
    const start = round(caption.startMs / 1000);
    const end = round(caption.endMs / 1000);
    if (text.startsWith(" ") || words.length === 0) words.push({ text: text.trim(), start, end });
    else {
      words.at(-1).text += text.trim();
      words.at(-1).end = end;
    }
  }
  return words;
};

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

const waitForWhisper = async () => {
  const bin = join(root, "whisper/main");
  const model = join(root, `whisper/ggml-${MODEL}.bin`);
  const deadline = Date.now() + 20 * 60 * 1000;
  while (Date.now() < deadline) {
    if (existsSync(bin) && existsSync(model)) return;
    await sleep(3000);
  }
  throw new Error("whisper.cpp or the English model was not ready");
};

const active = join(root, "public/vo/active");
mkdirSync(active, { recursive: true });
const sources = gabrielSources();
const vo = {};

for (const [, id] of BEATS) {
  const scratch = join(root, "public/vo/scratch", `${id}.wav`);
  const input = sources[id] ?? scratch;
  if (!existsSync(input)) throw new Error(`no voice-over for ${id}`);
  const output = join(active, `${id}.wav`);
  const span = windowOf(input);
  const length = Math.max(0.3, span.end - span.start);
  ffmpeg([
    "-y", "-loglevel", "error", "-i", input,
    "-ss", span.start.toFixed(3), "-t", length.toFixed(3),
    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
    "-ar", "48000", "-ac", "1", output,
  ]);
  const seconds = round(probe(output));
  vo[id] = {
    source: sources[id] ? "gabriel" : "scratch",
    file: `vo/active/${id}.wav`,
    seconds,
    words: estimateWords(lines[id], seconds),
  };
  console.log(`${id}: ${vo[id].source} ${seconds.toFixed(2)}s`);
}

const voPath = join(root, "src/data/vo.json");
writeFileSync(voPath, `${JSON.stringify(vo, null, 1)}\n`);
console.log("VO_ESTIMATE_READY");

await waitForWhisper();
for (const [, id] of BEATS) {
  const input = join(active, `${id}.wav`);
  const pcm = `/tmp/cg-vo-16k-${id}.wav`;
  ffmpeg(["-y", "-loglevel", "error", "-i", input, "-ar", "16000", "-ac", "1", pcm]);
  const output = await transcribe({
    inputPath: pcm,
    whisperPath: join(root, "whisper"),
    whisperCppVersion: WHISPER,
    model: MODEL,
    tokenLevelTimestamps: true,
    language: "en",
    printOutput: false,
    additionalArgs: ["--prompt", PROMPT],
  });
  const words = wordsFromCaptions(output);
  if (words.length) vo[id].words = words;
  console.log(`${id}: ${words.length} whisper words`);
}

writeFileSync(voPath, `${JSON.stringify(vo, null, 1)}\n`);
console.log("VO_WHISPER_READY");
