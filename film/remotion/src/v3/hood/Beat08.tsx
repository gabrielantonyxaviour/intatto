import type { FC } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { Toned } from "../dial/ThemeFlip";
import { HonestyLabel } from "../ui/Chip";
import { ScratchCaptions } from "../ui/Caption";
import { beat } from "../script";
import type { BeatProps } from "../stage";
import { BAND_OPEN_BPS, WIDEST } from "../datakit/hood";
import { uOfTime, xOfU, yOf } from "./geometry";
import { PriceCheck } from "./PriceCheck";
import { HoodLabels } from "./HoodLabels";
import { Report } from "./Report";
import { iris, pushAt, T } from "./timeline";

const Scene: FC<BeatProps> = ({ scratchCaptions }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const dot = { x: xOfU(uOfTime(WIDEST.t)), y: yOf(WIDEST.keeper) };
  // Frame the measured post and its readout (which sits above the band) together.
  const widest = { x: dot.x + 260, y: (dot.y + yOf(WIDEST.twap * (1 + BAND_OPEN_BPS / 1e4)) - 60) / 2 };
  const p = pushAt(f, widest, dot);
  const openAt = { x: 960 + (dot.x - p.fx) * p.s, y: 540 + (dot.y - p.fy) * p.s };
  const { r, o } = iris(f, openAt, dot);
  const [inEnd, outEnd] = [T.irisIn[1], T.irisOut[1]];
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transformOrigin: "0 0", scale: String(p.s), translate: `${960 - p.fx * p.s}px ${540 - p.fy * p.s}px` }}>
        <PriceCheck />
        <HoodLabels />
      </AbsoluteFill>
      {r > 0.5 ? (
        <AbsoluteFill style={{ clipPath: Number.isFinite(r) ? `circle(${r}px at ${o.x}px ${o.y}px)` : undefined }}>
          <Report />
        </AbsoluteFill>
      ) : null}
      <Sequence durationInFrames={inEnd} layout="none"><HonestyLabel kinds={["LIVE"]} from={0} /></Sequence>
      <Sequence from={inEnd} durationInFrames={outEnd - inEnd} layout="none">
        <HonestyLabel kinds={["SANDBOX"]} text="Chainlink adapter: built and unit-tested, not live yet" from={0} />
      </Sequence>
      <Sequence from={outEnd} durationInFrames={durationInFrames - outEnd} layout="none"><HonestyLabel kinds={["LIVE"]} from={0} /></Sequence>
      <ScratchCaptions vo={beat(8).vo} show={scratchCaptions} />
    </AbsoluteFill>
  );
};

/** Beat 08 · How it handles risk (29 s, white): the price check, into one post for the Chainlink path, the depth cap. */
export const Beat08: FC<BeatProps> = (props) => (
  <Toned tone="light">
    <Scene {...props} />
  </Toned>
);
