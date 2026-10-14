import { FRIDAY, FRIDAY_CLOSE, FRIDAY_END, GAP_FRACTION, ltvAt, MONDAY, MONDAY_OPEN, MONDAY_START, OPEN_LTV, priceY } from "../datakit/replay";

/**
 * Beat 07's axes. Bars are placed in the WeekTimeline's time (ET minutes from Mon 20 Jan 2025 00:00) so the chart
 * grows out of the strip; `packed` then collapses the 65 hours with no bars into one band so both sessions fill the
 * plot. Vertically, `morph` 0 plots price and 1 the loan's LTV (same debt, same collateral: 49.5 × 142.596 / price).
 */
const MON20 = Date.parse("2025-01-20T00:00:00-05:00") / 1000;
export const etOf = (unix: number) => (unix - MON20) / 60;

const T0 = FRIDAY[0].t;
const FRI_LAST = FRIDAY[FRIDAY.length - 1].t;
const MON_FIRST = MONDAY[0].t;
const MON_LAST = MONDAY[MONDAY.length - 1].t;

/** 0..1 across the plot with the weekend collapsed (the same layout as the v3 replay chart). */
export const packed = (t: number) => {
  if (t <= FRI_LAST) return (FRIDAY_END * (t - T0)) / (FRI_LAST - T0);
  if (t >= MON_FIRST) return MONDAY_START + ((1 - MONDAY_START) * (t - MON_FIRST)) / (MON_LAST - MON_FIRST);
  return FRIDAY_END + (GAP_FRACTION * (t - FRI_LAST)) / (MON_FIRST - FRI_LAST);
};

export const LTV_MIN = 45;
export const LTV_MAX = 70;
/** LTV on the plot's vertical scale: 45% at the bottom, 70% at the top. */
export const ltvY = (ltv: number) => 1 - (ltv - LTV_MIN) / (LTV_MAX - LTV_MIN);

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export type Bar = { t: number; price: number; y: number };

export const fridayBars = (): Bar[] => FRIDAY.map((b) => ({ t: b.t, price: b.c, y: priceY(b.c) }));

/** Monday from its opening print; y morphs from price to LTV. */
export const mondayBars = (morph: number): Bar[] =>
  MONDAY.map((b, i) => {
    const price = i === 0 ? b.o : b.c;
    return { t: b.t, price, y: lerp(priceY(price), ltvY(ltvAt(price)), morph) };
  });

/** Friday's close: 142.60 in price, and the loan's opening 49.5% in LTV. */
export const closeY = (morph: number) => lerp(priceY(FRIDAY_CLOSE), ltvY(OPEN_LTV), morph);
export const openY = (morph: number) => lerp(priceY(MONDAY_OPEN), ltvY(ltvAt(MONDAY_OPEN)), morph);

export const TIMES = { T0, FRI_LAST, MON_FIRST, MON_LAST } as const;

export const DAY_LABELS = ["MON 20 JAN", "TUE 21 JAN", "WED 22 JAN", "THU 23 JAN", "FRI 24 JAN", "SAT 25 JAN", "SUN 26 JAN", "MON 27 JAN"];
