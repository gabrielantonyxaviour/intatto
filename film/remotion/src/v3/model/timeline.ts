import { FPS } from "../theme";
import { beat } from "../script";
import { cueFrame } from "../ui/Caption";

/** Spoken-word anchors (scratch estimate from script.ts v5.3; they re-time with the VO and throw if the words change). */
const cue = (phrase: string) => cueFrame(beat(9).vo, Math.round(beat(9).seconds * FPS), phrase);
const INTEREST = cue("borrowers pay interest");
const TWENTY = cue("twenty percent");
const MONEY = cue("We make money");
const HALF = cue("half of the five percent");
const X402 = cue("x402");
const SWITCH = cue("once we switch it on");
const EVERY = cue("Every stock");
const NEXT = cue("next stock");
const FORK = cue("NVDAx and SPYx");
const MAINNET = cue("NVDAx on mainnet");

/** Beat 09 cue sheet (20 s): 80/20 → the same split re-weights to the 5% penalty → x402 → isolated markets. */
export const T = {
  source: 6,
  draw: [Math.max(8, INTEREST - 30), INTEREST + 8] as const,
  flow: [INTEREST, TWENTY + 60] as const, // interest: every fifth payment to the reserve
  lenders: cue("eighty percent") - 6,
  reserve: TWENTY - 6,
  penalty: [MONEY - 4, MONEY + 30] as const, // the split re-weights to 50/50
  penaltyFlow: [MONEY + 24, HALF + 60] as const,
  half: HALF - 6,
  request: [X402 - 34, X402 - 4] as const, // the trunk becomes an agent's request
  challenge: X402 + 2,
  off: SWITCH - 4,
  tiles: EVERY + 2,
  next: NEXT - 4,
  fork: FORK - 4,
  mainnet: MAINNET - 2,
} as const;

/** Node geometry of the split, in frame px. */
export const G = {
  source: { x: 260, y: 540 },
  node: { x: 760, y: 540 },
  upper: { x: 1280, y: 360 },
  lower: { x: 1280, y: 740 },
} as const;

/** Four tiles: NVDAx and SPYx on the fork, NVDAx on mainnet, the next stock. */
export const TILE = { w: 380, h: 280, y: 400, xs: [140, 560, 1000, 1400] } as const;
