import type { CSSProperties, FC } from "react";
import { interpolate } from "remotion";
import { clockLabel, DAY, DAYS, daySegments, sessionAt } from "../dial/session";
import { font, WIDTH } from "../theme";
import { useTone } from "../tone";
import { xOf, type WeekCamera } from "./camera";

export type WeekTimelineProps = {
  /** Where the camera looks and how far it's zoomed (see keyedCamera). */
  camera: WeekCamera;
  /** Vertical centre of the strip in frame px. */
  y?: number;
  /** Height of the regular-session blocks in px. */
  band?: number;
  /** The "now" marker, in ET minutes (omit to hide). */
  playhead?: number;
  /** Clock rounding for the playhead label (minutes). */
  clockStep?: number;
  /** 0 → 1: the strip draws on left to right. */
  reveal?: number;
  /** Which days exist, [first, last] day index inclusive (0 = the first Monday). Default one week, [0, 6]. */
  days?: readonly [number, number];
  /** Day label for day index k (0 = the first Monday, 7 = the next Monday). Defaults to MON … SUN. */
  dayLabel?: (k: number) => string;
  style?: CSSProperties;
};

const ramp = (v: number, a: number, b: number) => interpolate(v, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
const MARGIN = 120;

/**
 * The week as a strip, in New York time: regular sessions are solid blocks, pre-market and after-hours a thin bar,
 * the weekday overnight a dashed line, the weekend (Fri 20:00 → Sun 20:00) empty. Endless in both directions, so the
 * camera can travel from one week into the next. As the camera zooms, hour ticks and labels emerge.
 */
export const WeekTimeline: FC<WeekTimelineProps> = ({
  camera,
  y = 540,
  band = 56,
  playhead,
  clockStep = 15,
  reveal = 1,
  dayLabel = (k) => DAYS[((k % 7) + 7) % 7],
  days: range = [0, 6],
  style,
}) => {
  const tone = useTone();
  const span = WIDTH / 2 / (camera.zoom * (1680 / (7 * DAY)));
  const firstDay = Math.max(range[0], Math.floor((camera.focus - span) / DAY) - 1);
  const lastDay = Math.min(range[1], Math.ceil((camera.focus + span) / DAY) + 1);
  const x = (t: number) => xOf(t, camera);
  const left = Math.max(-40, x(range[0] * DAY));
  const right = Math.min(x((range[1] + 1) * DAY), WIDTH + 40);
  const drawTo = interpolate(reveal, [0, 1], [left, right]);
  const days = [];
  for (let k = firstDay; k <= lastDay; k++) days.push(k);
  const hourStep = camera.zoom < 7 ? 6 : camera.zoom < 16 ? 3 : 1;
  const hoursK = ramp(camera.zoom, 3, 5.5);
  const clip = (a: number, b: number) => [Math.max(a, left), Math.min(b, drawTo)] as const;

  return (
    <div style={{ position: "absolute", inset: 0, ...style }}>
      <svg width={WIDTH} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <line x1={left} x2={drawTo} y1={y} y2={y} stroke={tone.hairline} strokeWidth={1.5} />
        {days.map((k) => {
          const base = k * DAY;
          const wd = ((k % 7) + 7) % 7;
          return (
            <g key={k}>
              {daySegments(wd).map((seg) => {
                const [a, b] = clip(x(base + seg.from), x(base + seg.to));
                if (b <= a) return null;
                if (seg.phase === "open")
                  return <rect key={seg.from} x={a} y={y - band / 2} width={b - a} height={band} rx={3} fill={tone.ink} />;
                if (seg.phase === "overnight")
                  return <line key={seg.from} x1={a} x2={b} y1={y} y2={y} stroke={tone.ink} strokeWidth={2} strokeDasharray="3 7" />;
                return <rect key={seg.from} x={a} y={y - 4} width={b - a} height={8} rx={2} fill={tone.ink} />;
              })}
              {x(base) < drawTo ? (
                <line x1={x(base)} x2={x(base)} y1={y - band / 2 - 20} y2={y + band / 2 + 20} stroke={tone.hairline} strokeWidth={1.5} />
              ) : null}
              {hoursK > 0
                ? Array.from({ length: 24 / hourStep }, (_, i) => {
                    const h = i * hourStep;
                    const hx = x(base + h * 60);
                    if (hx < -40 || hx > drawTo || h === 0) return null;
                    return (
                      <g key={h} opacity={hoursK}>
                        <line x1={hx} x2={hx} y1={y + band / 2 + 10} y2={y + band / 2 + 22} stroke={tone.muted} strokeWidth={1.5} />
                        <text x={hx} y={y + band / 2 + 48} textAnchor="middle" fontFamily={font.mono} fontSize={18} fill={tone.muted}>
                          {String(h).padStart(2, "0")}:00
                        </text>
                      </g>
                    );
                  })
                : null}
            </g>
          );
        })}
      </svg>
      {days.map((k) => {
        // Day names sit above the strip and stay pinned inside the frame while their day is on screen.
        const a = x(k * DAY);
        const b = x((k + 1) * DAY);
        if (b < MARGIN || a > WIDTH - MARGIN || (a + b) / 2 > drawTo) return null;
        const cx = Math.min(Math.max((a + b) / 2, MARGIN + 40), WIDTH - MARGIN - 40);
        const weekend = ((k % 7) + 7) % 7 >= 5;
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              left: cx,
              top: y - band / 2 - 62,
              translate: "-50% 0%",
              fontFamily: font.mono,
              fontSize: 22,
              letterSpacing: "0.06em",
              color: weekend ? tone.muted : tone.ink,
              whiteSpace: "nowrap",
            }}
          >
            {dayLabel(k)}
          </div>
        );
      })}
      {playhead !== undefined ? <Playhead x={x(playhead)} y={y} band={band} et={playhead} step={clockStep} /> : null}
    </div>
  );
};

const Playhead: FC<{ x: number; y: number; band: number; et: number; step: number }> = ({ x, y, band, et, step }) => {
  const tone = useTone();
  const text = `${clockLabel(et, step)} · ${sessionAt(et)}`;
  const half = (text.length * 0.6 * 26) / 2; // JetBrains Mono advances 0.6 em
  const labelX = Math.min(Math.max(x, MARGIN + half), WIDTH - MARGIN - half);
  return (
    <>
      <div style={{ position: "absolute", left: x - 1.5, top: y - band / 2 - 30, width: 3, height: band + 60, background: tone.ink, borderRadius: 2 }} />
      <div
        style={{
          position: "absolute",
          left: x - 11,
          top: y - 11,
          width: 22,
          height: 22,
          borderRadius: 11,
          background: tone.ink,
          boxShadow: `0 0 0 5px ${tone.bg}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: labelX,
          top: y + band / 2 + 84,
          translate: "-50% 0%",
          fontFamily: font.mono,
          fontSize: 26,
          color: tone.ink,
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {text}
      </div>
    </>
  );
};
