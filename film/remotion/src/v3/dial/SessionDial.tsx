import type { CSSProperties, FC } from "react";
import { interpolate } from "remotion";
import { font } from "../theme";
import { useTone } from "../tone";
import { clockLabel, DAY, dayIndex, daySegments, phaseAt, sessionAt, WEEK, WEEKEND_START, type ArcSegment } from "./session";

export type SessionDialProps = {
  /** ET minutes since Monday 00:00 (see session.ts). Drives everything. */
  etMinutes: number;
  /** Ring diameter in px. */
  size: number;
  /** Centre of the dial in frame px (use the same point as ThemeFlip's origin). */
  x: number;
  y: number;
  /** 0 → 1 draw-on: ring, then arcs and ticks, then labels. */
  reveal?: number;
  /** Hour ticks and 00/06/12/18 labels outside the ring. Off for small dials. */
  hours?: boolean;
  /** Centre text: `FRI 16:00 ET`, the session, the day pips. */
  labels?: boolean;
  /** Clock rounding in minutes, so digits don't flicker on fast runs. */
  clockStep?: number;
  /**
   * 0 → 1: how far the day's arcs have emptied once the weekend starts (the whole ring goes to a hairline).
   * Defaults to a fade over the first two ET hours of the weekend; drive it by frame to sync with a ThemeFlip.
   */
  closedFade?: number;
  style?: CSSProperties;
};

const TAU = Math.PI * 2;
const angleOf = (minuteOfDay: number) => (minuteOfDay / DAY) * TAU - Math.PI / 2;
const point = (r: number, minuteOfDay: number) => ({ x: Math.cos(angleOf(minuteOfDay)) * r, y: Math.sin(angleOf(minuteOfDay)) * r });

function arcPath(r: number, from: number, to: number): string {
  const a = point(r, from);
  const b = point(r, to);
  const large = to - from > DAY / 2 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

const ramp = (v: number, a: number, b: number) =>
  interpolate(v, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** The motif: a 24-hour ring in New York time, midnight at the top, clockwise. */
export const SessionDial: FC<SessionDialProps> = ({
  etMinutes,
  size,
  x,
  y,
  reveal = 1,
  hours = true,
  labels = true,
  clockStep = 1,
  closedFade,
  style,
}) => {
  const tone = useTone();
  const r = size / 2;
  const box = size * 1.36;
  const minute = ((etMinutes % DAY) + DAY) % DAY;
  const day = dayIndex(etMinutes);
  const ring = ramp(reveal, 0, 0.55);
  const arcs = ramp(reveal, 0.3, 0.85);
  const text = ramp(reveal, 0.6, 1);
  const shown = arcs * DAY;

  const drawDay = (d: number, opacity: number) =>
    opacity <= 0.001 ? null : (
      <g key={d} opacity={opacity}>
        {daySegments(d).map((seg: ArcSegment) => {
          const to = Math.min(seg.to, shown);
          if (to <= seg.from) return null;
          const thick = seg.phase === "open";
          return (
            <path
              key={`${seg.from}-${seg.phase}`}
              d={arcPath(r, seg.from, to)}
              fill="none"
              stroke={tone.ink}
              strokeWidth={thick ? size * 0.034 : size * 0.007}
              strokeDasharray={seg.phase === "overnight" ? `${size * 0.004} ${size * 0.011}` : undefined}
              strokeLinecap="butt"
            />
          );
        })}
      </g>
    );

  // Day change: the new day's arcs fade in over its first hour, the old day's fade out.
  const blend = ramp(minute, 0, 60);
  const inWeekend = phaseAt(etMinutes) === "weekend";
  const sinceClose = (((etMinutes - WEEKEND_START) % WEEK) + WEEK) % WEEK;
  const empty = inWeekend ? (closedFade ?? ramp(sinceClose, 0, 120)) : 0;
  const needle = point(r, minute);
  const tick = size * 0.018;
  const session = sessionAt(etMinutes);

  return (
    <div
      style={{
        position: "absolute",
        left: x - box / 2,
        top: y - box / 2,
        width: box,
        height: box,
        ...style,
      }}
    >
      <svg width={box} height={box} viewBox={`${-box / 2} ${-box / 2} ${box} ${box}`} style={{ overflow: "visible" }}>
        <circle
          r={r}
          fill="none"
          stroke={tone.hairline}
          strokeWidth={Math.max(1.5, size * 0.004)}
          pathLength={1}
          strokeDasharray={`${ring} 1`}
          transform="rotate(-90)"
        />
        {drawDay((day + 6) % 7, (1 - blend) * (1 - empty))}
        {drawDay(day, blend * (1 - empty))}
        {hours
          ? Array.from({ length: 24 }, (_, h) => {
              const major = h % 6 === 0;
              const a = point(r + size * 0.03, h * 60);
              const b = point(r + size * 0.03 + (major ? tick * 1.4 : tick), h * 60);
              return (
                <line
                  key={h}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={major ? tone.muted : tone.hairline}
                  strokeWidth={major ? 2 : 1.5}
                  opacity={arcs}
                />
              );
            })
          : null}
        {hours
          ? [0, 6, 12, 18].map((h) => {
              const p = point(r + size * 0.1, h * 60);
              return (
                <text
                  key={h}
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily={font.mono}
                  fontSize={Math.max(16, size * 0.03)}
                  fill={tone.muted}
                  opacity={text}
                >
                  {String(h).padStart(2, "0")}
                </text>
              );
            })
          : null}
        <g opacity={ring}>
          <line
            x1={needle.x * 0.8}
            y1={needle.y * 0.8}
            x2={needle.x * 1.07}
            y2={needle.y * 1.07}
            stroke={tone.ink}
            strokeWidth={Math.max(2, size * 0.006)}
            strokeLinecap="round"
          />
          <circle cx={needle.x} cy={needle.y} r={size * 0.022} fill={tone.ink} stroke={tone.bg} strokeWidth={size * 0.008} />
        </g>
      </svg>
      {labels ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            opacity: text,
            gap: size * 0.028,
          }}
        >
          <div style={{ fontFamily: font.mono, fontSize: size * 0.058, color: tone.ink, fontVariantNumeric: "tabular-nums" }}>
            {clockLabel(etMinutes, clockStep)}
          </div>
          <div
            style={{
              fontFamily: font.sans,
              fontWeight: 600,
              fontSize: size * 0.042,
              letterSpacing: "0.14em",
              color: session === "CLOSED" ? tone.muted : tone.ink,
            }}
          >
            {session}
          </div>
          <DayPips day={day} size={size} />
        </div>
      ) : null}
    </div>
  );
};

const DayPips: FC<{ day: number; size: number }> = ({ day, size }) => {
  const tone = useTone();
  const d = Math.max(9, size * 0.02);
  return (
    <div style={{ display: "flex", gap: d * 1.2, marginTop: size * 0.01, alignItems: "center" }}>
      {Array.from({ length: 7 }, (_, i) => {
        const current = i === day;
        const weekend = i >= 5;
        return (
          <div
            key={i}
            style={{
              width: d,
              height: d,
              borderRadius: d,
              boxSizing: "border-box",
              background: current ? tone.ink : "transparent",
              border: `${Math.max(1.5, d * 0.16)}px solid ${current ? tone.ink : weekend ? tone.hairline : tone.muted}`,
              scale: current ? 1.25 : 1,
            }}
          />
        );
      })}
    </div>
  );
};
