import type { FC } from "react";
import { Composition, Folder } from "remotion";
import "./index.css";
import { Film } from "./Film";
import type { BeatId } from "./data/types";
import { filmFrames, sceneFrames } from "./lib/timeline";
import { Agents, Mainnet, Proof, Replay, Saturday, Synthetic, What } from "./scenes/beats";
import { Close } from "./scenes/Close";
import { Hook } from "./scenes/Hook";
import { FPS, HEIGHT, WIDTH } from "./theme";

const stage = { fps: FPS, width: WIDTH, height: HEIGHT };

const SCENES: { id: string; beat: BeatId; component: FC }[] = [
  { id: "Hook", beat: "hook", component: Hook },
  { id: "What", beat: "what", component: What },
  { id: "Mainnet", beat: "mainnet", component: Mainnet },
  { id: "Saturday", beat: "saturday", component: Saturday },
  { id: "Proof", beat: "proof", component: Proof },
  { id: "Replay", beat: "replay", component: Replay },
  { id: "Synthetic", beat: "synthetic", component: Synthetic },
  { id: "Agents", beat: "agents", component: Agents },
  { id: "Close", beat: "close", component: Close },
];

export const RemotionRoot: FC = () => {
  return (
    <>
      <Folder name="Scenes">
        {SCENES.map((scene) => (
          <Composition
            key={scene.id}
            id={scene.id}
            component={scene.component}
            durationInFrames={sceneFrames(scene.beat)}
            {...stage}
          />
        ))}
      </Folder>
      <Composition id="Film" component={Film} durationInFrames={filmFrames()} {...stage} />
    </>
  );
};
