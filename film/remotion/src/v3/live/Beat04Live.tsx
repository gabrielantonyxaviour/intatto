import type { FC } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Toned } from "../dial/ThemeFlip";
import { beat } from "../script";
import { beatFrames, type BeatProps } from "../stage";
import { ease, enter, font, HEIGHT, leave, WIDTH } from "../theme";
import { useTone } from "../tone";
import { ScratchCaptions } from "../ui/Caption";
import { HonestyLabel } from "../ui/Chip";
import { said } from "../uibeats/said";
import { STRIP_WIDTH, WEEK_VIEW } from "../week/camera";
import { WeekTimeline } from "../week/WeekTimeline";
import { ForkSide, MainnetSide, SIDE, STRIP_SLOT } from "./Panels";
import { toScreen, worldCamera, worldStyle } from "./world";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Anchored to Gabriel's words (VO_SCRIPT v5.3 beat 4). */
const D = beatFrames(4);
const FOR_DEMO = said(4, "For this demo", 3.95);
const FORKED = Math.max(FOR_DEMO + 20, said(4, "we forked mainnet", 4.87));
const WEEK_W = Math.max(FORKED + 90, said(4, "market week", 9.71));
const EVERYTHING = Math.max(WEEK_W + 20, said(4, "Everything you see", 10.76));
const MORPH = [Math.max(EVERYTHING + 50, D - 54), Math.max(EVERYTHING + 90, D - 14)] as const;

const T = {
  mainnet: 40,
  fork: FORKED + 8,
  forkBranch: [FOR_DEMO + 6, FORKED + 16] as const,
  strip: [FORKED + 36, FORKED + 86] as const,
  url: EVERYTHING,
};

/** Logo → mainnet → a whip through the centre as the fork splits off → the fork → the whole set piece → into the
 *  fork's week strip, which grows into the full-frame week that Beat 5 opens on. */
const camera = worldCamera([
  [0, { x: 0, y: -60, zoom: 1.45 }],
  [20, { x: 0, y: -40, zoom: 1.22 }],
  [54, { x: -1220, y: 20, zoom: 1 }],
  [FOR_DEMO, { x: -1210, y: 20, zoom: 1.03 }],
  [FORKED + 10, { x: 1200, y: 20, zoom: 1 }],
  [WEEK_W - 30, { x: 1210, y: 20, zoom: 1.03 }],
  [WEEK_W + 10, { x: 0, y: 10, zoom: 0.5 }],
  [EVERYTHING + 30, { x: 0, y: 10, zoom: 0.52 }],
  [MORPH[0], { x: STRIP_SLOT.x, y: STRIP_SLOT.y, zoom: 1 }],
  [D, { x: STRIP_SLOT.x, y: STRIP_SLOT.y, zoom: 1 }],
]);

const LOGO = { w: 560, h: 560 * (64 / 259), cy: -110 };
const NODE_Y = 40;
const BRANCH = SIDE.inner - 40;

const Centre: FC<{ zoom: number }> = ({ zoom }) => {
  const frame = useCurrentFrame();
  const tone = useTone();
  const logo = interpolate(frame, [2, 28], [0, 1], { ...clamp, easing: ease.out });
  const stem = interpolate(frame, [18, 30], [0, 1], { ...clamp, easing: ease.out });
  const left = interpolate(frame, [26, 54], [0, 1], { ...clamp, easing: ease.inOut });
  const right = interpolate(frame, T.forkBranch, [0, 1], { ...clamp, easing: ease.inOut });
  const w = 2.6 / zoom;
  return (
    <>
      {/* The official X Layer lockup (X Layer docs media kit), revealed left to right, never redrawn. It sits in a
          sized box: an image placed straight into the 0×0 world container does not paint in headless Chromium. */}
      <div style={{ position: "absolute", left: -LOGO.w / 2, top: LOGO.cy - LOGO.h / 2, width: LOGO.w, height: LOGO.h, clipPath: `inset(0 ${(1 - logo) * 100}% 0 0)` }}>
        <Img
          src={staticFile(tone.name === "dark" ? "brand/xlayer/XLayer_Logo_White.svg" : "brand/xlayer/XLayer_Logo_Black.svg")}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>
      <svg style={{ position: "absolute", overflow: "visible" }} width={1} height={1}>
        <line x1={0} y1={-20} x2={0} y2={-20 + 60 * stem} stroke={tone.ink} strokeWidth={w} />
        <line x1={0} y1={NODE_Y} x2={-BRANCH * left} y2={NODE_Y} stroke={tone.ink} strokeWidth={w} />
        <line x1={0} y1={NODE_Y} x2={BRANCH * right} y2={NODE_Y} stroke={tone.ink} strokeWidth={w} />
        <circle cx={0} cy={NODE_Y} r={(7 * enter(frame, T.forkBranch[0], 12)) / Math.sqrt(zoom)} fill={tone.ink} />
      </svg>
      <div style={{ position: "absolute", left: 0, top: NODE_Y + 22, translate: "-50% 0", whiteSpace: "nowrap", fontFamily: font.mono, fontSize: 22, color: tone.muted, opacity: enter(frame, T.forkBranch[0] + 6, 16) }}>
        forks at block 71,563,431
      </div>
    </>
  );
};

const Scene: FC<{ scratchCaptions: boolean }> = ({ scratchCaptions }) => {
  const frame = useCurrentFrame();
  const cam = camera(frame);
  const morph = interpolate(frame, MORPH, [0, 1], { ...clamp, easing: ease.inOut });
  // The fork's week strip: drawn in screen space over its slot on the fork side, then grown to the full frame.
  const slot = toScreen(cam, STRIP_SLOT.x, STRIP_SLOT.y);
  const k = interpolate(morph, [0, 1], [(STRIP_SLOT.width * cam.zoom) / STRIP_WIDTH, 1]);
  const cx = interpolate(morph, [0, 1], [slot.x, WIDTH / 2]);
  const cy = interpolate(morph, [0, 1], [slot.y, HEIGHT / 2]);
  const strip = interpolate(frame, T.strip, [0, 1], { ...clamp, easing: ease.inOut });

  return (
    <AbsoluteFill>
      <div style={{ ...worldStyle(cam), opacity: leave(frame, MORPH[0] + 6, 24) }}>
        <Centre zoom={cam.zoom} />
        <MainnetSide at={T.mainnet} />
        <ForkSide at={T.fork} url={T.url} />
      </div>
      {strip > 0 ? (
        <div style={{ position: "absolute", left: 0, top: 0, width: WIDTH, height: HEIGHT, transformOrigin: "50% 50%", transform: `translate(${cx - WIDTH / 2}px, ${cy - HEIGHT / 2}px) scale(${k})` }}>
          <WeekTimeline camera={WEEK_VIEW} y={HEIGHT / 2} reveal={strip} />
        </div>
      ) : null}
      {frame < FOR_DEMO + 12 ? <HonestyLabel kinds={["LIVE"]} from={0} /> : <HonestyLabel kinds={["SANDBOX"]} from={FOR_DEMO + 12} />}
      <ScratchCaptions vo={beat(4).vo} show={scratchCaptions} />
    </AbsoluteFill>
  );
};

/**
 * Beat 4 · Live, and forked for this demo (Gabriel's VO, about 14.6 s, white). The X Layer mark in the centre; the
 * chain drops from it and splits at block 71,563,431. Left, X Layer mainnet: Intatto's contracts and the live
 * borrow. The camera whips through the centre as the fork's branch splits off to the right: the fork of mainnet,
 * chain 1960196, with its own week, which grows to fill the frame for Beat 5.
 */
export const Beat04Live: FC<BeatProps> = ({ scratchCaptions }) => (
  <Toned tone="light">
    <Scene scratchCaptions={scratchCaptions} />
  </Toned>
);
