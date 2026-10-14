import { interpolate } from "remotion";
import { et, keyedClock } from "../dial/session";
import { ease, FPS } from "../theme";
import { beat } from "../script";
import { cueFrame } from "../ui/Caption";
import { keyedCamera, WEEK_VIEW } from "../week/camera";

/**
 * Beat 07 cue sheet (24 s, VO v5.3). The January 2025 week → the camera finds Fri 24 → Mon 27 → Friday's line draws
 * along the strip → the playhead crosses the empty weekend → Monday's open turns the frame white → −12.47% →
 * the weekend collapses → Monday draws → price becomes LTV → push to 59.57%.
 */
/** Beat 06's strip sits at y 540; ours settles at 830 under the chart. */
export const STRIP_FROM = 540;
export const STRIP_Y = 830;
export const PLOT = { x: 160, y: 250, w: 1600, h: 420 } as const;

/** Spoken-word anchors (scratch estimate from script.ts; they re-time with the VO and throw if the words change). */
const cue = (phrase: string) => cueFrame(beat(7).vo, Math.round(beat(7).seconds * FPS), phrase);
const JAN = cue("In January 2025");
const OPENED = cue("NVIDIA opened");
/** The playhead crosses the weekend as he says it; Friday draws before that (at least 36 frames of it). */
const OVER = Math.min(Math.max(cue("over a weekend"), 132), OPENED - 24);
const REPLAYED = cue("Replayed on our fork");
const SIXTY = cue("about sixty percent");
const THRESHOLD = cue("sixty-five percent");
const NOBODY = cue("nobody gets liquidated");

export const T = {
  // Beat 06 ends on the black week (WEEK_VIEW, strip at y 540, playhead SAT 08:00): hold it, rewind the clock,
  // and switch the week to January 2025 on his words.
  hold: 10,
  rewind: [10, JAN - 10] as const,
  jan: JAN - 4, // day labels become 20–27 Jan as the title lands
  title: [JAN - 4, JAN + 14] as const,
  strip: [JAN - 4, JAN + 30] as const, // the strip glides down to make room for the chart
  titleSettle: [JAN + 30, JAN + 66] as const,
  friday: [Math.min(JAN + 70, OVER - 40), OVER] as const,
  weekend: [OVER, OPENED - 2] as const, // the playhead crosses Fri 16:00 → Mon 09:30
  open: OPENED + 2, // Monday 09:30: flip, connector
  warp: [OPENED + 8, OPENED + 48] as const, // the empty weekend collapses right away, so the gap reads at its size
  gap: [OPENED + 34, OPENED + 66] as const,
  push: [OPENED + 48, OPENED + 84] as const,
  pull: [REPLAYED - 6, REPLAYED + 28] as const,
  monday: [Math.min(REPLAYED + 14, SIXTY - 60), SIXTY - 30] as const,
  morph: [SIXTY - 24, SIXTY + 16] as const,
  settle: SIXTY + 22,
  threshold: [THRESHOLD - 24, THRESHOLD + 6] as const,
  focus: [THRESHOLD + 10, THRESHOLD + 50] as const,
  none: NOBODY - 2,
} as const;

const FRI_NOON = et(4, 12);
const FRI_4PM = et(4, 16);
const MON_OPEN = et(7, 9, 30);
const MON_4PM = et(7, 16);

export const SAT_0800 = et(5, 8, 0);
export const clock = keyedClock([
  [0, SAT_0800], [T.hold, SAT_0800], [T.rewind[1], FRI_NOON], [T.friday[0], FRI_NOON], [T.friday[1], FRI_4PM], [T.weekend[1], MON_OPEN], [T.monday[0], MON_OPEN], [T.monday[1], MON_4PM],
]);

/** Fri 24 12:00 → Mon 27 16:00 fills ~1600 px at this zoom (4,560 minutes). */
const SPAN = { focus: (FRI_NOON + MON_4PM) / 2, zoom: 2.1 };
export const camera = keyedCamera([
  [0, WEEK_VIEW], [T.titleSettle[0] - 6, WEEK_VIEW],
  [T.titleSettle[0] + 20, { focus: SPAN.focus, zoom: 1.35 }], [T.titleSettle[1] + 10, SPAN],
]);

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const stripY = (f: number) => interpolate(f, T.strip, [STRIP_FROM, STRIP_Y], { ...c, easing: ease.inOut });

export const warpAt = (f: number) => interpolate(f, T.warp, [0, 1], { ...c, easing: ease.inOut });
export const morphAt = (f: number) => interpolate(f, T.morph, [0, 1], { ...c, easing: ease.inOut });

/** Unix time the line has been drawn to at frame f (it follows the playhead; nothing is drawn in the weekend). */
export const drawnTo = (f: number, t: { T0: number; FRI_LAST: number; MON_FIRST: number; MON_LAST: number }) => {
  if (f < T.friday[0]) return t.T0 - 1;
  if (f <= T.friday[1]) return interpolate(f, T.friday, [t.T0, t.FRI_LAST], { ...c, easing: ease.inOut });
  if (f < T.monday[0]) return t.FRI_LAST;
  return interpolate(f, T.monday, [t.MON_FIRST, t.MON_LAST], { ...c, easing: ease.inOut });
};

/**
 * A screen push on top of the WeekCamera: [scale, focus x, focus y] in frame px. In on the gap, back out, then in
 * on the loan's peak against the threshold.
 */
export const push = (f: number, gapX: number, gapY: number, endX: number, endY: number) => {
  const inGap = interpolate(f, [T.push[0], T.push[1], T.pull[0], T.pull[1]], [0, 1, 1, 0], { ...c, easing: ease.inOut });
  const inEnd = interpolate(f, T.focus, [0, 1], { ...c, easing: ease.inOut });
  const drift = interpolate(f, [T.focus[1], T.focus[1] + 150], [0, 0.03], c);
  const scale = 1 + 0.32 * inGap + (0.34 + drift) * inEnd;
  const fx = 960 + (gapX - 960) * inGap + (endX - 960) * inEnd;
  const fy = 540 + (gapY - 540) * inGap + (endY - 540) * inEnd;
  return { scale, fx, fy };
};
