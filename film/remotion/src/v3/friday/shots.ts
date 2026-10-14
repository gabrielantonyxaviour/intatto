import { et, keyedClock } from "../dial/session";
import type { Segment } from "../footage/Footage";
import { beatFrames } from "../stage";
import type { Cam, Key } from "../uibeats/camera";
import { said } from "../uibeats/said";
import { keyedCamera, WEEK_VIEW } from "../week/camera";

/**
 * Beat 5 · Friday shot sheet, anchored to Gabriel's words. Footage: take "friday" (fresh fork session, recorded
 * Fri 25 Sep at chain time 17:00 UTC = 13:00 ET, market OPEN). Page px are that take's CSS px.
 */
export const FRI_1300 = et(4, 13, 0);
export const WINDOW = { x: 960, y: 552, width: 1392, height: 870 };
export const END = beatFrames(5);

const W = {
  friday: said(5, "Friday afternoon", 0.9),
  deposit: said(5, "I'm going to deposit", 3.9),
  since: said(5, "Since the market's open", 7.9),
  fifty: said(5, "fifty percent", 10.6),
};

/** The clock reaches Friday 13:00 as he says "Friday afternoon"; the dive opens as he says the market's open. */
const RUN_END = Math.max(40, W.friday + 18);
export const clock = keyedClock([
  [0, et(0, 9, 30)],
  [6, et(0, 9, 30)],
  [RUN_END, FRI_1300],
]);
export const camera = keyedCamera([
  [0, WEEK_VIEW],
  [RUN_END - 10, WEEK_VIEW],
  [RUN_END + 6, { focus: FRI_1300, zoom: 1.6 }],
  [RUN_END + 32, { focus: FRI_1300, zoom: 45 }],
]);
export const DIVE = [RUN_END + 12, RUN_END + 36] as const;

// A: the open screen and the OPEN badge (1×). B: from "deposit": collateral 4 NVDAx, loan 361 USDG; paced so the LTV
// lands at 39.94% (source ≈ 14.0 s) as he says "fifty percent". C: both receipts confirm.
const B_AT = Math.max(DIVE[0] + 30, W.deposit - 4);
const B_RATE = Math.min(2.2, Math.max(1, (14.0 - 6.6) / ((W.fifty - B_AT) / 30)));
export const TO_RECEIPTS = [Math.max(W.fifty + 42, B_AT + 60), Math.max(W.fifty + 52, B_AT + 70)] as const;
export const FORM: Segment[] = [
  { at: DIVE[0], dur: B_AT - DIVE[0], take: "friday", mark: "open", offset: 0.9 - 1.782 },
  { at: B_AT, dur: TO_RECEIPTS[1] - B_AT, take: "friday", mark: "collateral", offset: 6.6 - 6.974, rate: B_RATE },
];
/** "Borrowed 361.00 USDG · Confirmed" (source 29.45 s) lands 26 frames into C; C must end before the dialog is
 *  closed at 32.8 s. Beat 6 opens on this take at RECEIPTS_LAST. */
export const RECEIPTS_FROM = Math.min(29.45 - 26 / 30, 32.6 - (END - TO_RECEIPTS[0]) / 30);
export const RECEIPTS_LAST = RECEIPTS_FROM + (END - TO_RECEIPTS[0]) / 30;
export const RECEIPTS: Segment[] = [{ at: TO_RECEIPTS[0], dur: END - TO_RECEIPTS[0], take: "friday", mark: "borrowed", offset: RECEIPTS_FROM - 29.449 }];

/** Page camera. Top edge stays below the sandbox banner (y 60–100): focus.y − 450/zoom ≥ 104. */
export const LAST_PAGE_CAM: Cam = { zoom: 1.66, x: 720, y: 705 };
export const PAGE_CAM: Key<Cam>[] = [
  [DIVE[0], { zoom: 1.35, x: 380, y: 446 }],
  [B_AT, { zoom: 1.4, x: 380, y: 446 }],
  [B_AT + 36, { zoom: 1.55, x: 350, y: 480 }],
  [Math.max(B_AT + 40, W.fifty - 10), { zoom: 1.8, x: 340, y: 570 }],
  [TO_RECEIPTS[0], { zoom: 1.86, x: 340, y: 575 }],
  [TO_RECEIPTS[1] + 4, { zoom: 1.6, x: 720, y: 700 }],
  [END, LAST_PAGE_CAM],
];

export const BOX = {
  badge: { x: 540, y: 130, w: 52, h: 24 }, // OPEN
  session: { x: 114, y: 436, w: 430, h: 20 }, // OPEN session · max new-borrow LTV 50.00% · liquidation at 65.00%
  ltv: { x: 114, y: 648, w: 524, h: 66 }, // LTV 39.94% · the bar · OPEN max 50.00% (after the loan is typed)
  receipts: { x: 440, y: 734, w: 240, h: 84 }, // Deposited 4 NVDAx · Borrowed 361.00 USDG, both Confirmed (scrollY 20)
};
export const CUES = { badge: DIVE[0] + 26, formEnd: B_AT, session: W.since, ltv: W.fifty, receipts: TO_RECEIPTS[0] + 28 };
