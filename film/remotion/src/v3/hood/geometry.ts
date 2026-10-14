import { BAND_OPEN_BPS, DEPTH, DEPTH_BASE, KEEPER, POSTS } from "../datakit/hood";

/**
 * One plot for the first two ideas, in USDG per wNVDAx. Idea 1 runs along time (09:30 → 10:35 ET) and idea 2 along
 * the size of a sale (0.5 → 1,600 wNVDAx, log): the pool's 30-min average becomes the pool's price for bigger sales.
 */
export const PLOT = { x: 220, y: 320, w: 1480, h: 470 } as const;
export const P_MIN = 215.5;
export const P_MAX = 232.8;

export const yOf = (price: number) => PLOT.y + ((P_MAX - price) / (P_MAX - P_MIN)) * PLOT.h;
export const xOfU = (u: number) => PLOT.x + u * PLOT.w;

const T0 = Date.parse("2026-09-25T09:30:00-04:00") / 1000;
const T1 = Date.parse("2026-09-25T10:36:00-04:00") / 1000;
export const uOfTime = (t: number) => (t - T0) / (T1 - T0);

const L0 = Math.log10(0.5);
const L1 = Math.log10(1600);
export const uOfShares = (s: number) => (Math.log10(s) - L0) / (L1 - L0);

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Piecewise-linear value at u from points sorted by u. Flat beyond the ends. */
const sample = (pts: { u: number; v: number }[], u: number) => {
  if (u <= pts[0].u) return pts[0].v;
  for (let i = 1; i < pts.length; i++) {
    if (u <= pts[i].u) return lerp(pts[i - 1].v, pts[i].v, (u - pts[i - 1].u) / (pts[i].u - pts[i - 1].u));
  }
  return pts[pts.length - 1].v;
};

const twapPts = POSTS.map((p) => ({ u: uOfTime(p.t), v: p.twap }));
const depthPts = DEPTH.map((d) => ({ u: uOfShares(d.shares), v: d.price }));
export const TWAP_SPAN = [twapPts[0].u, twapPts[twapPts.length - 1].u] as const;

/** The morphing line, drawn from u = a to u = b: the TWAP (m = 0) becomes the depth curve (m = 1). */
export const linePath = (m: number, a: number, b: number) => {
  const from = lerp(TWAP_SPAN[0], 0, m);
  const to = lerp(TWAP_SPAN[1], 1, m);
  const s = lerp(from, to, a);
  const e = lerp(from, to, b);
  const N = 90;
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const u = s + ((e - s) * i) / N;
    const y = yOf(lerp(sample(twapPts, Math.min(Math.max(u, TWAP_SPAN[0]), TWAP_SPAN[1])), sample(depthPts, u), m));
    pts.push(`${i ? "L" : "M"}${xOfU(u).toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(" ");
};

/** The ±3% band around the TWAP as a closed shape; `lowOnly` keeps just its lower edge (for the morph). */
export const bandPath = (k: number) => {
  const up = twapPts.map((p) => `${xOfU(p.u).toFixed(1)},${yOf(p.v * (1 + (BAND_OPEN_BPS / 1e4) * k)).toFixed(1)}`);
  const dn = [...twapPts].reverse().map((p) => `${xOfU(p.u).toFixed(1)},${yOf(p.v * (1 - (BAND_OPEN_BPS / 1e4) * k)).toFixed(1)}`);
  return `M${up.join(" L")} L${dn.join(" L")} Z`;
};

/** The keeper's slippage budget: 2% under the smallest sale's price. */
export const BUDGET_PRICE = DEPTH_BASE * (1 - KEEPER.depthSlippageBps / 1e4);
export const depthXY = (shares: number, price: number) => ({ x: xOfU(uOfShares(shares)), y: yOf(price) });

/** Where the depth curve crosses the budget (u), interpolated in log size between the quotes either side. */
export const BUDGET_U = (() => {
  for (let i = 1; i < depthPts.length; i++) {
    const a = depthPts[i - 1];
    const b = depthPts[i];
    if (a.v >= BUDGET_PRICE && b.v < BUDGET_PRICE) return lerp(a.u, b.u, (a.v - BUDGET_PRICE) / (a.v - b.v));
  }
  return 1;
})();
