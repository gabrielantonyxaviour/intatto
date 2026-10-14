import { interpolate } from "remotion";
import { ease, FPS } from "../theme";
import { beat } from "../script";
import { cueFrame } from "../ui/Caption";

/** Spoken-word anchors (scratch estimate from script.ts v5.3; they re-time with the VO and throw if the words change). */
const cue = (phrase: string) => cueFrame(beat(8).vo, Math.round(beat(8).seconds * FPS), phrase);
const ONCHAIN = cue("The price comes onchain");
const CHECK = cue("check it against the pool");
const PRODUCTION = cue("For production");
const VERIFIABLE = cue("fully verifiable");
const LEND = cue("We only lend");
const ABSORB = cue("absorb in a sale");

/** Beat 08 cue sheet (29 s): the price check → into one post: the Chainlink report → back out: the depth cap. */
export const T = {
  line: [16, 84] as const,
  band: [76, 120] as const,
  posts: [ONCHAIN, CHECK - 12] as const, // 23 posts land one after another
  widest: [CHECK, CHECK + 30] as const,
  irisIn: [PRODUCTION - 10, PRODUCTION + 22] as const, // a circle opens out of the widest post
  report: PRODUCTION + 14,
  verify: VERIFIABLE - 6,
  irisOut: [LEND - 36, LEND - 6] as const,
  morph: [LEND - 2, LEND + 42] as const,
  budget: [LEND + 34, LEND + 60] as const,
  pick: LEND + 66,
  cap: ABSORB - 10,
} as const;

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Zoom to the number that matters: the widest post, held into the dive toward that post. The depth cap reads at full
 * frame (no push), so the budget line and the sale sizes stay in view. Returns [scale, fx, fy] in frame px.
 */
export const pushAt = (f: number, a: { x: number; y: number }, dot: { x: number; y: number }) => {
  const before = f < T.irisIn[1] ? 1 : 0;
  const kA = interpolate(f, T.widest, [0, 1], { ...c, easing: ease.inOut }) * before;
  const dive = interpolate(f, T.irisIn, [0, 1], { ...c, easing: ease.inOut }) * before;
  const ax = a.x + (dot.x - a.x) * dive;
  const ay = a.y + (dot.y - a.y) * dive;
  return { s: 1 + 0.45 * kA + 2.2 * dive, fx: 960 + (ax - 960) * kA, fy: 540 + (ay - 540) * kA };
};

/**
 * The circle that opens the report out of the post, holds it full frame, and closes back into the post. The origin
 * follows the post while opening, then the frame is simply covered; closing shrinks into the post at rest.
 */
export const iris = (f: number, openAt: { x: number; y: number }, closeAt: { x: number; y: number }) => {
  const cover = (o: { x: number; y: number }) => Math.hypot(Math.max(o.x, 1920 - o.x), Math.max(o.y, 1080 - o.y)) + 8;
  if (f < T.irisIn[1]) return { r: interpolate(f, [T.irisIn[0] + 8, T.irisIn[1]], [0, cover(openAt)], { ...c, easing: ease.inOut }), o: openAt };
  if (f < T.irisOut[0]) return { r: Infinity, o: openAt };
  return { r: interpolate(f, T.irisOut, [cover(closeAt), 0], { ...c, easing: ease.inOut }), o: closeAt };
};
