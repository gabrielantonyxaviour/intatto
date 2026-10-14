import type { FC } from "react";
import { interpolate } from "remotion";
import { maxLtvAt, WEEK, WEEKEND_END, WEEKEND_START, DAYS, DAY, clockLabel } from "../dial/session";
import { font, RED } from "../theme";
import { useTone } from "../tone";

/** The week's max new-borrow LTV as a step line, with the fixed 65% line. Geometry is shared with Beat03. */
export const CHART = { left: 200, right: 1720, zero: 880, pxPerPct: (880 - 497) / 65 } as const;
export const chartX = (etMinutes: number) => CHART.left + (etMinutes / WEEK) * (CHART.right - CHART.left);
export const chartY = (pct: number) => CHART.zero - pct * CHART.pxPerPct;

function stepPath(): string {
  const pts: string[] = [];
  let prev = maxLtvAt(0);
  pts.push(`M ${chartX(0).toFixed(1)} ${chartY(prev).toFixed(1)}`);
  for (let t = 10; t <= WEEK; t += 10) {
    const v = maxLtvAt(Math.min(t, WEEK - 1));
    if (Math.abs(v - prev) > 1) pts.push(`L ${chartX(t).toFixed(1)} ${chartY(prev).toFixed(1)}`);
    pts.push(`L ${chartX(t).toFixed(1)} ${chartY(v).toFixed(1)}`);
    prev = v;
  }
  return pts.join(" ");
}

function weekendPath(): string {
  const pts: string[] = [];
  for (let t = WEEKEND_START; t <= WEEKEND_END - 10; t += 10)
    pts.push(`${pts.length ? "L" : "M"} ${chartX(t).toFixed(1)} ${chartY(maxLtvAt(t)).toFixed(1)}`);
  return pts.join(" ");
}

const STEP = stepPath();
const WEEKEND = weekendPath();
const ramp = (v: number, a: number, b: number) =>
  interpolate(v, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

export type WeekChartProps = {
  /** 0 → 1: axes and the weekend band. */
  frameIn: number;
  /** 0 → 1: the step line draws left to right. */
  draw: number;
  /** 0 → 1: the weekend part of the line and band come forward, the weekdays recede. */
  weekend: number;
  /** ET minutes for the cursor, and its 0 → 1 appearance. */
  cursorEt: number;
  cursor: number;
};

export const WeekChart: FC<WeekChartProps> = ({ frameIn, draw, weekend, cursorEt, cursor }) => {
  const tone = useTone();
  const bandL = chartX(WEEKEND_START);
  const bandR = chartX(WEEKEND_END);
  const cx = chartX(cursorEt);
  const cy = chartY(maxLtvAt(cursorEt));
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <rect
        x={bandL}
        y={chartY(76)}
        width={bandR - bandL}
        height={CHART.zero - chartY(76)}
        fill={tone.wash}
        opacity={frameIn}
      />
      <text
        x={(bandL + bandR) / 2}
        y={chartY(65) + 46}
        textAnchor="middle"
        fontFamily={font.mono}
        fontSize={20}
        letterSpacing="0.08em"
        fill={tone.muted}
        opacity={frameIn}
      >
        WEEKEND · CLOSED
      </text>
      <line
        x1={CHART.left}
        x2={CHART.left + (CHART.right - CHART.left) * frameIn}
        y1={CHART.zero}
        y2={CHART.zero}
        stroke={tone.hairline}
        strokeWidth={1.5}
      />
      {DAYS.map((d, i) => (
        <text
          key={d}
          x={chartX(i * DAY + DAY / 2)}
          y={CHART.zero + 40}
          textAnchor="middle"
          fontFamily={font.mono}
          fontSize={20}
          fill={i >= 5 ? tone.muted : tone.ink}
          opacity={ramp(frameIn, i / 10, i / 10 + 0.4)}
        >
          {d}
        </text>
      ))}
      {[20, 30, 40, 50].map((p) => (
        <g key={p} opacity={frameIn}>
          <line
            x1={CHART.left}
            x2={CHART.right}
            y1={chartY(p)}
            y2={chartY(p)}
            stroke={tone.hairline}
            strokeWidth={1}
            strokeDasharray="2 8"
          />
          <text
            x={CHART.left - 20}
            y={chartY(p)}
            textAnchor="end"
            dominantBaseline="central"
            fontFamily={font.mono}
            fontSize={18}
            fill={tone.muted}
          >
            {p}%
          </text>
        </g>
      ))}
      <path
        d={STEP}
        fill="none"
        stroke={tone.ink}
        strokeWidth={4}
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={`${draw} 1`}
        opacity={1 - weekend * 0.55}
      />
      <path
        d={WEEKEND}
        fill="none"
        stroke={tone.ink}
        strokeWidth={4 + weekend * 3}
        strokeLinecap="round"
        opacity={weekend}
      />
      <g opacity={cursor}>
        <line
          x1={cx}
          x2={cx}
          y1={chartY(60)}
          y2={CHART.zero}
          stroke={tone.ink}
          strokeWidth={1.5}
          strokeDasharray="4 6"
        />
        <circle cx={cx} cy={cy} r={9} fill={tone.ink} stroke={tone.bg} strokeWidth={4} />
        <text x={cx - 16} y={cy + 44} textAnchor="end" fontFamily={font.mono} fontSize={22} fill={tone.ink}>
          {clockLabel(cursorEt, 30)} · {maxLtvAt(cursorEt).toFixed(1)}%
        </text>
      </g>
      <text
        x={CHART.left}
        y={chartY(65) - 18}
        fontFamily={font.mono}
        fontSize={20}
        letterSpacing="0.06em"
        fill={tone.muted}
        opacity={frameIn}
      >
        MAX LTV, NEW BORROWS · ONE WEEK, NEW YORK TIME
      </text>
      <text
        x={CHART.right}
        y={chartY(65) - 18}
        textAnchor="end"
        fontFamily={font.mono}
        fontSize={22}
        fill={RED}
        opacity={frameIn}
      >
        Liquidation 65% · never moves
      </text>
    </svg>
  );
};
