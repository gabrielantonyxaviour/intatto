import type { FC } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ease, font, TONES, tracking } from "../theme";

/**
 * Opening transition out of beat 2's black: "Intatto" lands as white type on black, then the camera dives through
 * the stem of its "I" until the white fills the frame. After `diveEnd` render the white scene on top.
 */
export const KnockoutDive: FC<{ land: number; diveStart: number; diveEnd: number }> = ({ land, diveStart, diveEnd }) => {
  const frame = useCurrentFrame();
  const size = 190;
  const rise = (i: number) =>
    interpolate(frame, [land + i * 2, land + i * 2 + 20], [0, 1], { easing: ease.out, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dive = interpolate(frame, [diveStart, diveEnd], [0, 1], { easing: ease.inOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // The "I" grows about its own centre toward the frame centre; the other letters part and fall away.
  const scaleI = interpolate(dive, [0, 1], [1, 110], { output: "perceptual-scale" });
  const rest = interpolate(dive, [0, 0.35], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glyph = (ch: string, i: number) => (
    <span key={i} style={{ display: "inline-block", overflow: "hidden", padding: "0.12em 0.02em 0.18em", margin: "-0.12em -0.02em -0.18em" }}>
      <span style={{ display: "inline-block", translate: `0px ${(1 - rise(i)) * 1.4}em` }}>{ch}</span>
    </span>
  );
  return (
    <AbsoluteFill style={{ background: TONES.dark.bg }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: font.sans,
          fontWeight: 700,
          fontSize: size,
          letterSpacing: tracking.display,
          lineHeight: 1,
          color: TONES.dark.ink,
        }}
      >
        <span
          style={{
            display: "inline-block",
            scale: String(scaleI),
            translate: `${dive * 280}px 0px`,
            transformOrigin: "50% 58%",
          }}
        >
          {glyph("I", 0)}
        </span>
        <span style={{ display: "inline-flex", opacity: rest, translate: `${dive * 900}px 0px` }}>
          {[..."ntatto"].map((ch, i) => glyph(ch, i + 1))}
        </span>
      </div>
    </AbsoluteFill>
  );
};
