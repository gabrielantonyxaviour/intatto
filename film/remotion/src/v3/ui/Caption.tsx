import type { FC } from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SCRIPT } from "../script";
import { font, FPS } from "../theme";
import { voCue, voSentences, voWords } from "../vo/voice";
import { useTone } from "../tone";

export type CaptionTiming = { text: string; from: number; to: number };

/**
 * Splits the beat's VO into sentences and spreads them across the beat by character count (a scratch estimate,
 * not word timings): `lead` seconds of silence first, `tail` at the end, a small pause between paragraphs.
 */
/** The beat whose script this VO text is, if any (lets captions and cues use Gabriel's real timings). */
const beatOf = (vo: string[]) => SCRIPT.find((b) => b.vo.length === vo.length && b.vo.every((p, i) => p === vo[i]))?.n;

/** Captions on Gabriel's real timing: the script's sentences, each held until the next begins. */
function realTimings(n: number): CaptionTiming[] {
  const lines = voSentences(n);
  return lines.map((l, i) => ({
    text: l.text,
    from: Math.round(l.from * FPS),
    to: Math.round((i + 1 < lines.length ? lines[i + 1].from : l.to + 0.6) * FPS),
  }));
}

/**
 * Caption timings for a beat's VO: Gabriel's real word timings when the whisper pass has them (src/v3/vo), else a
 * character-count estimate across the beat.
 */
export function scratchTimings(vo: string[], durationInFrames: number, lead = 0.4, tail = 0.8): CaptionTiming[] {
  const n = beatOf(vo);
  if (n && voWords(n).length) return realTimings(n);
  return estimateTimings(vo, durationInFrames, lead, tail);
}

function estimateTimings(vo: string[], durationInFrames: number, lead: number, tail: number): CaptionTiming[] {
  const PARA_PAUSE = 8; // characters' worth of pause between paragraphs
  const items: { text: string; weight: number }[] = [];
  vo.forEach((para, p) => {
    const sentences = para.split(/(?<=[.?!])(?<![ap]\.m\.)\s+/).filter(Boolean);
    sentences.forEach((text, i) => items.push({ text, weight: text.length + (p > 0 && i === 0 ? PARA_PAUSE : 0) }));
  });
  const total = items.reduce((s, it) => s + it.weight, 0);
  const start = lead * FPS;
  const usable = durationInFrames - start - tail * FPS;
  let cursor = start;
  return items.map((it) => {
    const span = (it.weight / total) * usable;
    const from = Math.round(cursor + span - (it.text.length / it.weight) * span);
    cursor += span;
    return { text: it.text, from, to: Math.round(cursor) };
  });
}

/**
 * The frame where `phrase` is spoken, so entrances land on their word: Gabriel's real word timing when available,
 * else a scratch estimate. Throws if the phrase isn't in the VO, so a script change can't silently re-time a beat.
 */
export function cueFrame(vo: string[], durationInFrames: number, phrase: string): number {
  const n = beatOf(vo);
  const real = n ? voCue(n, phrase) : undefined;
  if (real !== undefined) return Math.round(real * FPS);
  for (const line of estimateTimings(vo, durationInFrames, 0.4, 0.8)) {
    const at = line.text.toLowerCase().indexOf(phrase.toLowerCase());
    if (at >= 0) return Math.round(line.from + (at / line.text.length) * (line.to - line.from));
  }
  throw new Error(`cueFrame: "${phrase}" is not in this beat's VO (script.ts). Update the cue phrase.`);
}

/**
 * Scratch captions: the VO lines burnt in a quiet band in the bottom margin, as a timing aid for Gabriel. Pass
 * `show={false}` (the final film) to render nothing. Put it inside the scene so it inverts with a ThemeFlip.
 */
export const ScratchCaptions: FC<{ vo: string[]; show?: boolean; timings?: CaptionTiming[] }> = ({ vo, show = true, timings }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const tone = useTone();
  if (!show) return null;
  const lines = timings ?? scratchTimings(vo, durationInFrames);
  const line = lines.find((l) => frame >= l.from && frame < l.to);
  if (!line) return null;
  const opacity = Math.min(
    interpolate(frame, [line.from, line.from + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(frame, [line.to - 6, line.to], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
  return (
    <div
      style={{
        position: "absolute",
        left: 240,
        right: 240,
        bottom: 30,
        minHeight: 64,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        textAlign: "center",
        fontFamily: font.sans,
        fontSize: 26,
        lineHeight: 1.3,
        fontWeight: 400,
        color: tone.muted,
        opacity,
      }}
    >
      {line.text}
    </div>
  );
};
