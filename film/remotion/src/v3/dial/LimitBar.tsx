import type { CSSProperties, FC } from "react";
import { interpolate } from "remotion";
import { font, RED } from "../theme";
import { useTone } from "../tone";
import { LTV } from "./session";

export type LimitBarProps = {
  /** Max new-borrow LTV in percent that drives the FILL (smoothedLtv(clock, frame) for a quick settle on steps). */
  ltv: number;
  /**
   * The NUMBER shown: the true value at this clock time (maxLtvAt(clock(frame))). It never counts through
   * in-between values: it fades in at its settled value and switches exactly when the session does. The weekend
   * decay still reads continuously, because every value on it is real at that time. Pass it. If omitted, the
   * smoothed `ltv` is snapped to a session value (50 / 40 / 30, or the decay below 30) as a fallback.
   */
  value?: number;
  /** Top-left of the bar's track, in frame px. The labels extend ~300 px to the right and ~70 px to the left. */
  x: number;
  y: number;
  /** Track height in px (0% at the bottom, 100% at the top). */
  height: number;
  /** 0 → 1 draw-on: track, then the red line, then the fill and labels. */
  reveal?: number;
  style?: CSSProperties;
};

const W = 22;

const ramp = (v: number, a: number, b: number) =>
  interpolate(v, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

export const formatPct = (v: number) => {
  const whole = Math.abs(v - Math.round(v)) < 0.05;
  return `${whole ? Math.round(v) : v.toFixed(1)}%`;
};

/** Snaps a smoothed fill value to one the contract can actually return (in-between values only exist mid-animation). */
export const settledLtv = (v: number) => (v > 45 ? 50 : v > 35 ? 40 : v > 30 ? 30 : v);

/** Max new-borrow LTV, 0–100%, with the fixed red liquidation line at 65%. */
export const LimitBar: FC<LimitBarProps> = ({ ltv, value, x, y, height, reveal = 1, style }) => {
  const tone = useTone();
  const track = ramp(reveal, 0, 0.45);
  const line = ramp(reveal, 0.3, 0.7);
  const fill = ramp(reveal, 0.5, 1);
  const at = (pct: number) => height * (1 - pct / 100);
  const shown = ltv * fill;
  const lineY = at(LTV.liquidation);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: W, height, ...style }}>
      {/* track */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: W,
          height: height * track,
          opacity: track,
          boxSizing: "border-box",
          border: `1.5px solid ${tone.hairline}`,
          borderRadius: 3,
        }}
      />
      {/* scale */}
      {[0, 100].map((p) => (
        <div
          key={p}
          style={{
            position: "absolute",
            right: W + 16,
            top: at(p) - 11,
            fontFamily: font.mono,
            fontSize: 18,
            lineHeight: "22px",
            color: tone.muted,
            opacity: track,
            whiteSpace: "nowrap",
          }}
        >
          {p}%
        </div>
      ))}
      {/* fill */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: W,
          height: (height * shown) / 100,
          background: tone.ink,
          borderRadius: 3,
        }}
      />
      {/* value, riding the top of the fill */}
      <div
        style={{
          position: "absolute",
          left: W + 28,
          top: at(shown) - 30,
          opacity: fill,
          translate: `0px ${(1 - fill) * 12}px`,
          whiteSpace: "nowrap",
        }}
      >
        <div style={{ fontFamily: font.mono, fontSize: 48, lineHeight: "60px", color: tone.ink, fontVariantNumeric: "tabular-nums" }}>
          {formatPct(value ?? settledLtv(ltv))}
        </div>
        <div style={{ fontFamily: font.sans, fontSize: 20, fontWeight: 500, color: tone.muted, marginTop: 2 }}>max LTV, new borrows</div>
      </div>
      {/* the liquidation line: fixed */}
      <div
        style={{
          position: "absolute",
          left: -10,
          top: lineY - 1.5,
          height: 3,
          width: (W + 20 + 250) * line,
          background: RED,
          borderRadius: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: W + 28,
          top: lineY - 60,
          opacity: line,
          whiteSpace: "nowrap",
        }}
      >
        <div style={{ fontFamily: font.mono, fontSize: 22, lineHeight: "28px", color: RED }}>Liquidation 65%</div>
        <div style={{ fontFamily: font.sans, fontSize: 20, lineHeight: "24px", color: tone.muted }}>never moves</div>
      </div>
    </div>
  );
};
