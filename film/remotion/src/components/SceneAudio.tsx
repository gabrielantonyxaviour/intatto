import { Audio } from "@remotion/media";
import type { FC } from "react";
import { Sequence, staticFile } from "remotion";
import type { BeatId } from "../data/types";
import { VO } from "../lib/cues";
import { FPS, LEAD } from "../theme";

export const SceneAudio: FC<{ beat: BeatId }> = ({ beat }) => {
  const from = Math.round(LEAD * FPS);
  const durationInFrames = Math.max(1, Math.round(VO[beat].seconds * FPS));
  return (
    <Sequence from={from} durationInFrames={durationInFrames} layout="none">
      <Audio src={staticFile(VO[beat].file)} />
    </Sequence>
  );
};
