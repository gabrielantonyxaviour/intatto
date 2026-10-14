import type { FC } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { font, RED } from "../theme";
import { useTone } from "../tone";
import { SourceLine } from "../ui/SourceLine";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * The SessionLimit stamp: the film's one overshoot. It drops from 1.6× onto the page, a spring carries it just
 * past rest and back (under-damped, once), and it lifts off at `until`. Centre (x, y) in frame px.
 */
export const Stamp: FC<{ at: number; until: number; x: number; y: number }> = ({ at, until, x, y }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tone = useTone();
  if (frame < at || frame > until + 14) return null;
  const s = spring({ frame: frame - at, fps, config: { damping: 11, stiffness: 190, mass: 0.8 } });
  const drop = interpolate(s, [0, 1], [1.6, 1]);
  const exit = interpolate(frame, [until, until + 12], [0, 1], { ...clamp, easing: (t) => t * t });
  const opacity = interpolate(frame, [at, at + 4], [0, 1], clamp) * (1 - exit);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        translate: "-50% -50%",
        scale: String(drop * (1 - 0.05 * exit)),
        rotate: "-5deg",
        opacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          padding: "14px 30px 16px",
          border: `4px solid ${RED}`,
          borderRadius: 12,
          background: tone.bg,
          boxShadow: tone.name === "dark" ? "0 18px 50px rgba(0,0,0,0.55)" : "0 18px 50px rgba(10,10,10,0.16)",
          fontFamily: font.mono,
          fontWeight: 500,
          fontSize: 76,
          lineHeight: 1,
          letterSpacing: "-0.01em",
          color: RED,
          whiteSpace: "nowrap",
        }}
      >
        SessionLimit
      </div>
      <SourceLine style={{ color: tone.muted, background: tone.bg, padding: "2px 10px", borderRadius: 6 }}>
        refused by the contract · before signing
      </SourceLine>
    </div>
  );
};
