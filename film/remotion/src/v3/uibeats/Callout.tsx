import type { CSSProperties, FC, ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { enter, font, GREEN, size, tracking } from "../theme";
import { useTone } from "../tone";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * A fact lifted out of the footage into the film's own type: a quiet label, the value in mono, an optional
 * sub-line. Rises in at `at`; from `dimAt` it steps back to grey so the next fact takes focus.
 */
export const Callout: FC<{
  at: number;
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  valueSize?: number;
  dimAt?: number;
  style?: CSSProperties;
}> = ({ at, label, value, sub, valueSize = 44, dimAt, style }) => {
  const frame = useCurrentFrame();
  const tone = useTone();
  const k = enter(frame, at, 20);
  const kSub = enter(frame, at + 6, 20);
  const dim = dimAt === undefined ? 0 : interpolate(frame, [dimAt, dimAt + 16], [0, 1], clamp);
  return (
    <div style={{ opacity: k * (1 - 0.55 * dim), translate: `0px ${(1 - k) * 18}px`, ...style }}>
      <div style={{ fontFamily: font.sans, fontSize: size.label, fontWeight: 500, color: tone.muted, lineHeight: "30px" }}>{label}</div>
      <div
        style={{
          fontFamily: font.mono,
          fontSize: valueSize,
          lineHeight: 1.2,
          color: tone.ink,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: tracking.mono,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
      {sub ? (
        <div
          style={{
            opacity: kSub,
            marginTop: 6,
            fontFamily: font.mono,
            fontSize: size.source,
            lineHeight: 1.4,
            color: tone.muted,
            whiteSpace: "nowrap",
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};

/** A vector check in a circle (no font glyphs), stroked on over `dur` frames from `at`. */
export const Tick: FC<{ at: number; px?: number; color?: string; dur?: number }> = ({ at, px = 28, color = GREEN, dur = 14 }) => {
  const frame = useCurrentFrame();
  const ring = enter(frame, at, dur);
  const mark = enter(frame, at + dur * 0.5, dur);
  return (
    <svg width={px} height={px} viewBox="0 0 28 28" style={{ flex: "none", display: "block" }}>
      <circle cx={14} cy={14} r={12.5} fill={color} opacity={ring} />
      <path
        d="M8.2 14.4 L12.2 18.2 L19.8 10.2"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={`${mark} 1`}
      />
    </svg>
  );
};

/** The recorded pages are white in both tones, so marks drawn on a page use the page's own ink. */
const PAGE_INK = "#0A0A0A";

/**
 * An outline drawn on around a region of a recorded page, in page px (render it inside FloatingFrame, over the
 * footage). `scale` is the page's on-screen scale (camera.pageScale) so the stroke stays `stroke` px on screen.
 */
export const PageBox: FC<{
  at: number;
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
  color?: string;
  stroke?: number;
  until?: number;
}> = ({ at, x, y, w, h, scale, color, stroke = 2, until }) => {
  const frame = useCurrentFrame();
  const draw = enter(frame, at, 22);
  const out = until === undefined ? 1 : interpolate(frame, [until, until + 10], [1, 0], clamp);
  if (draw <= 0 || out <= 0) return null;
  const sw = stroke / scale;
  const pad = 6 / scale;
  return (
    <svg
      style={{ position: "absolute", left: x - pad, top: y - pad, overflow: "visible", opacity: out }}
      width={w + pad * 2}
      height={h + pad * 2}
    >
      <rect
        x={sw / 2}
        y={sw / 2}
        width={w + pad * 2 - sw}
        height={h + pad * 2 - sw}
        rx={6 / scale}
        fill="none"
        stroke={color ?? PAGE_INK}
        strokeWidth={sw}
        pathLength={1}
        strokeDasharray={`${draw} 1`}
      />
    </svg>
  );
};
