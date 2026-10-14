import type { FC, ReactNode } from "react";
import { interpolate } from "remotion";
import { ease } from "../theme";
import { useTone } from "../tone";

export type DiveProps = {
  /** 0 = a point at `anchor` (on the strip), 1 = the full `target` rect. Reverse it to pull back out. */
  progress: number;
  anchor: { x: number; y: number };
  /** Where the window settles: centre and size in frame px. */
  target: { x: number; y: number; width: number; height: number };
  radius?: number;
  children: ReactNode;
};

/**
 * The moment opens up: a window grows out of the playhead into the screen at that time. Pair it with a camera zoom
 * on the WeekTimeline (keyedCamera to 30–60×) so the strip rushes past as we go in. Children are laid out at the
 * target size and scaled, so text never reflows during the move.
 */
export const Dive: FC<DiveProps> = ({ progress, anchor, target, radius = 16, children }) => {
  const tone = useTone();
  if (progress <= 0) return null;
  const k = interpolate(progress, [0, 1], [0, 1], { easing: ease.inOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const s = interpolate(k, [0, 1], [0.02, 1], { output: "perceptual-scale" });
  const cx = interpolate(k, [0, 1], [anchor.x, target.x]);
  const cy = interpolate(k, [0, 1], [anchor.y, target.y]);
  return (
    <div
      style={{
        position: "absolute",
        left: cx - target.width / 2,
        top: cy - target.height / 2,
        width: target.width,
        height: target.height,
        scale: String(s),
        borderRadius: radius / Math.max(s, 0.2),
        overflow: "hidden",
        background: tone.bg,
        boxShadow: tone.name === "dark" ? "0 40px 120px rgba(0,0,0,0.7)" : "0 40px 120px rgba(10,10,10,0.16)",
        opacity: interpolate(progress, [0, 0.08], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}
    >
      {children}
    </div>
  );
};
