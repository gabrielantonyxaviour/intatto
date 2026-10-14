import type { FC } from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { ease, enter, font, tracking } from "../theme";
import { useTone } from "../tone";
import { ThemeFlip } from "../dial/ThemeFlip";
import { HonestyLabel } from "../ui/Chip";
import { ScratchCaptions } from "../ui/Caption";
import { WeekTimeline } from "../week/WeekTimeline";
import { xOf } from "../week/camera";
import { beat } from "../script";
import type { BeatProps } from "../stage";
import { ltvY, closeY, openY, TIMES, DAY_LABELS } from "./axis";
import { TERMINAL_LTV } from "../datakit/replay";
import { Chart, sx, sy } from "./Chart";
import { Labels } from "./Labels";
import { camera, clock, push, stripY, T, warpAt } from "./timeline";

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** "January 2025" lands big over the week, then settles into the corner as the camera finds the weekend. */
const Title: FC = () => {
  const f = useCurrentFrame();
  const tone = useTone();
  const k = enter(f, T.title[0], 20);
  const m = interpolate(f, T.titleSettle, [0, 1], { ...c, easing: ease.inOut });
  return (
    <div style={{
      position: "absolute", left: 960 + (120 - 960) * m, top: 250 + (118 - 250) * m, translate: `${-50 * (1 - m)}% ${(1 - k) * 24}px`,
      fontFamily: font.sans, fontWeight: 650, fontSize: 132 + (44 - 132) * m, letterSpacing: tracking.display, lineHeight: 1,
      color: tone.ink, opacity: k, whiteSpace: "nowrap",
    }}>
      January 2025
    </div>
  );
};

const Scene: FC<BeatProps> = ({ scratchCaptions }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const w = warpAt(f);
  const gapX = (sx(TIMES.FRI_LAST, f) + sx(TIMES.MON_FIRST, f)) / 2 + 160;
  const gapY = (sy(closeY(0)) + sy(openY(0))) / 2;
  const p = push(f, gapX, gapY, sx(TIMES.MON_LAST, f) - 330, (sy(ltvY(TERMINAL_LTV)) + sy(ltvY(65))) / 2 + 40);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transformOrigin: "0 0", scale: String(p.scale), translate: `${960 - p.fx * p.scale}px ${540 - p.fy * p.scale}px` }}>
        {/* Opens exactly on beat 06's last frame (this week, SAT 08:00); on "In January 2025" it becomes 20–27 Jan. */}
        {f < T.jan ? (
          <WeekTimeline camera={camera(f)} y={stripY(f)} playhead={clock(f)} clockStep={15} />
        ) : (
          <WeekTimeline camera={camera(f)} y={stripY(f)} playhead={clock(f)} clockStep={15} days={f < T.titleSettle[0] ? [0, 6] : [0, 7]} dayLabel={(k) => DAY_LABELS[k] ?? ""}
            style={{ opacity: 1 - interpolate(w, [0, 0.4], [0, 1], c) }} />
        )}
        <Chart />
        <Labels />
      </AbsoluteFill>
      <Title />
      <Sequence durationInFrames={T.jan} layout="none">
        <HonestyLabel kinds={["SANDBOX"]} from={-20} />
      </Sequence>
      <Sequence from={T.jan} durationInFrames={durationInFrames - T.jan} layout="none">
        <HonestyLabel kinds={["REPLAY", "SANDBOX"]} from={0} />
      </Sequence>
      <ScratchCaptions vo={beat(7).vo} show={scratchCaptions} />
    </AbsoluteFill>
  );
};

/** Beat 07 · The real weekend (24 s): black until Monday's open, which turns the frame white from the playhead. */
export const Beat07: FC<BeatProps> = (props) => (
  <ThemeFlip start={T.open} duration={30} origin={{ x: xOf(clock(T.open), camera(T.open)), y: stripY(T.open) }} from="dark" to="light">
    <Scene {...props} />
  </ThemeFlip>
);
