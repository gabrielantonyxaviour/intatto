import { Easing, interpolate } from "remotion";
import { enter } from "../theme";
import { T } from "./look";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const out = Easing.bezier(0.16, 1, 0.3, 1);

export type Rect = { x: number; y: number; w: number; h: number };

/** The chat column: no window, just messages over the light, like iMessage full-screen. */
export const COL = { x: 520, w: 880 } as const;
export const COMPOSER: Rect = { x: COL.x, y: 852, w: COL.w, h: 72 };
export const DOCK: Rect = { x: COL.x + 8, y: 786, w: 468, h: 50 };
export const CARD: Rect = { x: 560, y: 346, w: 800, h: 300 };

const GAP = 14;
const TOP = 112;

/** Messages top to bottom. `in`/`out` are the frames each one's slot opens and (for the typing dots) closes. */
export const MSG = {
  ask: { h: 82, in: T.sendAt, w: 712, side: "right" as const },
  dots: { h: 64, in: T.thinkAt, out: T.callAt, w: 112, side: "left" as const },
  tool: { h: 96, in: T.callAt, w: 700, side: "left" as const },
  answer: { h: 476, in: T.answerAt, w: 700, side: "left" as const },
};
export type MsgKey = keyof typeof MSG;
const ORDER: MsgKey[] = ["ask", "dots", "tool", "answer"];

/** The answer card grows a row at a time, on the word that names it, so it is never an empty box. */
export const ANSWER_HEAD = 200;
export const ROW_H = 58;
export const answerHeight = (frame: number) =>
  ANSWER_HEAD + T.rows.reduce((h, at) => h + enter(frame, at - 6, 20) * ROW_H, 0) + enter(frame, T.rows[3] + 12, 18) * 56;

/** 0 → 1 as a message's slot opens (and back to 0 as the typing dots give way to the tool call). */
export const presence = (frame: number, key: MsgKey) => {
  const m = MSG[key];
  const open = interpolate(frame, [m.in, m.in + 16], [0, 1], { ...clamp, easing: out });
  const close = "out" in m ? interpolate(frame, [m.out, m.out + 12], [1, 0], { ...clamp, easing: out }) : 1;
  return open * close;
};

/**
 * Where every message sits at `frame`. The conversation is anchored to the composer like iMessage: each new slot
 * opens at the bottom and pushes the ones above it up.
 */
export const layout = (frame: number): Record<MsgKey, Rect> => {
  const floor = interpolate(frame, [T.callAt, T.callAt + 24], [DOCK.y - 20, COMPOSER.y - 24], clamp);
  let y = TOP;
  const tops: Partial<Record<MsgKey, number>> = {};
  for (const k of ORDER) {
    tops[k] = y;
    y += presence(frame, k) * ((k === "answer" ? answerHeight(frame) : MSG[k].h) + GAP);
  }
  const scroll = y - GAP - floor;
  const rects = {} as Record<MsgKey, Rect>;
  for (const k of ORDER) {
    const m = MSG[k];
    const x = m.side === "right" ? COL.x + COL.w - m.w : COL.x;
    rects[k] = { x, y: (tops[k] ?? TOP) - scroll, w: m.w, h: k === "answer" ? answerHeight(frame) : m.h };
  }
  return rects;
};

export const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  w: a.w + (b.w - a.w) * t,
  h: a.h + (b.h - a.h) * t,
});
