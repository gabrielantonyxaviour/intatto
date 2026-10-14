import type { FC } from "react";
import { AbsoluteFill } from "remotion";
import { FootageScene } from "./FootageScene";
import { TitleCard } from "./TitleCard";

export const What: FC = () => (
  <AbsoluteFill>
    <FootageScene beat="what" browserFromCue="How much you can borrow" />
    <TitleCard />
  </AbsoluteFill>
);

export const Mainnet: FC = () => <FootageScene beat="mainnet" />;
export const Saturday: FC = () => <FootageScene beat="saturday" />;
export const Proof: FC = () => <FootageScene beat="proof" />;
export const Replay: FC = () => <FootageScene beat="replay" />;
export const Synthetic: FC = () => <FootageScene beat="synthetic" />;
export const Agents: FC = () => <FootageScene beat="agents" />;
