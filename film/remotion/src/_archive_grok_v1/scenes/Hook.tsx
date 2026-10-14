import type { FC } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Captions } from "../components/Captions";
import { FactCards } from "../components/FactCards";
import { SceneAudio } from "../components/SceneAudio";
import { WeekChart } from "../components/WeekChart";
import { cueSeconds } from "../lib/cues";
import { FPS, LEAD, color } from "../theme";

const ease = Easing.bezier(0.16, 1, 0.3, 1);

export const Hook: FC = () => {
  const frame = useCurrentFrame();
  const card = Math.round((LEAD + cueSeconds("hook", "While the market is closed")) * FPS);
  const shift = interpolate(frame, [card - 12, card], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const top = interpolate(shift, [0, 1], [250, 72]);
  return (
    <AbsoluteFill style={{ background: color.bg }}>
      <div style={{ position: "absolute", left: 0, right: 0, top, display: "flex", justifyContent: "center" }}>
        <WeekChart />
      </div>
      <FactCards />
      <Captions beat="hook" />
      <SceneAudio beat="hook" />
    </AbsoluteFill>
  );
};
