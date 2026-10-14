import type { FC } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { Toned } from "../dial/ThemeFlip";
import { HonestyLabel } from "../ui/Chip";
import { ScratchCaptions } from "../ui/Caption";
import { beat } from "../script";
import type { BeatProps } from "../stage";
import { Split } from "./Split";
import { X402 } from "./X402";
import { Tiles } from "./Tiles";
import { T } from "./timeline";

const Scene: FC<BeatProps> = ({ scratchCaptions }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      {f < T.request[0] ? <Split /> : null}
      <X402 />
      {f >= T.tiles - 2 ? <Tiles /> : null}
      <Sequence durationInFrames={T.request[0]} layout="none">
        <HonestyLabel kinds={["LIVE"]} from={0} />
      </Sequence>
      <ScratchCaptions vo={beat(9).vo} show={scratchCaptions} />
    </AbsoluteFill>
  );
};

/** Beat 09 · The model (20 s, white): 80/20 interest, the keeper's half of the 5% penalty, x402, isolated markets. */
export const Beat09: FC<BeatProps> = (props) => (
  <Toned tone="light">
    <Scene {...props} />
  </Toned>
);
