import { Easing, interpolate } from "remotion";

/**
 * Session maths, mirroring the contracts: SessionRiskController (OPEN 50%, EXTENDED 40%, CLOSED 30% → 20% over
 * 64 h from the period change) and checks/fork/lib/clock.ts calendarSession (weekend Fri 20:00 → Sun 20:00 ET is
 * CLOSED; every other hour outside 09:30–16:00 on a weekday is EXTENDED, overnight included).
 *
 * Time is "ET minutes since Monday 00:00", 0 … 10080 (it wraps). Holidays are ignored, as in the sandbox.
 */

export const DAY = 1440;
export const WEEK = 7 * DAY;
export const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

export type Session = "OPEN" | "EXTENDED" | "CLOSED";
/** Finer than Session, for drawing: which part of the day this minute belongs to. */
export type Phase = "open" | "pre" | "after" | "overnight" | "weekend";

export const LTV = { open: 50, extended: 40, closedStart: 30, closedFloor: 20, decayHours: 64, liquidation: 65 } as const;

/** Fri 20:00 ET, where the weekend CLOSED period starts. */
export const WEEKEND_START = 4 * DAY + 20 * 60;
/** Sun 20:00 ET, where it ends. */
export const WEEKEND_END = 6 * DAY + 20 * 60;

/** Build ET minutes from a day index (0 = Mon) and a clock time. */
export const et = (day: number, hours: number, minutes = 0) => day * DAY + hours * 60 + minutes;

const wrap = (t: number) => ((t % WEEK) + WEEK) % WEEK;

export function phaseAt(etMinutes: number): Phase {
  const t = wrap(etMinutes);
  if (t >= WEEKEND_START && t < WEEKEND_END) return "weekend";
  const m = t % DAY;
  if (m >= 570 && m < 960) return "open";
  if (m >= 240 && m < 570) return "pre";
  if (m >= 960 && m < 1200) return "after";
  return "overnight";
}

export function sessionAt(etMinutes: number): Session {
  const p = phaseAt(etMinutes);
  if (p === "open") return "OPEN";
  if (p === "weekend") return "CLOSED";
  return "EXTENDED";
}

/** Max LTV for a new borrow, in percent. Linear CLOSED decay, like `_closedLtv` (which rounds down in bps). */
export function maxLtvAt(etMinutes: number): number {
  const s = sessionAt(etMinutes);
  if (s === "OPEN") return LTV.open;
  if (s === "EXTENDED") return LTV.extended;
  const elapsed = (wrap(etMinutes) - WEEKEND_START) / 60;
  const k = Math.min(1, Math.max(0, elapsed / LTV.decayHours));
  return LTV.closedStart - (LTV.closedStart - LTV.closedFloor) * k;
}

/** 0 = Mon … 6 = Sun. */
export const dayIndex = (etMinutes: number) => Math.floor(wrap(etMinutes) / DAY);

/** `FRI 16:00 ET`. `step` rounds the clock down (e.g. 15) so digits don't flicker on fast runs. */
export function clockLabel(etMinutes: number, step = 1): string {
  const t = wrap(etMinutes);
  const m = Math.floor((t % DAY) / step) * step;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${DAYS[dayIndex(t)]} ${hh}:${mm} ET`;
}

/** A clock is ET minutes as a function of the scene frame. */
export type Clock = (frame: number) => number;

/**
 * A clock through keyframes `[frame, etMinutes]`. Each move eases in and out (a camera-like run); holds are free.
 * ET minutes may exceed WEEK to run past Sunday; everything wraps.
 */
export function keyedClock(keys: ReadonlyArray<readonly [number, number]>, easing = Easing.inOut(Easing.cubic)): Clock {
  const frames = keys.map((k) => k[0]);
  const values = keys.map((k) => k[1]);
  return (frame) =>
    keys.length === 1
      ? values[0]
      : interpolate(frame, frames, values, { easing, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

/**
 * The limit bar's displayed LTV: a causal, frame-weighted average of `maxLtvAt(clock(f))` over the last `window`
 * frames, so a contract step (50 → 40) reads as a quick settle instead of a one-frame jump. Pure in `frame`.
 */
export function smoothedLtv(clock: Clock, frame: number, window = 9): number {
  let sum = 0;
  let weights = 0;
  for (let i = 0; i < window; i++) {
    const w = (window - i) ** 2;
    sum += maxLtvAt(clock(frame - i)) * w;
    weights += w;
  }
  return sum / weights;
}

export type ArcSegment = { from: number; to: number; phase: Exclude<Phase, "weekend"> };

/** The drawable segments of one day (minutes of day, 0…1440), from the same session rules. */
export function daySegments(day: number): ArcSegment[] {
  const out: ArcSegment[] = [];
  const base = day * DAY;
  let current: ArcSegment | null = null;
  for (let m = 0; m < DAY; m += 10) {
    const p = phaseAt(base + m);
    if (p === "weekend") {
      current = null;
      continue;
    }
    if (current && current.phase === p && current.to === m) current.to = m + 10;
    else {
      current = { from: m, to: m + 10, phase: p };
      out.push(current);
    }
  }
  return out;
}
