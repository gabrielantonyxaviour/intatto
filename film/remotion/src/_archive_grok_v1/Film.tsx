import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type { FC } from "react";
import { sceneFrames } from "./lib/timeline";
import { Agents, Mainnet, Proof, Replay, Saturday, Synthetic, What } from "./scenes/beats";
import { Close } from "./scenes/Close";
import { Hook } from "./scenes/Hook";
import { SCENE_FADE } from "./theme";
import type { BeatId } from "./data/types";

const timing = linearTiming({ durationInFrames: SCENE_FADE });

const SCENES: { name: string; beat: BeatId; Scene: FC }[] = [
  { name: "Hook", beat: "hook", Scene: Hook },
  { name: "What", beat: "what", Scene: What },
  { name: "Mainnet", beat: "mainnet", Scene: Mainnet },
  { name: "Saturday", beat: "saturday", Scene: Saturday },
  { name: "Proof", beat: "proof", Scene: Proof },
  { name: "Replay", beat: "replay", Scene: Replay },
  { name: "Synthetic", beat: "synthetic", Scene: Synthetic },
  { name: "Agents", beat: "agents", Scene: Agents },
  { name: "Close", beat: "close", Scene: Close },
];

export const Film: FC = () => (
  <TransitionSeries>
    {SCENES.flatMap(({ name, beat, Scene }, index) => {
      const sequence = (
        <TransitionSeries.Sequence key={name} name={name} durationInFrames={sceneFrames(beat)}>
          <Scene />
        </TransitionSeries.Sequence>
      );
      if (index === SCENES.length - 1) return [sequence];
      return [
        sequence,
        <TransitionSeries.Transition key={`${name}-fade`} presentation={fade()} timing={timing} />,
      ];
    })}
  </TransitionSeries>
);
