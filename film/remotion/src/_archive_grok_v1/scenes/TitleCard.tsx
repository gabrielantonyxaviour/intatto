import type { FC } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { cueSeconds } from "../lib/cues";
import { FPS, LEAD, color, fontSans } from "../theme";

const ease = Easing.bezier(0.16, 1, 0.3, 1);

export const TitleCard: FC = () => {
  const frame = useCurrentFrame();
  const cue = Math.round((LEAD + cueSeconds("what", "How much you can borrow")) * FPS);
  if (frame >= cue) return null;
  const opacity = interpolate(frame, [0, 12, Math.max(13, cue - 10), cue], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const rise = interpolate(frame, [Math.max(0, cue - 10), cue], [0, -16], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity,
        translate: `0px ${rise}px`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 180px",
      }}
    >
      <div style={{ fontFamily: fontSans, fontWeight: 700, fontSize: 140, letterSpacing: -3, color: color.ink, lineHeight: 1 }}>
        Intatto
      </div>
      <div
        style={{
          fontFamily: fontSans,
          fontWeight: 400,
          fontSize: 36,
          lineHeight: 1.35,
          textAlign: "center",
          maxWidth: 1080,
          marginTop: 28,
          color: color.ink,
        }}
      >
        Borrow against tokenized stocks on X Layer, with limits that know when the stock market is closed.
      </div>
    </div>
  );
};
