import type { FC, ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ease, enter, font, GREEN } from "../theme";
import { useTone } from "../tone";
import { ThemeFlip } from "../dial/ThemeFlip";
import { Chip, type ChipKind } from "../ui/Chip";
import { SourceLine } from "../ui/SourceLine";
import { ScratchCaptions } from "../ui/Caption";
import { beat } from "../script";
import type { BeatProps } from "../stage";
import { VO_TIMINGS } from "../datakit/vo";
import { FORK_BLOCK, PROOF_ROWS, SNAPSHOT } from "../datakit/proof";
import { fmt } from "../datakit/format";
import { Rows } from "./ProofRow";
import { COL, T, valueY } from "./timeline";

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** A column head: its honesty chip and its name, mirrored like the values under it. */
const Head: FC<{ side: "left" | "right"; chip: ChipKind; title: string }> = ({ side, chip, title }) => {
  const f = useCurrentFrame();
  const tone = useTone();
  const left = side === "left";
  const k = interpolate(f, T.slide, [0, 1], { ...c, easing: ease.out });
  return (
    <div style={{ position: "absolute", top: 196, width: COL.width, left: left ? COL.gutter - COL.half - COL.width : COL.gutter + COL.half,
      display: "flex", flexDirection: "column", alignItems: left ? "flex-end" : "flex-start", opacity: k }}>
      <Chip kind={chip} />
      <div style={{ fontFamily: font.sans, fontSize: 48, fontWeight: 650, letterSpacing: "-0.03em", color: tone.ink, marginTop: 22 }}>{title}</div>
    </div>
  );
};

/** Everything that slides: each column arrives from its own side of the frame. */
const Column: FC<{ side: "left" | "right"; children: ReactNode }> = ({ side, children }) => {
  const f = useCurrentFrame();
  const dx = interpolate(f, T.slide, [side === "left" ? -420 : 420, 0], { ...c, easing: ease.out });
  return <AbsoluteFill style={{ translate: `${dx}px 0px` }}>{children}</AbsoluteFill>;
};

const Snapshot: FC = () => {
  const f = useCurrentFrame();
  const tone = useTone();
  const k = enter(f, T.snapshot, 20);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 862, display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      opacity: k, translate: `0px ${(1 - k) * 12}px` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: font.mono, fontSize: 26, color: tone.ink }}>
        <span style={{ color: GREEN }}>{PROOF_ROWS.filter((r) => r.equal).length} of {PROOF_ROWS.length} equal</span>
        <span style={{ color: tone.muted }}>·</span>
        <span>Snapshot · {SNAPSHOT}</span>
      </div>
      <SourceLine>fork block {fmt(FORK_BLOCK, 0)} · rpc.xlayer.tech vs the sandbox RPC</SourceLine>
    </div>
  );
};

const Scene: FC<BeatProps> = ({ scratchCaptions }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = interpolate(f, [0, durationInFrames], [1, 1.03], { ...c, easing: ease.inOut });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ scale: String(s), transformOrigin: `${COL.gutter}px 560px` }}>
        <Column side="left"><Head side="left" chip="LIVE" title="X Layer mainnet" /></Column>
        <Column side="right"><Head side="right" chip="SANDBOX" title="Sandbox fork" /></Column>
        <Rows rows={PROOF_ROWS} />
        <Snapshot />
      </AbsoluteFill>
      <ScratchCaptions vo={beat(8).vo} show={scratchCaptions} timings={VO_TIMINGS[8]} />
    </AbsoluteFill>
  );
};

/** Beat 08 · Don't trust us (8 s, black → white as the last row locks). */
export const Beat08: FC<BeatProps> = (props) => (
  <ThemeFlip start={T.flip.start} duration={T.flip.duration} origin={{ x: COL.gutter, y: valueY(PROOF_ROWS.length - 1) }} from="dark" to="light">
    <Scene {...props} />
  </ThemeFlip>
);
