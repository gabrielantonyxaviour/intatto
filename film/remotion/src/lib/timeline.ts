import { EDL } from "../data/edl";
import { TAKES } from "../data/takes";
import type { BeatId, FootageBeat, Focus, LabelKind, Segment } from "../data/types";
import { cueSeconds, VO } from "./cues";
import { CLOSE_TAIL, FPS, LEAD, SCENE_FADE, TAIL } from "../theme";
import { BEATS } from "../data/types";

const XFADE = 4;
const MIN_SEG = 0.4;

export type TimedSegment = {
  index: number;
  take: string;
  mark: string;
  url: string;
  label: LabelKind;
  with?: LabelKind;
  rate: number;
  oldUi: boolean;
  placeholder: boolean;
  src: string;
  sourceStart: number;
  startFrame: number;
  endFrame: number;
  sequenceFrom: number;
  sequenceDur: number;
  fadeIn: number;
  fadeOut: boolean;
  trimBefore: number;
  focus?: Focus;
};

export function tailOf(beat: BeatId): number {
  return beat === "close" ? CLOSE_TAIL : TAIL;
}

export function sceneSeconds(beat: BeatId): number {
  return LEAD + VO[beat].seconds + tailOf(beat);
}

export function sceneFrames(beat: BeatId): number {
  return Math.max(1, Math.round(sceneSeconds(beat) * FPS));
}

export function filmFrames(): number {
  const body = BEATS.reduce((sum, beat) => sum + sceneFrames(beat), 0);
  return body - SCENE_FADE * (BEATS.length - 1);
}

export function beatStartFrame(beat: BeatId): number {
  let frame = 0;
  for (const id of BEATS) {
    if (id === beat) return frame;
    frame += sceneFrames(id) - SCENE_FADE;
  }
  return frame;
}

type Hit = { time: number; oldUi: boolean; seconds: number };

function lookup(take: string, mark: string): Hit | null {
  const file = TAKES[take];
  if (!file || file.marks[mark] == null) return null;
  return { time: file.marks[mark], oldUi: file.oldUi, seconds: file.seconds };
}

function timeBeat(beat: FootageBeat): TimedSegment[] {
  const spec = EDL[beat];
  const starts = spec.map((seg) => (seg.cue ? LEAD + cueSeconds(beat, seg.cue) : 0));
  for (let i = 1; i < starts.length; i++) {
    if (starts[i] < starts[i - 1] + MIN_SEG) starts[i] = starts[i - 1] + MIN_SEG;
  }
  const last = sceneFrames(beat);
  const startFrames = starts.map((sec) => Math.round(sec * FPS));
  const endFrames = spec.map((_, i) =>
    i + 1 < spec.length ? Math.max(startFrames[i] + 1, Math.round(starts[i + 1] * FPS)) : last,
  );

  let prevTake: string | null = null;
  let prevEnd: number | null = null;
  return spec.map((seg, index) =>
    realize(seg, index, startFrames[index], endFrames[index], index < spec.length - 1, () => ({
      prevTake,
      prevEnd,
      note(take: string, end: number | null) {
        prevTake = take;
        prevEnd = end;
      },
    })),
  );
}

function realize(
  seg: Segment,
  index: number,
  startFrame: number,
  endFrame: number,
  fadeOut: boolean,
  continuity: () => {
    prevTake: string | null;
    prevEnd: number | null;
    note: (take: string, end: number | null) => void;
  },
): TimedSegment {
  const link = continuity();
  const primary = lookup(seg.take, seg.mark);
  let take = seg.take;
  let mark = seg.mark;
  let url = seg.url;
  let hit = primary;
  if (!hit && seg.fallback) {
    const alt = lookup(seg.fallback.take, seg.fallback.mark);
    if (alt) {
      hit = alt;
      take = seg.fallback.take;
      mark = seg.fallback.mark;
      url = seg.fallback.url ?? url;
    }
  }
  const rate = seg.rate ?? 1;
  const fadeIn = index === 0 ? 0 : XFADE;
  const sequenceFrom = Math.max(0, startFrame - fadeIn);
  const sequenceDur = Math.max(1, endFrame - sequenceFrom);
  const visible = Math.max(1 / FPS, (endFrame - startFrame) / FPS);
  let sourceStart = 0;
  if (hit) {
    sourceStart = hit.time + (seg.offset ?? 0);
    if (seg.continue && link.prevTake === take && link.prevEnd != null) {
      sourceStart = link.prevEnd;
    }
  }
  const trimBefore = Math.max(0, Math.round(sourceStart * FPS - fadeIn * rate));
  link.note(take, hit ? sourceStart + visible * rate : null);
  return {
    index,
    take,
    mark,
    url,
    label: seg.label,
    with: seg.with,
    rate,
    oldUi: hit?.oldUi ?? false,
    placeholder: !hit,
    src: `takes/${take}.mp4`,
    sourceStart,
    startFrame,
    endFrame,
    sequenceFrom,
    sequenceDur,
    fadeIn,
    fadeOut,
    trimBefore,
    focus: seg.focus,
  };
}

export const TIMELINE: Record<FootageBeat, TimedSegment[]> = {
  what: timeBeat("what"),
  mainnet: timeBeat("mainnet"),
  saturday: timeBeat("saturday"),
  proof: timeBeat("proof"),
  replay: timeBeat("replay"),
  synthetic: timeBeat("synthetic"),
  agents: timeBeat("agents"),
};

export function labelsFor(segments: TimedSegment[]): LabelKind[] {
  const first = segments[0];
  if (!first) return [];
  return first.with ? [first.label, first.with] : [first.label];
}
