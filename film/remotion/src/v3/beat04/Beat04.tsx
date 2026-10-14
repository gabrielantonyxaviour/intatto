import type { FC } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Toned } from "../dial/ThemeFlip";
import { Footage } from "../footage/Footage";
import type { BeatProps } from "../stage";
import { ease, enter, GREEN, SAFE } from "../theme";
import { ScratchCaptions } from "../ui/Caption";
import { ChipRow } from "../ui/Chip";
import { FloatingFrame } from "../ui/FloatingFrame";
import { SourceLine } from "../ui/SourceLine";
import { Callout, PageBox, Tick } from "../uibeats/Callout";
import { camera, keyed, pageScale } from "../uibeats/camera";
import { VO_UI_V4 as VO_UI } from "../uibeats/vo";
import { B4 } from "./shots";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const COL = 1300; // left edge of the fact column

/**
 * Beat 4 · It's live (11 s, white). The live Borrow screen floats in and the camera pushes onto the position;
 * the same window navigates to OKLink: the borrow row, then the Contracts tab and "source code verified".
 * Each fact is lifted into a column on the right: wallet → transaction → verified contract.
 */
export const Beat04: FC<BeatProps> = ({ scratchCaptions }) => {
  const frame = useCurrentFrame();

  // The window: rises in at centre, then glides left to make room for the facts.
  const glide = keyed(frame, [
    [36, 0],
    [92, 1],
  ]);
  const x = interpolate(glide, [0, 1], [960, 700]);
  const width = interpolate(glide, [0, 1], [1240, 1080]);
  const rise = enter(frame, 0, 24);
  const cam = camera(frame, B4.camera);
  const scale = pageScale(width, cam.zoom);
  const nav = interpolate(frame, [B4.navAt, B4.navAt + 10], [0, 1], { ...clamp, easing: ease.inOut });
  const url = frame < B4.navAt + 5 ? "intatto.larinova.com/borrow" : "oklink.com/x-layer/address/0xE6708CC6…459D0D";

  return (
    <Toned tone="light">
      <AbsoluteFill>
        <FloatingFrame
          x={x}
          y={560 + (1 - rise) * 70}
          width={width}
          url={url}
          zoom={cam.zoom}
          focus={cam.focus}
          style={{ opacity: rise, scale: String(0.97 + 0.03 * rise) }}
        >
          <div style={{ position: "absolute", inset: 0, opacity: 1 - nav }}>
            <Footage segments={B4.borrow} />
            <PageBox at={B4.facts.collateral} {...B4.boxes.collateral} scale={scale} until={B4.navAt} />
            <PageBox at={B4.facts.borrowed} {...B4.boxes.debt} scale={scale} until={B4.navAt} />
          </div>
          <div style={{ position: "absolute", inset: 0, opacity: nav, translate: `0px ${(1 - nav) * 14}px` }}>
            <Footage segments={B4.explorer} />
            <PageBox at={B4.facts.tx} {...B4.boxes.row} scale={scale} until={B4.contractsAt} />
            <PageBox at={B4.facts.verified} {...B4.boxes.verified} scale={scale} color={GREEN} />
          </div>
        </FloatingFrame>

        <div style={{ position: "absolute", left: COL, top: 214, width: 1920 - SAFE.x - COL, translate: `0px ${-frame * 0.03}px` }}>
          <Callout at={B4.facts.collateral} label="Collateral posted" value="0.0048 NVDAx" dimAt={B4.facts.tx} />
          <Callout at={B4.facts.borrowed} label="Borrowed" value="0.40 USDG" dimAt={B4.facts.tx} style={{ marginTop: 22 }} />
          <SourceLine style={{ marginTop: 10, opacity: enter(frame, B4.facts.borrowed + 8) * (frame > B4.facts.tx ? 0.6 : 1) }}>
            wallet 0x7F23…a415 · 25 Sep 2026
          </SourceLine>
          <Callout
            at={B4.facts.tx}
            label="Borrow transaction"
            value="0xa933…0f45"
            sub="block 71,562,308 · 10:15:44 UTC"
            dimAt={B4.facts.verified}
            style={{ marginTop: 52 }}
          />
          <Callout
            at={B4.facts.verified}
            label={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <Tick at={B4.facts.verified + 4} px={24} />
                Contract source code verified
              </span>
            }
            value="CollateralMarket"
            sub="0xE670…9D0D · OKLink, X Layer"
            style={{ marginTop: 52 }}
          />
        </div>

        <ChipRow kinds={["LIVE"]} from={4} />
        <ScratchCaptions vo={[]} show={scratchCaptions} timings={VO_UI[4]} />
      </AbsoluteFill>
    </Toned>
  );
};
