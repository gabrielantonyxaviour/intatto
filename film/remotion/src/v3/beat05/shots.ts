import { et, keyedClock, WEEKEND_START, type Clock } from "../dial/session";
import type { Segment } from "../footage/Footage";
import type { Cam, Key } from "../uibeats/camera";

/**
 * Beat 5 shot sheet (24 s, 720 f): every footage cue, camera key, dial pose and page coordinate. A re-shoot on
 * the new layout only touches this file. Page px are the recorded 1440×900 CSS px (weekend take, 25 Sep).
 */

// The sandbox chain clock, as the footage shows it: Fri 25 Sep 11:01:08 UTC = 07:01:08 ET, then "Jump to
// Saturday" lands on Sat 26 Sep 12:00:04 UTC = 08:00:04 ET.
const FRIDAY = et(4, 7, 1 + 8 / 60);
const SATURDAY = et(5, 8, 4 / 60);

export const T = {
  click: 242, // "Jump to Saturday" pressed (source 74.45 s)
  spin: [270, 330] as const,
  settle: 380, // SAT 08:00 held 1.7 s, then the dial parks in the corner
  frameBack: 410, // the Saturday window rises once the dial has cleared its path
  refused: 556, // the stamp lands just after the page shows "Refused: SessionLimit" (source 92.7 s = f551)
  repay: 614, // dissolve to the repay, after the stamp has fully lifted off
  repaid: 658, // "Repaid 100.00 USDG" (source 110.8 s at 3×)
  end: 720,
};

/** Real time until the spin (one second per 30 frames), then an eased run to Saturday 08:00. */
const spinClock = keyedClock([
  [T.spin[0], FRIDAY + T.spin[0] / 1800],
  [T.spin[1], SATURDAY],
]);
export const clock: Clock = (f) => (f < T.spin[0] ? FRIDAY + f / 1800 : spinClock(f));

/** The frame the needle enters the weekend: the flip starts here. */
export const FLIP_AT = (() => {
  for (let f = T.spin[0]; f <= T.spin[1]; f++) if (clock(f) >= WEEKEND_START) return f;
  return T.spin[1];
})();

/** Dial poses [frame, {x, y, size}]: centre stage → corner → centre for the spin → corner. */
export const DIAL: Key<{ x: number; y: number; size: number }>[] = [
  [0, { x: 960, y: 470, size: 460 }],
  [62, { x: 960, y: 470, size: 460 }],
  [100, { x: 1640, y: 330, size: 200 }],
  [T.click + 10, { x: 1640, y: 330, size: 200 }],
  [T.click + 40, { x: 720, y: 500, size: 540 }],
  [T.settle, { x: 720, y: 500, size: 540 }],
  [T.settle + 32, { x: 1640, y: 330, size: 200 }],
];

/** The page window, centre-left; the corner dial and the facts sit to its right. */
export const WINDOW = { x: 840, y: 560, width: 1180 };

// Source seconds (weekend take). The page is idle from 71.7 s to 73.0 s (cursor parked on the nav), so that
// stretch is slowed to fill the hold invisibly; the move to the button and the press play at 1×.
const idleFrom = 71.7;
const idleTo = 73.0;
const idleStart = 78;
const idleEnd = 198;
export const SANDBOX: Segment[] = [
  { at: idleStart, dur: idleEnd - idleStart, take: "weekend", mark: "saturday-click", offset: idleFrom - 73.063, rate: (idleTo - idleFrom) / ((idleEnd - idleStart) / 30) },
  { at: idleEnd, dur: T.click + 30 - idleEnd, take: "weekend", mark: "saturday-click", offset: idleTo - 73.063 },
];
export const BORROW: Segment[] = [{ at: T.frameBack, dur: T.repay + 14 - T.frameBack, take: "weekend", mark: "refused", offset: 88.0 - 92.704 }];
export const REPAY: Segment[] = [
  // Review → Repay → confirmed, at 3× under the dissolve and the camera move.
  { at: T.repay, dur: 52, take: "weekend", mark: "repaid", offset: 106.6 - 110.781, rate: 3 },
  { at: T.repay + 52, dur: T.end - T.repay - 52, take: "weekend", mark: "repaid", offset: 106.6 + (52 / 30) * 3 - 110.781 },
];

export const CAM_SANDBOX: Key<Cam>[] = [
  [idleStart, { zoom: 1, x: 720, y: 300 }],
  [104, { zoom: 1, x: 420, y: 330 }],
  [176, { zoom: 1.7, x: 430, y: 330 }],
  [idleEnd, { zoom: 1.72, x: 430, y: 340 }],
  [T.click - 8, { zoom: 2, x: 300, y: 860 }],
  [T.click + 30, { zoom: 2.1, x: 300, y: 870 }],
];
export const CAM_BORROW: Key<Cam>[] = [
  [T.frameBack, { zoom: 1.5, x: 376, y: 430 }],
  [456, { zoom: 1.55, x: 376, y: 450 }],
  [532, { zoom: 1.62, x: 376, y: 690 }],
  [T.repay, { zoom: 1.66, x: 376, y: 700 }],
  [T.repay + 40, { zoom: 1.7, x: 300, y: 760 }],
  [T.end, { zoom: 1.78, x: 300, y: 770 }],
];

export const BOX = {
  fork: { x: 110, y: 306, w: 400, h: 108 }, // Parent network … Fork block 71,563,431
  closed: { x: 118, y: 428, w: 504, h: 22 }, // CLOSED session · max new-borrow LTV 28.12%
  repaid: { x: 112, y: 776, w: 236, h: 46 }, // Repaid 100.00 USDG · Confirmed 0xc291d2…44a1ff
};
