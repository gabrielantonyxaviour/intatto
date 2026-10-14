import type { FC } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BrowserFrame } from "../components/BrowserFrame";
import { Captions } from "../components/Captions";
import { LabelRow, OldUiFlag } from "../components/LabelChip";
import { SceneAudio } from "../components/SceneAudio";
import type { FootageBeat } from "../data/types";
import { cueSeconds } from "../lib/cues";
import { TIMELINE, labelsFor, sceneFrames } from "../lib/timeline";
import { FPS, LEAD, color } from "../theme";

export const FootageScene: FC<{ beat: FootageBeat; browserFromCue?: string }> = ({ beat, browserFromCue }) => {
  const frame = useCurrentFrame();
  const segments = TIMELINE[beat];
  const enterAt = browserFromCue ? Math.round((LEAD + cueSeconds(beat, browserFromCue)) * FPS) : 0;
  const active = segments.find((seg) => frame >= seg.startFrame && frame < seg.endFrame);
  return (
    <AbsoluteFill style={{ background: color.bg }}>
      <LabelRow kinds={labelsFor(segments)} />
      {frame >= enterAt && active?.oldUi ? <OldUiFlag /> : null}
      <BrowserFrame segments={segments} enterAt={enterAt} sceneFrames={sceneFrames(beat)} />
      <Captions beat={beat} />
      <SceneAudio beat={beat} />
    </AbsoluteFill>
  );
};
