import { Easing, interpolate } from "remotion";
import { WEEK, WEEKEND_END, WEEKEND_START, type Clock } from "../dial/session";
import { WIDTH, type ToneName } from "../theme";

/**
 * WeekTimeline maths. Time is ET minutes since a Monday 00:00 and may run past one week (day 7 = the next Monday),
 * so a beat can travel from a Friday into the following Monday.
 */

/** The camera: which moment sits at the frame's centre, and how magnified the strip is (1 = the whole week). */
export type WeekCamera = { focus: number; zoom: number };

/** Strip width in px at zoom 1: Mon 00:00 → next Mon 00:00 fills this. */
export const STRIP_WIDTH = 1680;
export const PX_PER_MIN = STRIP_WIDTH / WEEK;

/** Screen x of an ET moment under a camera. */
export const xOf = (etMinutes: number, cam: WeekCamera) => WIDTH / 2 + (etMinutes - cam.focus) * PX_PER_MIN * cam.zoom;

/** Camera that shows a whole week (Mon → Sun) centred. */
export const WEEK_VIEW: WeekCamera = { focus: WEEK / 2, zoom: 1 };

/**
 * Keyframed camera `[frame, camera]`. Zoom interpolates in log space (so a 1× → 40× dive feels even), focus
 * linearly; every move eases in and out.
 */
export function keyedCamera(keys: ReadonlyArray<readonly [number, WeekCamera]>, easing = Easing.inOut(Easing.cubic)) {
  const frames = keys.map((k) => k[0]);
  const opts = { easing, extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  return (frame: number): WeekCamera => {
    if (keys.length === 1) return keys[0][1];
    const focus = interpolate(frame, frames, keys.map((k) => k[1].focus), opts);
    const logZoom = interpolate(frame, frames, keys.map((k) => Math.log(k[1].zoom)), opts);
    return { focus, zoom: Math.exp(logZoom) };
  };
}

export type ToneRule = "weekend" | "until-open";

/**
 * White while the market is open, black while it's closed. "weekend" (default) is the contract's CLOSED period,
 * Fri 20:00 → Sun 20:00 ET. "until-open" keeps it black until Monday's 09:30 open (the replay beat's "black turns
 * white at the open").
 */
export function weekToneAt(etMinutes: number, rule: ToneRule = "weekend"): ToneName {
  const t = ((etMinutes % WEEK) + WEEK) % WEEK;
  const end = rule === "until-open" ? WEEK + 570 : WEEKEND_END;
  const inClosed = t >= WEEKEND_START && t < end;
  const pastMidnight = rule === "until-open" && t < 570;
  return inClosed || pastMidnight ? "dark" : "light";
}

export type Crossing = { frame: number; to: ToneName };

/** Frames in [from, to] where the clock's tone changes (the first frame of the new tone). */
export function toneCrossings(clock: Clock, from: number, to: number, rule: ToneRule = "weekend"): Crossing[] {
  const out: Crossing[] = [];
  let prev = weekToneAt(clock(from), rule);
  for (let f = from + 1; f <= to; f++) {
    const tone = weekToneAt(clock(f), rule);
    if (tone !== prev) out.push({ frame: f, to: tone });
    prev = tone;
  }
  return out;
}
