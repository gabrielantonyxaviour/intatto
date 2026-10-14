import type { FC } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ease, enter, font, RED, size, tracking } from "../theme";
import { useTone } from "../tone";
import { Toned } from "../dial/ThemeFlip";
import { ChipRow } from "../ui/Chip";
import { SourceLine } from "../ui/SourceLine";
import { ScratchCaptions } from "../ui/Caption";
import { beat } from "../script";
import type { BeatProps } from "../stage";
import { fmt } from "../datakit/format";
import { FRIDAY_CLOSE, GAP_PERCENT, MONDAY_START, priceY } from "../datakit/replay";
import { VO_TIMINGS } from "../datakit/vo";
import { Chart } from "./Chart";
import { LtvMeter } from "./LtvMeter";
import { T } from "./timeline";

const PLOT = { x: 200, y: 380, w: 1120, h: 440 } as const;
const METER = { x: 1440, y: 450, h: 370 } as const;
const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Title: FC = () => {
  const f = useCurrentFrame();
  const tone = useTone();
  const a = enter(f, T.eyebrow, 18);
  const b = enter(f, T.title, 20);
  // Parallax: the title drifts at about half the camera's push.
  const drift = interpolate(f, T.camera, [0, -8], { ...c, easing: ease.inOut });
  return (
    <div style={{ position: "absolute", left: 120, top: 186, translate: `0px ${drift}px` }}>
      <div style={{ fontFamily: font.mono, fontSize: size.label, color: tone.muted, letterSpacing: "0.04em", opacity: a, translate: `0px ${(1 - a) * 14}px` }}>
        NVDA · 24–27 JAN 2025
      </div>
      <div style={{ fontFamily: font.sans, fontSize: 64, fontWeight: 650, letterSpacing: tracking.title, lineHeight: 1.05, marginTop: 10, color: tone.ink, opacity: b, translate: `0px ${(1 - b) * 22}px` }}>
        The DeepSeek weekend
      </div>
    </div>
  );
};

const GapCallout: FC = () => {
  const f = useCurrentFrame();
  const tone = useTone();
  const n = interpolate(f, T.gapCount, [0, GAP_PERCENT], { ...c, easing: ease.out });
  const k = enter(f, T.gapCount[0], 18);
  const sub = enter(f, T.gapCount[0] + 10, 18);
  const left = PLOT.x + MONDAY_START * PLOT.w + 62;
  const top = PLOT.y + priceY(FRIDAY_CLOSE) * PLOT.h - 12;
  return (
    <div style={{ position: "absolute", left: left - 18, top: top - 6, padding: "6px 18px 10px", background: tone.bg, borderRadius: 8, whiteSpace: "nowrap" }}>
      <div style={{ fontFamily: font.mono, fontSize: 96, lineHeight: "104px", color: RED, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", opacity: k, translate: `0px ${(1 - k) * 18}px` }}>
        {fmt(n, 2)}%
      </div>
      <div style={{ opacity: sub, translate: `0px ${(1 - sub) * 12}px` }}>
        <div style={{ fontFamily: font.sans, fontSize: 24, fontWeight: 500, color: tone.ink, marginTop: 6 }}>Gap at Monday's open</div>
        <SourceLine style={{ marginTop: 6 }}>Dukascopy NVDA CFD · 24 &amp; 27 Jan 2025</SourceLine>
      </div>
    </div>
  );
};

const Scene: FC<BeatProps> = ({ scratchCaptions }) => {
  const f = useCurrentFrame();
  // A slow push through the whole beat, leaning toward the gap while it holds.
  const s = interpolate(f, [0, 230, 450], [1, 1.025, 1.035], { ...c, easing: ease.inOut });
  const tx = interpolate(f, [0, 230, 450], [0, -6, -14], { ...c, easing: ease.inOut });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ scale: String(s), translate: `${tx}px 0px`, transformOrigin: "900px 560px" }}>
        <div style={{ position: "absolute", left: PLOT.x, top: PLOT.y, width: PLOT.w, height: PLOT.h }}>
          <Chart w={PLOT.w} h={PLOT.h} />
        </div>
        <GapCallout />
        <LtvMeter x={METER.x} y={METER.y} height={METER.h} />
      </AbsoluteFill>
      <Title />
      <ChipRow kinds={["REPLAY", "SANDBOX"]} from={0} />
      <ScratchCaptions vo={beat(6).vo} show={scratchCaptions} timings={VO_TIMINGS[6]} />
    </AbsoluteFill>
  );
};

/** Beat 06 · The real weekend (15 s, black). */
export const Beat06: FC<BeatProps> = (props) => (
  <Toned tone="dark">
    <Scene {...props} />
  </Toned>
);
