import type { Segment } from "../footage/Footage";
import type { Cam, Key } from "../uibeats/camera";

/**
 * Beat 4 shot sheet: every footage cue, camera key and page coordinate in one place, so a re-shoot on the new
 * layout only touches this file. Page px are the recorded 1440×900 CSS px (measured on the 25 Sep takes).
 */
const navAt = 136;
/** The row hold ends here: the source speeds up (3.3×) under the camera's travel to the Contracts tab. */
const contractsAt = 206;
/** Cut to the settled "source code verified" state (the tab re-skeletons once at ~35.5 s; we start after it). */
const verifiedAt = 270;
const END = 330;
const rowRun = 1; // continuous source: 1× on the row, then 3× to the tab click, no jump in between
const fastRate = 3.3;

export const B4 = {
  navAt,
  contractsAt,
  verifiedAt,
  borrow: [{ at: 0, dur: navAt + 14, take: "borrow-mainnet", mark: "collateral", offset: -1.0 }] as Segment[],
  explorer: [
    // The borrow row: the cursor arrives on its method pill at `borrow-row`.
    { at: navAt, dur: contractsAt - navAt, take: "explorer", mark: "borrow-row", offset: -0.9, rate: rowRun },
    // The same run continues at 3.3×: over the From address, across to the Contracts tab, the click.
    {
      at: contractsAt,
      dur: verifiedAt - contractsAt,
      take: "explorer",
      mark: "borrow-row",
      offset: -0.9 + ((contractsAt - navAt) / 30) * rowRun,
      rate: fastRate,
    },
    { at: verifiedAt, dur: END - verifiedAt, take: "explorer", mark: "contracts-tab", offset: 3.6 },
  ] as Segment[],
  camera: [
    [0, { zoom: 1, x: 720, y: 450 }],
    [30, { zoom: 1, x: 1000, y: 380 }],
    [100, { zoom: 1.9, x: 1004, y: 336 }],
    [126, { zoom: 1.96, x: 1004, y: 340 }],
    [148, { zoom: 1, x: 720, y: 600 }],
    [186, { zoom: 1.5, x: 560, y: 640 }],
    [contractsAt, { zoom: 1.56, x: 560, y: 632 }],
    [verifiedAt - 6, { zoom: 1.45, x: 540, y: 470 }],
    [verifiedAt + 40, { zoom: 2.2, x: 400, y: 560 }],
    [END, { zoom: 2.26, x: 400, y: 560 }],
  ] as Key<Cam>[],
  boxes: {
    collateral: { x: 684, y: 277, w: 640, h: 24 },
    debt: { x: 684, y: 361, w: 640, h: 24 },
    row: { x: 104, y: 634, w: 1230, h: 28 },
    verified: { x: 106, y: 522, w: 224, h: 24 },
  },
  facts: { collateral: 76, borrowed: 100, tx: 166, verified: verifiedAt + 8 },
} as const;
