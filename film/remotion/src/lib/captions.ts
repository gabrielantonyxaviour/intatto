import { BEATS, type BeatId } from "../data/types";
import { cueSeconds, SCRIPT, VO } from "./cues";
import { beatStartFrame } from "./timeline";
import { FPS, LEAD } from "../theme";

const MAX_LINE = 44;

export type CaptionPage = { start: number; end: number; lines: string[] };

function wrap(sentence: string): string[] {
  const words = sentence.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= MAX_LINE) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function pagesOf(script: string): string[][] {
  const sentences = script.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [script];
  const lines = sentences.flatMap((sentence) => wrap(sentence.trim())).filter(Boolean);
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2));
  return pages;
}

const cache = new Map<BeatId, CaptionPage[]>();

export function captionPages(beat: BeatId): CaptionPage[] {
  const hit = cache.get(beat);
  if (hit) return hit;
  const groups = pagesOf(SCRIPT[beat]);
  const starts = groups.map((lines) => cueSeconds(beat, lines[0]));
  for (let i = 1; i < starts.length; i++) {
    if (starts[i] < starts[i - 1] + 0.2) starts[i] = starts[i - 1] + 0.2;
  }
  const lastWord = VO[beat].words.at(-1)?.end ?? VO[beat].seconds;
  const pages = groups.map((lines, i) => ({
    lines,
    start: starts[i],
    end: i + 1 < starts.length ? starts[i + 1] : lastWord,
  }));
  cache.set(beat, pages);
  return pages;
}

function srtStamp(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const r = ms % 1000;
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(r, 3)}`;
}

export function renderSrt(): string {
  const blocks: string[] = [];
  let n = 1;
  for (const beat of BEATS) {
    const origin = beatStartFrame(beat) / FPS + LEAD;
    for (const page of captionPages(beat)) {
      const start = origin + page.start;
      const end = Math.max(start + 0.2, origin + page.end);
      blocks.push(`${n}\n${srtStamp(start)} --> ${srtStamp(end)}\n${page.lines.join("\n")}\n`);
      n += 1;
    }
  }
  return `${blocks.join("\n")}\n`;
}
