import type { FC } from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Toned } from "../dial/ThemeFlip";
import type { BeatProps } from "../stage";
import { ScratchCaptions } from "../ui/Caption";
import { ChipRow } from "../ui/Chip";
import { VO_UI_V4 as VO_UI } from "../uibeats/vo";
import { AgentQA } from "./AgentQA";
import { Heartbeat } from "./Heartbeat";
import { CARD } from "./layout";

/**
 * Beat 9 · Agents and the keeper (11 s, white). An agent asks how much 0x7F23…a415 can borrow right now; the
 * credit API's real answer lands. Its keeper-relayed price lifts off the card and parks above its own post on
 * the keeper's heartbeat: every onchain post from the keeper log at its real time.
 */
export const Beat09: FC<BeatProps> = ({ scratchCaptions }) => (
  <Toned tone="light">
    <AbsoluteFill>
      <Sequence durationInFrames={CARD.exitAt + 20} layout="none" name="Agent Q&A">
        <AgentQA />
      </Sequence>
      <Heartbeat />
      <ChipRow kinds={["LIVE"]} from={4} />
      <ScratchCaptions vo={[]} show={scratchCaptions} timings={VO_UI[9]} />
    </AbsoluteFill>
  </Toned>
);
