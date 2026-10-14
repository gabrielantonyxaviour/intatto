export type MinuteBar = {t: number; o: number; h: number; l: number; c: number};
export type ChartPalette = {line: string; loss: string; muted: string; steel: string; text: string; hairline: string};
export const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function chartGeometry(bars: readonly MinuteBar[], width: number, height: number) {
  if (bars.length < 2 || width < 300 || height < 180) throw new Error('Chart needs bars and usable dimensions');
  if (bars.some((b, i) => ![b.t, b.o, b.h, b.l, b.c].every(Number.isFinite) || (i > 0 && b.t <= bars[i - 1].t))) {
    throw new Error('Bars must contain finite OHLC values in increasing timestamp order');
  }
  const split = bars.findIndex((b, i) => i > 0 && b.t - bars[i - 1].t > 3600);
  if (split < 1) throw new Error('Expected separated Friday and Monday sessions');
  const friday = bars.slice(0, split), monday = bars.slice(split);
  const left = 76, right = width - 30, top = 64, bottom = height - 70;
  const span = right - left;
  const gapLeft = left + span * .40, gapRight = left + span * .57;
  const minimum = Math.floor(Math.min(...bars.map((b) => b.l)) / 5) * 5;
  const maximum = Math.ceil(Math.max(...bars.map((b) => b.h)) / 5) * 5;
  const y = (price: number) => bottom - (price - minimum) / (maximum - minimum) * (bottom - top);
  const sessionX = (t: number, session: readonly MinuteBar[], a: number, b: number) =>
    a + (t - session[0].t) / Math.max(1, session[session.length - 1].t - session[0].t) * (b - a);
  const friPoints = friday.map((b) => [sessionX(b.t, friday, left, gapLeft), y(b.c)]);
  // Monday's opening print is explicitly the bar's open, not its minute close.
  const monPoints = [[gapRight, y(monday[0].o)], ...monday.map((b) => [sessionX(b.t, monday, gapRight, right), y(b.c)])];
  const path = (points: number[][]) => points.map(([x, v], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${v.toFixed(2)}`).join(' ');
  return {left, right, top, bottom, gapLeft, gapRight, y, minimum, maximum,
    fridayPath: path(friPoints), mondayPath: path(monPoints),
    close: friday[friday.length - 1].c, open: monday[0].o,
    ticks: Array.from({length: (maximum - minimum) / 5 + 1}, (_, i) => minimum + i * 5)};
}
