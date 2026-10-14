import scriptJson from "../data/script.json";
import voJson from "../data/vo.json";
import type { BeatId, VoBeat, VoWord } from "../data/types";

type ScriptRow = { id: BeatId; vo: string };

export const SCRIPT = Object.fromEntries(
  (scriptJson as ScriptRow[]).map((row) => [row.id, row.vo]),
) as Record<BeatId, string>;

export const VO = voJson as Record<BeatId, VoBeat>;

const warnings: string[] = [];
const seen = new Set<string>();

export function cueWarnings(): readonly string[] {
  return warnings;
}

function warn(message: string) {
  if (seen.has(message)) return;
  seen.add(message);
  warnings.push(message);
}

export function flatten(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(raw: string): string[] {
  const flat = flatten(raw);
  return flat ? flat.split(" ") : [];
}

const SPELL: Record<string, string[][]> = {
  nvdax: [
    ["n", "v", "d", "a", "x"],
    ["nvda", "x"],
  ],
  usdg: [["u", "s", "d", "g"]],
  okx: [
    ["o", "k", "x"],
    ["ok", "x"],
  ],
  sessionlimit: [["session", "limit"]],
  heres: [["here", "is"]],
  theyre: [["they", "are"]],
  dont: [["do", "not"]],
  cant: [["can", "not"], ["cannot"]],
  lets: [["let", "us"]],
  xstocks: [
    ["ex", "stocks"],
    ["x", "stocks"],
  ],
  onchain: [["on", "chain"]],
};

type Slot = { start: number; end: number; real: boolean };

function consume(token: string, heard: string[], index: number): number | null {
  if (index >= heard.length) return null;
  if (heard[index] === token) return index + 1;
  for (const spelling of SPELL[token] ?? []) {
    if (index + spelling.length > heard.length) continue;
    const fits = spelling.every((part, offset) => heard[index + offset] === part);
    if (fits) return index + spelling.length;
  }
  return null;
}

function align(beat: BeatId): Slot[] {
  const script = tokenize(SCRIPT[beat]);
  const words: VoWord[] = VO[beat]?.words ?? [];
  const heard = words.map((word) => tokenize(word.text)[0] ?? "");
  const slots: Slot[] = script.map(() => ({ start: 0, end: 0, real: false }));
  let cursor = 0;
  for (let i = 0; i < script.length; i++) {
    const direct = consume(script[i], heard, cursor);
    const skipped = consume(script[i], heard, cursor + 1);
    const next = direct ?? (cursor + 1 < heard.length ? skipped : null);
    const from = direct !== null ? cursor : cursor + 1;
    if (next !== null) {
      slots[i] = { start: words[from].start, end: words[next - 1].end, real: true };
      cursor = next;
    }
  }
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].real) continue;
    let prev = i - 1;
    while (prev >= 0 && !slots[prev].real) prev -= 1;
    let next = i + 1;
    while (next < slots.length && !slots[next].real) next += 1;
    const left = prev >= 0 ? slots[prev].end : 0;
    const right = next < slots.length ? slots[next].start : VO[beat].seconds;
    const span = Math.max(1, next - prev);
    const at = prev < 0 ? i + 1 : i - prev;
    const start = left + ((right - left) * (at - 0.5)) / span;
    slots[i] = { start, end: left + ((right - left) * at) / span, real: false };
  }
  return slots;
}

const aligned = new Map<BeatId, Slot[]>();

function slotsFor(beat: BeatId): Slot[] {
  const cached = aligned.get(beat);
  if (cached) return cached;
  const built = align(beat);
  aligned.set(beat, built);
  return built;
}

function phraseAt(script: string[], phrase: string[]): number {
  for (let i = 0; i <= script.length - phrase.length; i++) {
    const hit = phrase.every((token, offset) => script[i + offset] === token);
    if (hit) return i;
  }
  return -1;
}

function estimate(beat: BeatId, phrase: string): number {
  const hay = flatten(SCRIPT[beat]);
  const needle = flatten(phrase);
  const at = hay.indexOf(needle);
  if (at < 0) return 0;
  return (at / Math.max(1, hay.length)) * VO[beat].seconds;
}

/** VO time, in seconds, where `phrase` starts. */
export function cueSeconds(beatId: string, phrase: string): number {
  const beat = beatId as BeatId;
  const script = tokenize(SCRIPT[beat]);
  const needle = tokenize(phrase);
  const at = phraseAt(script, needle);
  if (at < 0) {
    warn(`${beat}: no script match for "${phrase}"`);
    return 0;
  }
  const words = VO[beat]?.words ?? [];
  if (!words.length) {
    warn(`${beat}: no word timings, estimated "${phrase}"`);
    return estimate(beat, phrase);
  }
  const slot = slotsFor(beat)[at];
  if (slot?.real) return slot.start;
  warn(`${beat}: fallback for "${phrase}"`);
  return estimate(beat, phrase);
}
