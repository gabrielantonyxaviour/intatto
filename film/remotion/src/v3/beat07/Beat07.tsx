import type { FC, ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { enter } from "../theme";
import { useTone } from "../tone";
import { Toned } from "../dial/ThemeFlip";
import { ChipRow } from "../ui/Chip";
import { FloatingFrame } from "../ui/FloatingFrame";
import { ScratchCaptions } from "../ui/Caption";
import { Footage, type Segment } from "../footage/Footage";
import { PageBox } from "../uibeats/Callout";
import { beat } from "../script";
import type { BeatProps } from "../stage";
import { VO_TIMINGS } from "../datakit/vo";
import { Crash, Sale } from "./StationsA";
import { Lenders, Reserve, Shortfall } from "./StationsB";
import { cameraLift, cameraScale, cameraX, FRAME, frameZoom, LEAVE, RAIL_Y, SX, T } from "./timeline";

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * The Lend page's "How lending works" primer, the disclosure a lender reads before a first deposit. Swappable:
 * a re-shoot only needs the same mark in the new `replays` take. Focus is the "Lenders can lose money." paragraph.
 */
// The modal is fully open from mark − 0.2 s and the cursor stays up in the nav until about mark + 0.45 s, so that
// clean half-second is held at 0.15× under the camera's zoom.
const primer = (end: number): Segment => ({ at: T.footage.at, dur: end - T.footage.at, take: "replays", mark: "primer-lose", offset: -0.2, rate: 0.15 });
export const PRIMER_FOCUS = { x: 842, y: 548 } as const;
/** "Lenders can lose money." in page px (measured on the take at mark − 0.2 s). */
export const PRIMER_BOLD = { x: 601, y: 528, w: 140, h: 15 } as const;

/** The flow rail: from the crashed column to the lenders, drawn out ahead of the camera. */
const Rail: FC = () => {
  const f = useCurrentFrame();
  const tone = useTone();
  const start = SX[0] - 220;
  const end = SX[3] - 470;
  const reach = Math.min(end, start + (cameraX(f) + 1100 - start) * enter(f, 78, 34));
  const node = enter(f, T.lenders.node, 16);
  return (
    <>
      <div style={{ position: "absolute", left: start, top: RAIL_Y - 1, width: Math.max(0, reach - start), height: 2, background: tone.hairline }} />
      <div style={{ position: "absolute", left: end - 8, top: RAIL_Y - 8, width: 16, height: 16, borderRadius: 8, background: tone.ink, opacity: node }} />
    </>
  );
};

/** A faint dot field behind the world, moving at half the camera's speed for depth. */
const Depth: FC = () => {
  const f = useCurrentFrame();
  const tone = useTone();
  return (
    <AbsoluteFill style={{
      backgroundImage: `radial-gradient(${tone.hairline} 1.6px, transparent 1.8px)`, backgroundSize: "48px 48px",
      backgroundPosition: `${-cameraX(f) * 0.5}px 0px`, opacity: 0.8,
      maskImage: "linear-gradient(180deg, transparent 0%, black 30%, black 72%, transparent 100%)",
    }} />
  );
};

/** Rides in with the world as the camera trucks right, then the camera pushes in on the bold line and boxes it. */
const Primer: FC = () => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const k = enter(f, T.footage.at, 30);
  const zoom = frameZoom(f);
  if (f < T.footage.at - 30) return null;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: k, translate: `0px ${(1 - k) * 50}px` }}>
      <FloatingFrame x={FRAME.x} y={FRAME.y} width={FRAME.width} url="intatto.larinova.com/lend" zoom={zoom} focus={PRIMER_FOCUS}>
        <Footage segments={[primer(durationInFrames)]} />
        <PageBox at={T.footage.box} {...PRIMER_BOLD} scale={(FRAME.width / 1440) * zoom * cameraScale(f)} />
      </FloatingFrame>
    </div>
  );
};

const Fade: FC<{ at: number; children: ReactNode }> = ({ at, children }) => {
  const f = useCurrentFrame();
  return <div style={{ position: "absolute", inset: 0, opacity: interpolate(f, [at, at + 12], [1, 0], c) }}>{children}</div>;
};

const Scene: FC<BeatProps> = ({ scratchCaptions }) => {
  const f = useCurrentFrame();
  const x = cameraX(f);
  const s = cameraScale(f);
  return (
    <AbsoluteFill>
      <Depth />
      <AbsoluteFill style={{ scale: String(s), translate: `0px ${cameraLift(f)}px`, transformOrigin: "960px 560px" }}>
        <div style={{ position: "absolute", left: 960 - x, top: 0, width: 6000, height: 1080 }}>
          <Rail />
          <Fade at={LEAVE[0]}><Crash /></Fade>
          <Fade at={LEAVE[1]}><Sale /></Fade>
          <Fade at={LEAVE[2]}><Reserve /></Fade>
          <Shortfall />
          <Lenders />
          <Primer />
        </div>
      </AbsoluteFill>
      <ChipRow kinds={["SYNTHETIC", "SANDBOX"]} from={0} />
      <ScratchCaptions vo={beat(7).vo} show={scratchCaptions} timings={VO_TIMINGS[7]} />
    </AbsoluteFill>
  );
};

/** Beat 07 · The worst case (17 s, black). */
export const Beat07: FC<BeatProps> = (props) => (
  <Toned tone="dark">
    <Scene {...props} />
  </Toned>
);
