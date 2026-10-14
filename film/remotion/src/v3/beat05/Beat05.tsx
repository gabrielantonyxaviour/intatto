import type { FC } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ThemeFlip } from "../dial/ThemeFlip";
import { Footage } from "../footage/Footage";
import type { BeatProps } from "../stage";
import { enter, GREEN, leave } from "../theme";
import { ScratchCaptions } from "../ui/Caption";
import { ChipRow } from "../ui/Chip";
import { FloatingFrame } from "../ui/FloatingFrame";
import { Callout, PageBox, Tick } from "../uibeats/Callout";
import { camera, pageScale, shake } from "../uibeats/camera";
import { VO_UI_V4 as VO_UI } from "../uibeats/vo";
import { DialTrack } from "./DialTrack";
import { BORROW, BOX, CAM_BORROW, CAM_SANDBOX, FLIP_AT, REPAY, SANDBOX, T, WINDOW } from "./shots";
import { Stamp } from "./Stamp";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const FACTS_X = 1480;

/** The sandbox page, from the fork card down to the "Jump to Saturday" press, then it steps back for the dial. */
const SandboxWindow: FC = () => {
  const frame = useCurrentFrame();
  const cam = camera(frame, CAM_SANDBOX);
  const scale = pageScale(WINDOW.width, cam.zoom);
  const k = enter(frame, 78, 26);
  const out = interpolate(frame, [T.click + 2, T.click + 14], [0, 1], clamp);
  return (
    <FloatingFrame
      x={WINDOW.x}
      y={WINDOW.y + (1 - k) * 70 + out * 24}
      width={WINDOW.width}
      url="intatto.larinova.com/sandbox"
      zoom={cam.zoom}
      focus={cam.focus}
      style={{ opacity: k * (1 - out), scale: String((0.97 + 0.03 * k) * (1 - 0.05 * out)) }}
    >
      <Footage segments={SANDBOX} />
      <PageBox at={150} {...BOX.fork} scale={scale} until={T.click - 50} />
    </FloatingFrame>
  );
};

/** Saturday on the fork: the borrow page refuses, the stamp lands, then the repay goes through. */
const SaturdayWindow: FC = () => {
  const frame = useCurrentFrame();
  const cam = camera(frame, CAM_BORROW);
  const scale = pageScale(WINDOW.width, cam.zoom);
  const k = enter(frame, T.frameBack, 26);
  const dissolve = interpolate(frame, [T.repay, T.repay + 12], [0, 1], clamp);
  const jolt = shake(frame, T.refused + 4, 8, 2);
  return (
    <FloatingFrame
      x={WINDOW.x + jolt.x}
      y={WINDOW.y + (1 - k) * 70 + jolt.y}
      width={WINDOW.width}
      url="intatto.larinova.com/borrow"
      zoom={cam.zoom}
      focus={cam.focus}
      style={{ opacity: k, scale: String(0.97 + 0.03 * k) }}
    >
      <div style={{ position: "absolute", inset: 0, opacity: 1 - dissolve }}>
        <Footage segments={BORROW} />
        <PageBox at={T.frameBack + 30} {...BOX.closed} scale={scale} until={T.refused - 6} />
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: dissolve }}>
        <Footage segments={REPAY} />
        <PageBox at={T.repaid + 2} {...BOX.repaid} scale={scale} color={GREEN} />
      </div>
    </FloatingFrame>
  );
};

const Scene: FC<{ scratchCaptions: boolean }> = ({ scratchCaptions }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {frame < T.click + 30 ? <SandboxWindow /> : null}
      {frame >= T.frameBack - 30 ? <SaturdayWindow /> : null}
      <DialTrack />
      <div style={{ position: "absolute", left: FACTS_X, top: 540, opacity: leave(frame, T.click - 16, 14) }}>
        <Callout at={156} label="Fork of X Layer mainnet at block" value="71,563,431" valueSize={40} sub="fork chain id 1960196" />
      </div>
      <Stamp at={T.refused} until={T.repay - 16} x={760} y={640} />
      <div style={{ position: "absolute", left: FACTS_X, top: 540 }}>
        <Callout
          at={T.repaid + 8}
          label={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <Tick at={T.repaid + 12} px={24} />
              Repaid on Saturday
            </span>
          }
          value="100.00 USDG"
          valueSize={40}
          sub="Confirmed 0xc291d2…44a1ff"
        />
      </div>
      <ChipRow kinds={["SANDBOX"]} from={4} />
      <ScratchCaptions vo={[]} show={scratchCaptions} timings={VO_UI[5]} />
    </AbsoluteFill>
  );
};

/**
 * Beat 5 · Make it Saturday (24 s, white → black). The dial at Friday 07:01 ET: the weekend is thirteen hours
 * away. The sandbox page; "Jump to Saturday"; the dial spins through Friday and the frame flips black as the
 * needle enters the weekend. On Saturday the contract refuses a new borrow (SessionLimit), and the repay goes through.
 */
export const Beat05: FC<BeatProps> = ({ scratchCaptions }) => (
  <ThemeFlip start={FLIP_AT} duration={28} origin={{ x: 720, y: 500 }} from="light" to="dark">
    <Scene scratchCaptions={scratchCaptions} />
  </ThemeFlip>
);
