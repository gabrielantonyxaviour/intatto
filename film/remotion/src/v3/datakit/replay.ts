import replay from "../../motion/data/nvda-minute-bars.json";
import run from "../../motion/data/recorded-run.json";

/**
 * The DeepSeek weekend replay (Dukascopy NVDA CFD minute bars, Fri 24 Jan 2025 noon → Mon 27 Jan close) and the
 * sandbox loan that rode it. Pure functions of the real data: nothing here is typed in by hand except the loan's
 * opening LTV, which is the sandbox's own rule (checks/fork/lib/scenarios.ts: 50% limit less 50 bps).
 */

export type Bar = { t: number; o: number; h: number; l: number; c: number };

export const BARS: readonly Bar[] = replay.bars;
const split = BARS.findIndex((b, i) => i > 0 && b.t - BARS[i - 1].t > 3600);
if (split < 1) throw new Error("replay: expected separate Friday and Monday sessions");
export const FRIDAY = BARS.slice(0, split);
export const MONDAY = BARS.slice(split);

export const FRIDAY_CLOSE = replay.anchors.fridayClose.c; // 142.596
export const MONDAY_OPEN = replay.anchors.mondayOpen.o; // 124.817
export const MONDAY_CLOSE = MONDAY[MONDAY.length - 1].c; // 118.496
export const GAP_PERCENT = replay.gapPercent; // −12.468…

/** Opened on Friday at the weekday limit: 5000 bps less the sandbox's 50 bps margin. */
export const OPEN_LTV = 49.5;
export const LIQUIDATION = run.replay.liquidationThresholdPercent; // 65
export const LIQUIDATIONS = run.replay.liquidations; // 0
export const TERMINAL_LTV = run.replay.terminalLtvPercent; // 59.57

/** Same debt, same collateral: LTV moves inversely with the price. */
export const ltvAt = (price: number) => (OPEN_LTV * FRIDAY_CLOSE) / price;

/** Horizontal layout: Friday, the weekend band, Monday. Fractions of the plot width, by minutes traded. */
export const GAP_FRACTION = 0.15;
const tradedWidth = 1 - GAP_FRACTION;
export const FRIDAY_END = (tradedWidth * FRIDAY.length) / BARS.length;
export const MONDAY_START = FRIDAY_END + GAP_FRACTION;

export const PRICE_MIN = 115;
export const PRICE_MAX = 146;
export const PRICE_TICKS = [115, 120, 125, 130, 135, 140, 145];

export type Point = { x: number; y: number; price: number; t: number };

/** Every drawn point, x and y as 0..1 fractions (y down). Monday starts on its opening print, not a minute close. */
export const POINTS: readonly Point[] = (() => {
  const y = (p: number) => 1 - (p - PRICE_MIN) / (PRICE_MAX - PRICE_MIN);
  const fri = FRIDAY.map((b, i) => ({ x: (FRIDAY_END * i) / (FRIDAY.length - 1), y: y(b.c), price: b.c, t: b.t }));
  const mon = MONDAY.map((b, i) => ({
    x: MONDAY_START + ((1 - MONDAY_START) * i) / (MONDAY.length - 1),
    y: y(i === 0 ? b.o : b.c),
    price: i === 0 ? b.o : b.c,
    t: b.t,
  }));
  return [...fri, ...mon];
})();

export const priceY = (p: number) => 1 - (p - PRICE_MIN) / (PRICE_MAX - PRICE_MIN);

/** The point under a playhead at fraction x. Inside the weekend band it holds Friday's close (no bars exist). */
export const pointAt = (x: number): Point => {
  if (x <= 0) return POINTS[0];
  if (x < MONDAY_START && x >= FRIDAY_END) return POINTS[FRIDAY.length - 1];
  let i = POINTS.findIndex((p) => p.x >= x);
  if (i < 0) return POINTS[POINTS.length - 1];
  if (i === 0) return POINTS[0];
  const a = POINTS[i - 1];
  const b = POINTS[i];
  if (a.x === b.x || i === FRIDAY.length) return b;
  const k = (x - a.x) / (b.x - a.x);
  return { x, y: a.y + (b.y - a.y) * k, price: a.price + (b.price - a.price) * k, t: k < 0.5 ? a.t : b.t };
};

/** SVG path in a w×h box. */
export const pathOf = (pts: readonly Point[], w: number, h: number) =>
  pts.map((p, i) => `${i ? "L" : "M"}${(p.x * w).toFixed(2)},${(p.y * h).toFixed(2)}`).join(" ");

export const FRIDAY_POINTS = POINTS.slice(0, FRIDAY.length);
export const MONDAY_POINTS = POINTS.slice(FRIDAY.length);

/** "FRI 14:32 ET" for a bar's timestamp (January: ET = UTC−5). */
export const etLabel = (t: number) => {
  const d = new Date((t - 5 * 3600) * 1000);
  const day = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.getUTCDay()];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${hh}:${mm} ET`;
};
