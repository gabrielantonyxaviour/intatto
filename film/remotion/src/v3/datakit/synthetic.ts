import run from "../../motion/data/recorded-run.json";

/** The sandbox's synthetic run (recorded-run.json): a made-up crash, not market data. Strings kept as recorded. */
const s = run.synthetic;
export const SYN = {
  crashPercent: s.crashPercent, // 45
  slices: s.slices, // 1
  soldWnvdax: Number(s.soldWnvdax), // 19.966
  receivedUsdg: Number(s.receivedUsdg), // 2037.58
  floorHeld: s.floorHeld,
  reserveBefore: Number(s.reserveBeforeUsdg), // 149.10
  reserveAfter: Number(s.reserveAfterUsdg), // 0.00
  lenderLoss: Number(s.lenderLossUsdg), // 147.69
  shareBefore: Number(s.shareBefore), // 1.000008
  shareAfter: Number(s.shareAfter), // 0.997054
  shareChangePercent: Number(s.shareChangePercent), // −0.2954
} as const;
