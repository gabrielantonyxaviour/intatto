import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ease, enter, font, RED } from "../theme";
import { useTone } from "../tone";
import {
  etLabel, FRIDAY_CLOSE, FRIDAY_END, FRIDAY_POINTS, MONDAY_OPEN, MONDAY_POINTS, MONDAY_START, pathOf, pointAt,
  PRICE_TICKS, priceY,
} from "../datakit/replay";
import { drawnTo, T } from "./timeline";

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const mono = (px: number) => ({ fontFamily: font.mono, fontSize: px, fontVariantNumeric: "tabular-nums" as const });
/** A ground-coloured halo so labels stay clean where gridlines pass behind them. */
const halo = (bg: string) => ({ stroke: bg, strokeWidth: 8, paintOrder: "stroke" as const, strokeLinejoin: "round" as const });

/** The real NVDA minute line, Friday afternoon → the weekend band → Monday, drawn by the beat's clock. */
export const Chart: FC<{ w: number; h: number }> = ({ w, h }) => {
  const f = useCurrentFrame();
  const tone = useTone();
  const X = (fr: number) => fr * w;
  const Y = (p: number) => priceY(p) * h;
  const drawn = drawnTo(f);
  const head = pointAt(drawn);
  const onMonday = f >= T.monday[0];
  const headIn = onMonday
    ? enter(f, T.monday[0] - 8, 12) * interpolate(f, [T.monday[1], T.monday[1] + 16], [1, 0], c)
    : enter(f, T.friday[0], 10) * interpolate(f, [T.friday[1] - 6, T.friday[1] + 4], [1, 0], c);
  const band = enter(f, T.band, 22);
  const conn = interpolate(f, T.connector, [0, 1], c);
  const closeIn = enter(f, T.close + 4, 16);
  const openIn = enter(f, T.connector[1] - 4, 16);
  const pulse = interpolate(f, [T.gapPulse[0], T.gapPulse[0] + 6, T.gapPulse[1] + 10], [0, 1, 0], c);
  const gx0 = X(FRIDAY_END);
  const gx1 = X(MONDAY_START);
  const yClose = Y(FRIDAY_CLOSE);
  const yOpen = Y(MONDAY_OPEN);
  const bracketX = gx1 + 26;
  const bracket = interpolate(f, [T.connector[1], T.connector[1] + 18], [0, 1], { ...c, easing: ease.out });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", overflow: "visible" }}>
      <defs>
        <clipPath id="b6-fri"><rect x={-8} y={-40} width={drawn > 0 ? Math.min(drawn, FRIDAY_END) * w + 8 : 0} height={h + 80} /></clipPath>
        <clipPath id="b6-mon"><rect x={gx1 - 8} y={-40} width={Math.max(0, (drawn - MONDAY_START) * w + 8)} height={h + 80} /></clipPath>
        <pattern id="b6-hatch" width={14} height={14} patternUnits="userSpaceOnUse"
          patternTransform={`rotate(45) translate(${(f * 0.25) % 14} 0)`}>
          <line x1={0} y1={0} x2={0} y2={14} stroke={tone.hairline} strokeWidth={2} />
        </pattern>
      </defs>

      {/* price grid, drawn left to right with a small stagger */}
      {PRICE_TICKS.map((p, i) => {
        const k = enter(f, T.grid + i * 3, 22);
        return (
          <g key={p} opacity={k}>
            <line x1={0} x2={w * k} y1={Y(p)} y2={Y(p)} stroke={tone.hairline} strokeWidth={1.5} />
            <text x={-22} y={Y(p) + 7} textAnchor="end" fill={tone.muted} style={mono(20)}
              transform={`translate(0 ${(1 - k) * 10})`}>{p}</text>
          </g>
        );
      })}

      {/* the weekend: no bars exist, so no line is drawn inside it */}
      <g opacity={band}>
        <rect x={gx0} y={0} width={gx1 - gx0} height={h} fill="url(#b6-hatch)" />
        <line x1={gx0} x2={gx0} y1={0} y2={h} stroke={tone.hairline} strokeWidth={1.5} />
        <line x1={gx1} x2={gx1} y1={0} y2={h} stroke={tone.hairline} strokeWidth={1.5} />
        <rect x={(gx0 + gx1) / 2 - 78} y={h - 62} width={156} height={44} rx={6} fill={tone.bg} />
        <text x={(gx0 + gx1) / 2} y={h - 34} textAnchor="middle" fill={tone.muted} style={mono(18)}>WEEKEND</text>
      </g>

      {/* Friday's close carried across the weekend, so the drop reads against it */}
      <line x1={gx0} x2={gx0 + (bracketX + 14 - gx0) * enter(f, T.band + 4, 26)} y1={yClose} y2={yClose}
        stroke={tone.muted} strokeWidth={1.5} strokeDasharray="3 7" opacity={band} />

      <g fill="none" strokeLinejoin="round" strokeLinecap="round">
        <path d={pathOf(FRIDAY_POINTS, w, h)} stroke={tone.ink} strokeWidth={3.5} clipPath="url(#b6-fri)" />
        <line x1={gx0} y1={yClose} x2={gx0 + (gx1 - gx0) * conn} y2={yClose + (yOpen - yClose) * conn}
          stroke={RED} strokeWidth={3} strokeDasharray="8 9" opacity={conn > 0 ? 1 : 0} />
        <line x1={gx0} y1={yClose} x2={gx1} y2={yOpen} stroke={RED} strokeWidth={14} opacity={pulse * 0.28} />
        <path d={pathOf(MONDAY_POINTS, w, h)} stroke={tone.ink} strokeWidth={3.5} clipPath="url(#b6-mon)" />
      </g>

      {/* the gap, measured: close → open */}
      <g opacity={bracket * interpolate(f, [T.monday[0] - 10, T.monday[0] + 6], [1, 0], c)}>
        <line x1={bracketX} x2={bracketX} y1={yClose} y2={yClose + (yOpen - yClose) * bracket} stroke={RED} strokeWidth={2} />
        <line x1={bracketX - 7} x2={bracketX + 7} y1={yClose} y2={yClose} stroke={RED} strokeWidth={2} />
        <line x1={bracketX - 7} x2={bracketX + 7} y1={yOpen} y2={yOpen} stroke={RED} strokeWidth={2} opacity={bracket >= 1 ? 1 : 0} />
      </g>

      {/* Friday close */}
      <g opacity={closeIn} transform={`translate(${gx0} ${yClose})`}>
        <circle r={7 * closeIn} fill={tone.ink} />
        <text x={-18} y={-22} textAnchor="end" fill={tone.ink} style={{ ...mono(26), ...halo(tone.bg) }}>{FRIDAY_CLOSE.toFixed(2)}</text>
        <text x={-18} y={-54} textAnchor="end" fill={tone.muted} style={{ fontFamily: font.sans, fontSize: 20, fontWeight: 500, ...halo(tone.bg) }}>Fri close</text>
      </g>

      {/* Monday open */}
      <g opacity={openIn} transform={`translate(${gx1} ${yOpen})`}>
        <circle r={7 * openIn} fill={RED} />
        <circle r={7 + 22 * pulse} fill="none" stroke={RED} strokeWidth={2} opacity={pulse} />
        <text x={-18} y={42} textAnchor="end" fill={RED} style={{ ...mono(26), ...halo(tone.bg) }}>{MONDAY_OPEN.toFixed(2)}</text>
        <text x={-18} y={72} textAnchor="end" fill={tone.muted} style={{ fontFamily: font.sans, fontSize: 20, fontWeight: 500, ...halo(tone.bg) }}>Mon open</text>
      </g>

      {/* playhead: a drop line to the axis, where the bar's ET time and price ride */}
      <g opacity={headIn}>
        <line x1={X(head.x)} x2={X(head.x)} y1={head.y * h + 18} y2={h + 8} stroke={tone.ink} strokeWidth={1} opacity={0.3} />
        <circle cx={X(head.x)} cy={head.y * h} r={16} fill={tone.ink} opacity={0.14} />
        <circle cx={X(head.x)} cy={head.y * h} r={6.5} fill={tone.ink} />
        <text x={Math.min(w - 118, Math.max(118, X(head.x)))} y={h + 40} textAnchor="middle" fill={tone.muted} style={mono(18)}>
          {etLabel(head.t)} · <tspan fill={tone.ink}>{head.price.toFixed(2)}</tspan>
        </text>
      </g>

      {/* session labels under the axis; each steps aside while the playhead's label passes */}
      <g style={mono(18)} fill={tone.muted}>
        {([[0, "start", "FRI 24 JAN · 12:00", 110], [gx0, "end", "16:00", -30], [gx1, "start", "MON 27 JAN · 09:30", 110], [w, "end", "16:00", -30]] as const).map(
          ([x, anchor, label, mid]) => {
            const near = interpolate(Math.abs(X(head.x) - (x + mid)), [150, 250], [1 - headIn, 1], c);
            return (
              <text key={`${label}${x}`} x={x} y={h + 40} textAnchor={anchor} opacity={enter(f, T.grid + 10, 20) * near}>
                {label}
              </text>
            );
          },
        )}
      </g>
    </svg>
  );
};
