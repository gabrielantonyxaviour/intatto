import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ease, enter, font } from "../theme";
import { useTone } from "../tone";

export const BAR = { x: 1230, y: 315, h: 520 } as const;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** "20% floor" marks where the weekend decay is heading, on "toward twenty percent". */
export const FloorTick: FC<{ at: number; fade: number }> = ({ at, fade }) => {
  const frame = useCurrentFrame();
  const tone = useTone();
  const k = enter(frame, at - 6, 18) * fade;
  const y = BAR.y + BAR.h * 0.8;
  return (
    <div
      style={{
        position: "absolute",
        left: BAR.x - 150,
        top: y - 12,
        width: 180,
        height: 24,
        opacity: k,
      }}
    >
      <div
        style={{
          position: "absolute",
          right: 30,
          top: 0,
          fontFamily: font.mono,
          fontSize: 18,
          lineHeight: "24px",
          color: tone.ink,
          whiteSpace: "nowrap",
        }}
      >
        floor 20%
      </div>
      <div
        style={{
          position: "absolute",
          left: 150 - 4,
          width: 30,
          top: 11,
          height: 0,
          borderTop: `2px dashed ${tone.ink}`,
        }}
      />
    </div>
  );
};

/** One travelling highlight along the red line on "never move the goalposts". */
export const Sheen: FC<{ frame: number; start: number }> = ({ frame, start }) => {
  const p = interpolate(frame, [start, start + 40], [-0.2, 1.2], {
    ...clamp,
    easing: ease.inOut,
  });
  if (frame < start || frame > start + 40) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: `${p * 100 - 10}%`,
        width: "20%",
        background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,210,210,0.9), rgba(255,255,255,0))",
      }}
    />
  );
};
