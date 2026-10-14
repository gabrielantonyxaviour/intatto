import { et, keyedClock } from "../dial/session";
import type { Segment } from "../footage/Footage";
import { FRI_1300, LAST_PAGE_CAM, RECEIPTS_LAST } from "../friday/shots";
import { beatFrames } from "../stage";
import { said } from "../uibeats/said";
import type { Cam, Key } from "../uibeats/camera";
import { keyedCamera, WEEK_VIEW } from "../week/camera";

/**
 * Beat 6 · Saturday shot sheet, anchored to Gabriel's words. Footage: take "friday" for the first frames (continuing Beat 5), then
 * take "saturday": the same fork session after the clock moved to Sat 26 Sep 12:00 UTC = 08:00 ET (CLOSED).
 * Page px are that take's CSS px; the page scrolls 134 px when the loan field is focused (scrollY 20 → 154).
 */
export const SAT_0800 = et(5, 8, 0);
export const WINDOW = { x: 960, y: 552, width: 1392, height: 870 };

const W = {
  jump: said(6, "jump ahead to Saturday", 0.6),
  saturday: said(6, "Saturday", 1.5),
  closed: said(6, "stock market closed", 3.0),
  lowered: said(6, "lowered my borrowing limit", 4.6),
  tryMore: said(6, "try to borrow a little more", 7.1),
  rejects: said(6, "rejects the transaction", 9.0),
  beforeSign: said(6, "before I even sign", 10.3),
  repaying: said(6, "Repaying still goes through", 12.0),
  reducing: said(6, "reducing your risk", 15.2),
  blocked: said(6, "never blocked", 15.6),
};
const D = beatFrames(6);
const RUN0 = Math.max(40, W.jump);
const RUN1 = Math.max(RUN0 + 30, W.saturday + 14);
const DIVE0 = RUN1 + 6;
const TYPING = Math.max(DIVE0 + 60, W.tryMore - 6);
const REFUSED = Math.max(TYPING + 36, W.rejects + 4);
const REPAY = Math.max(REFUSED + 50, W.repaying - 10);
// The pull-back ends 16 frames early, so the last frames are the bare black week Beat 7 opens on.
const PULL0 = D - 46;

export const T = {
  out: [16, 36] as const, // hold on Friday's receipts, then out
  run: [RUN0, RUN1] as const,
  dive: [DIVE0, DIVE0 + 24] as const,
  typing: TYPING, // cut to the loan field; 10 USDG typed
  refused: REFUSED, // "Refused: SessionLimit" (source 11.79 s) as he says "rejects the transaction"
  stampOff: REPAY - 12,
  repay: REPAY, // the repay form, crossfade
  repaid: REPAY + 40, // the repay dialog; "Repaid 100.00 USDG" lands 24 frames in
  pullOut: [PULL0, PULL0 + 30] as const, // back out to the black week: Beat 7 opens here (playhead Sat 08:00 ET)
  end: D,
};

export const clock = keyedClock([
  [0, FRI_1300],
  [T.run[0], FRI_1300],
  [T.run[1], SAT_0800],
]);
/** Out of Friday; the camera rides the playhead so the week slides under a fixed "now"; in to Saturday; out again. */
export const camera = keyedCamera([
  [0, { focus: FRI_1300, zoom: 45 }],
  [T.out[1], { focus: FRI_1300, zoom: 1.6 }],
  [T.run[0], { focus: FRI_1300, zoom: 1.6 }],
  [T.run[1], { focus: SAT_0800, zoom: 1.6 }],
  [T.run[1] + 26, { focus: SAT_0800, zoom: 45 }],
  [T.pullOut[0], { focus: SAT_0800, zoom: 45 }],
  [T.pullOut[1] + 4, WEEK_VIEW],
]);

/** Beat 5 ends on "friday" at RECEIPTS_LAST (the review dialog with both receipts); this beat continues from it. */
export const FRIDAY: Segment[] = [{ at: 0, dur: 40, take: "friday", mark: "borrowed", offset: RECEIPTS_LAST - 29.449 }];
const S2_FROM = 7.5; // just before the loan field is focused (the page scrolls 134 px here, under the cut)
export const SATURDAY: Segment[] = [
  // CLOSED and the limit line (1×) …
  { at: T.dive[0], dur: T.typing - T.dive[0], take: "saturday", mark: "closed", offset: 0.6 - 1.889 },
  // … cut to the loan field: 10 USDG typed, "Refused: SessionLimit" …
  { at: T.typing, dur: T.refused - T.typing, take: "saturday", mark: "closed", offset: S2_FROM - 1.889, rate: (12.07 - S2_FROM) / ((T.refused - T.typing) / 30) },
  // … and the refusal holds.
  { at: T.refused, dur: T.repay + 10 - T.refused, take: "saturday", mark: "refused", offset: 12.07 - 11.788 },
];
export const REPAY_FORM: Segment[] = [{ at: T.repay, dur: T.repaid + 14 - T.repay, take: "saturday", mark: "repay-typed", offset: 19.6 - 20.38, rate: 2.2 }];
const REPAID_FROM = 42.22 - 24 / 30;
const HALF_AT = Math.min(T.repaid + 150, T.pullOut[0]);
export const REPAID: Segment[] = [
  { at: T.repaid, dur: HALF_AT - T.repaid, take: "saturday", mark: "repaid", offset: REPAID_FROM - 42.223 },
  // The settled receipt at half speed until we pull out (the take ends at 48.1 s).
  { at: HALF_AT, dur: T.pullOut[1] + 2 - HALF_AT, take: "saturday", mark: "repaid", offset: REPAID_FROM + (HALF_AT - T.repaid) / 30 - 42.223, rate: 0.5 },
];

export const PAGE_CAM_FRIDAY: Key<Cam>[] = [[0, LAST_PAGE_CAM]];
export const PAGE_CAM: Key<Cam>[] = [
  [T.dive[0], { zoom: 1.35, x: 380, y: 436 }], // top edge 103: the CLOSED badge (y 111–132) in full, the banner (to y 80) out
  [T.typing - 8, { zoom: 1.45, x: 380, y: 470 }],
  [T.typing + 6, { zoom: 1.45, x: 380, y: 560 }],
  [T.refused, { zoom: 1.5, x: 380, y: 600 }],
  // Cuts: the camera cuts with the footage (no move across a cut).
  [T.repay - 1, { zoom: 1.55, x: 380, y: 604 }],
  [T.repay, { zoom: 1.5, x: 380, y: 430 }],
  [T.repaid - 1, { zoom: 1.53, x: 380, y: 430 }],
  [T.repaid, { zoom: 1.55, x: 720, y: 590 }],
  [T.pullOut[0], { zoom: 1.72, x: 720, y: 620 }],
];

export const BOX = {
  badge: { x: 546, y: 110, w: 58, h: 24 }, // CLOSED (scrollY 20)
  closed: { x: 114, y: 410, w: 494, h: 20 }, // CLOSED session · max new-borrow LTV 28.12% · falls to 20.00% by Mon 16:00 UTC
  nothingSigned: { x: 112, y: 822, w: 468, h: 40 }, // This borrow would take … / Nothing was signed or sent. (scrollY 154; text x 120–571, y 828–858)
  repayNote: { x: 118, y: 380, w: 490, h: 34 }, // Repaying never depends on the price or the market session …
  repaid: { x: 440, y: 666, w: 252, h: 48 }, // Repaid 100.00 USDG · Confirmed
  everySession: { x: 638, y: 570, w: 358, h: 38 }, // "None" + "Repay works in every session, even when borrowing is paused" (measured at 2x: x 642–992, y 574–604)
};
/** Box cues on his words: "stock market closed", "lowered my borrowing limit", "before I even sign", "reducing your risk". */
export const CUES = {
  badge: Math.max(T.dive[1], W.closed),
  closed: Math.max(T.dive[1] + 10, W.lowered),
  nothingSigned: Math.max(T.refused + 6, W.beforeSign),
  repayNote: T.repay + 8,
  repaid: T.repaid + 26,
  everySession: Math.max(T.repaid + 34, W.reducing),
};
/** The stamp lands between the loan error and the refused button (frame px). */
export const STAMP = { x: 800, y: 620 };
