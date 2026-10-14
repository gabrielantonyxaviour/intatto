import { SAFE } from "../theme";
import { LAST_PRICE, T0, T1 } from "./data";

/** Beat 9 (11 s, 330 f): frames and frame-px positions for both shots and the hand-off between them. */

export const Q = {
  x: SAFE.x,
  y: 196,
  typeFrom: 8,
  typeTo: 40,
  requestAt: 42,
  answerAt: 60,
  exitAt: 156,
};

export const CARD = {
  x: SAFE.x,
  y: 452,
  w: 1920 - SAFE.x * 2,
  h: 400,
  pad: 48,
  rowsX: 980,
  rowsRight: 1920 - SAFE.x - 48,
  rowH: 72,
  rowTop: (i: number) => 452 + 44 + i * 76,
  rowsAt: 70,
  revealAt: 72,
  handoffAt: 166,
  exitAt: 162,
};

/** The heartbeat: a trace along a time axis, 12:47:26 → 14:37:26 UTC. */
export const HB = {
  x0: 200,
  x1: 1720,
  base: 660,
  axisAt: 176,
  headFrom: 188,
  headTo: 262,
  h: { price: 150, session: 90, cap: 112 } as Record<string, number>,
};
export const xOf = (t: number) => HB.x0 + ((t - T0) / (T1 - T0)) * (HB.x1 - HB.x0);

/** Where the price tag leaves the card (row 3's value) and where it parks (above the last price spike). */
export const TAG = {
  from: { x: CARD.rowsRight, y: CARD.rowTop(3) + CARD.rowH / 2 },
  to: { x: xOf(LAST_PRICE.t), y: HB.base - HB.h.price - 130 },
  at: 166,
  dur: 32,
};
