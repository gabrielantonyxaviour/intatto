import type { FC } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Footage } from "../footage/Footage";
import { beat } from "../script";
import type { BeatProps } from "../stage";
import { GREEN } from "../theme";
import { ScratchCaptions } from "../ui/Caption";
import { HonestyLabel } from "../ui/Chip";
import { PageBox } from "../uibeats/Callout";
import { camera as pageCamera } from "../uibeats/camera";
import { PageCam } from "../uibeats/PageCam";
import { xOf } from "../week/camera";
import { Dive } from "../week/Dive";
import { SessionFlips } from "../week/SessionFlips";
import { WeekTimeline } from "../week/WeekTimeline";
import { BOX, camera, clock, CUES, DIVE, END, FORM, PAGE_CAM, RECEIPTS, TO_RECEIPTS, WINDOW } from "./shots";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const STRIP_Y = 540;

const Scene: FC<{ scratchCaptions: boolean }> = ({ scratchCaptions }) => {
  const frame = useCurrentFrame();
  const cam = camera(frame);
  const dive = interpolate(frame, DIVE, [0, 1], clamp);
  const page = pageCamera(frame, PAGE_CAM);
  const s = (WINDOW.width / 1440) * page.zoom;
  const receipts = interpolate(frame, TO_RECEIPTS, [0, 1], clamp);
  return (
    <AbsoluteFill>
      <WeekTimeline
        camera={cam}
        y={STRIP_Y}
        playhead={frame >= 6 ? clock(frame) : undefined}
        clockStep={15}
        style={{ opacity: interpolate(dive, [0.3, 0.8], [1, 0], clamp) }}
      />
      <Dive progress={dive} anchor={{ x: xOf(clock(frame), cam), y: STRIP_Y }} target={WINDOW}>
        <PageCam width={WINDOW.width} height={WINDOW.height} zoom={page.zoom} focus={page.focus}>
          <div style={{ position: "absolute", inset: 0, opacity: 1 - receipts }}>
            <Footage segments={FORM} />
            <PageBox at={CUES.badge} {...BOX.badge} scale={s} until={CUES.formEnd} />
            <PageBox at={CUES.session} {...BOX.session} scale={s} />
            <PageBox at={CUES.ltv} {...BOX.ltv} scale={s} />
          </div>
          <div style={{ position: "absolute", inset: 0, opacity: receipts }}>
            <Footage segments={RECEIPTS} />
            <PageBox at={CUES.receipts} {...BOX.receipts} scale={s} color={GREEN} />
          </div>
        </PageCam>
      </Dive>
      <HonestyLabel kinds={["SANDBOX"]} from={-20} />
      <ScratchCaptions vo={beat(5).vo} show={scratchCaptions} />
    </AbsoluteFill>
  );
};

/**
 * Beat 5 · Friday (Gabriel's VO, about 16.3 s, white). The week from Beat 4; the playhead runs from Monday's open to Friday 13:00 ET
 * (the fork's real chain time for this take), the camera dives into that moment, and the moment opens into the
 * Borrow screen: OPEN, a 50% limit, 4 NVDAx in and 361 USDG out at 39.94% LTV, then both receipts confirm.
 */
export const Beat05Friday: FC<BeatProps> = ({ scratchCaptions }) => (
  <SessionFlips clock={clock} from={0} to={END} origin={(f) => ({ x: xOf(clock(f), camera(f)), y: STRIP_Y })}>
    <Scene scratchCaptions={scratchCaptions} />
  </SessionFlips>
);
