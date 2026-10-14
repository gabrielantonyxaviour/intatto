import type { FC } from "react";
import { interpolate } from "remotion";
import { DAY, daySegments, type ArcSegment } from "../dial/session";
import { ease } from "../theme";
import { useTone } from "../tone";

/**
 * A session ring (the dial: midnight at the top, noon at the bottom) that unrolls into a flat day, then deals out
 * into a week. "token" is lit 24/7 (NVDAx onchain); "stock" is lit only in its session (NVDA on Nasdaq).
 */
export type UnrollProps = {
  kind: "token" | "stock";
  /** Where the ring touches the line (its noon point), and the line's y. */
  ax: number;
  y: number;
  r: number;
  /** The week's extent once dealt out. */
  x0: number;
  width: number;
  /** 0 → 1 ring draw-on. */
  draw: number;
  /** 0 → 1 the ring straightens into one day. */
  unroll: number;
  /** 0 → 1 the days deal out into the week (staggered). */
  spread: number;
  opacity?: number;
};

const STROKE = { open: 14, pre: 4, after: 4, overnight: 2.5 } as const;
const TOKEN_DAY: ArcSegment[] = [{ from: 0, to: DAY, phase: "open" }];

export const Unroll: FC<UnrollProps> = ({ kind, ax, y, r, x0, width, draw, unroll, spread, opacity = 1 }) => {
  const tone = useTone();
  const L0 = 2 * Math.PI * r;
  const k = interpolate(unroll, [0, 1], [0, 1], { easing: ease.inOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const c = ((1 - k) * 2 * Math.PI) / L0;
  const bent = (m: number) => {
    const s = ((m - 720) / DAY) * L0;
    if (c < 1e-6) return { x: ax + s, y };
    return { x: ax + Math.sin(c * s) / c, y: y - (1 - Math.cos(c * s)) / c };
  };
  const dayProgress = (d: number) =>
    interpolate(spread, [d * 0.07, d * 0.07 + 0.58], [0, 1], { easing: ease.inOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const place = (d: number, m: number) => {
    const p = dayProgress(d);
    const flat = bent(m);
    if (p <= 0) return flat;
    const final = x0 + ((d * DAY + m) / (7 * DAY)) * width;
    return { x: interpolate(p, [0, 1], [flat.x, final]), y };
  };
  const segmentsFor = (d: number) => (kind === "token" ? TOKEN_DAY : daySegments(d));
  const shown = draw * DAY;
  const paths: { key: string; d: string; w: number; dashed: boolean }[] = [];
  for (let d = 0; d < 7; d++) {
    if (d > 0 && dayProgress(d) <= 0) continue;
    for (const seg of segmentsFor(d)) {
      const to = d === 0 ? Math.min(seg.to, shown) : seg.to;
      if (to <= seg.from) continue;
      const pts: string[] = [];
      const step = unroll < 1 && d === 0 ? 10 : Math.max(10, to - seg.from);
      for (let m = seg.from; m <= to; m += step) {
        const p = place(d, Math.min(m, to));
        pts.push(`${pts.length ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
      }
      const end = place(d, to);
      pts.push(`L${end.x.toFixed(1)} ${end.y.toFixed(1)}`);
      paths.push({ key: `${d}-${seg.from}`, d: pts.join(" "), w: STROKE[seg.phase], dashed: seg.phase === "overnight" });
    }
  }
  const base = unroll >= 1 && spread > 0;
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible", opacity }}>
      {base ? <line x1={x0} x2={x0 + width * dayProgress(6)} y1={y} y2={y} stroke={tone.hairline} strokeWidth={1.5} /> : null}
      {unroll <= 0 ? (
        <circle cx={ax} cy={y - r} r={r} fill="none" stroke={tone.hairline} strokeWidth={1.5} pathLength={1} strokeDasharray={`${draw} 1`} transform={`rotate(-90 ${ax} ${y - r})`} />
      ) : null}
      {kind === "token" && spread >= 1 ? (
        // Once dealt out, the 24/7 line is one stroke (no seams where the days meet).
        <line x1={x0} x2={x0 + width} y1={y} y2={y} stroke={tone.ink} strokeWidth={STROKE.open} />
      ) : null}
      {(kind === "token" && spread >= 1 ? [] : paths).map((p) => (
        <path key={p.key} d={p.d} fill="none" stroke={tone.ink} strokeWidth={p.w} strokeDasharray={p.dashed ? "3 7" : undefined} strokeLinecap={kind === "token" ? "square" : "butt"} />
      ))}
    </svg>
  );
};
