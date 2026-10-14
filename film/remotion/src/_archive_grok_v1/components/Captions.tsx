import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { BeatId } from "../data/types";
import { captionPages } from "../lib/captions";
import { FPS, LEAD, color, fontSans } from "../theme";

export const Captions: FC<{ beat: BeatId }> = ({ beat }) => {
  const frame = useCurrentFrame();
  const time = frame / FPS - LEAD;
  const page = captionPages(beat).find((item) => time >= item.start && time < item.end);
  if (!page) return null;
  const fade = Math.min(
    interpolate(time, [page.start, page.start + 0.12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(time, [page.end - 0.12, page.end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
  return (
    <div
      style={{
        position: "absolute",
        left: 180,
        right: 180,
        top: 968,
        textAlign: "center",
        fontFamily: fontSans,
        fontSize: 30,
        lineHeight: 1.2,
        fontWeight: 400,
        color: color.ink,
        opacity: fade,
      }}
    >
      {page.lines.map((line, index) => (
        <div key={`${index}-${line}`}>{line}</div>
      ))}
    </div>
  );
};
