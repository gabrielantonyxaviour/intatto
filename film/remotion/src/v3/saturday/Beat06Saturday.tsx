import type { FC } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Stamp } from "../beat05/Stamp";
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
import { BOX, camera, clock, CUES, FRIDAY, PAGE_CAM, PAGE_CAM_FRIDAY, REPAID, REPAY_FORM, SATURDAY, STAMP, T, WINDOW } from "./shots";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const STRIP_Y = 540;

const Scene: FC<{ scratchCaptions: boolean }> = ({ scratchCaptions }) => {
  const frame = useCurrentFrame();
  const cam = camera(frame);
  const friday = frame < T.run[0];
  const dive = friday
    ? interpolate(frame, T.out, [1, 0], clamp)
    : frame < T.pullOut[0]
      ? interpolate(frame, T.dive, [0, 1], clamp)
      : interpolate(frame, T.pullOut, [1, 0], clamp);
  const page = friday ? pageCamera(frame, PAGE_CAM_FRIDAY) : pageCamera(frame, PAGE_CAM);
  const s = (WINDOW.width / 1440) * page.zoom;
  // Hard cuts on the camera moves (a dissolve between two busy screens leaves half-faded text over text).
  const toRepay = interpolate(frame, [T.repay, T.repay + 1], [0, 1], clamp);
  const toRepaid = interpolate(frame, [T.repaid, T.repaid + 1], [0, 1], clamp);
  const playheadAt = { x: xOf(clock(frame), cam), y: STRIP_Y };

  return (
    <AbsoluteFill>
      <WeekTimeline camera={cam} y={STRIP_Y} playhead={clock(frame)} clockStep={15} style={{ opacity: interpolate(dive, [0.3, 0.8], [1, 0], clamp) }} />
      <Dive progress={dive} anchor={playheadAt} target={WINDOW}>
        <PageCam width={WINDOW.width} height={WINDOW.height} zoom={page.zoom} focus={page.focus}>
          {friday ? (
            <Footage segments={FRIDAY} />
          ) : (
            <>
              <div style={{ position: "absolute", inset: 0, opacity: 1 - toRepay }}>
                <Footage segments={SATURDAY} />
                <PageBox at={CUES.badge} {...BOX.badge} scale={s} until={T.typing} />
                <PageBox at={CUES.closed} {...BOX.closed} scale={s} until={T.typing + 6} />
                <PageBox at={CUES.nothingSigned} {...BOX.nothingSigned} scale={s} />
              </div>
              <div style={{ position: "absolute", inset: 0, opacity: toRepay * (1 - toRepaid) }}>
                <Footage segments={REPAY_FORM} />
                <PageBox at={CUES.repayNote} {...BOX.repayNote} scale={s} />
              </div>
              <div style={{ position: "absolute", inset: 0, opacity: toRepaid }}>
                <Footage segments={REPAID} />
                <PageBox at={CUES.repaid} {...BOX.repaid} scale={s} color={GREEN} />
                <PageBox at={CUES.everySession} {...BOX.everySession} scale={s} />
              </div>
            </>
          )}
        </PageCam>
      </Dive>
      <Stamp at={T.refused + 2} until={T.stampOff} x={STAMP.x} y={STAMP.y} />
      <HonestyLabel kinds={["SANDBOX"]} from={-20} />
      <ScratchCaptions vo={beat(6).vo} show={scratchCaptions} />
    </AbsoluteFill>
  );
};

/**
 * Beat 6 · Saturday (Gabriel's VO, about 19.2 s, white → black). Out of Friday's receipts; the camera rides the playhead as the clock
 * runs to Saturday 08:00 ET, and the frame flips black from the playhead at Fri 20:00; in to Saturday: the limit is
 * 28.12% (CLOSED), 10 more USDG is refused before signing (SessionLimit), the repay of 100 USDG goes through; then
 * out to the black week, where Beat 7 picks up.
 */
export const Beat06Saturday: FC<BeatProps> = ({ scratchCaptions }) => (
  <SessionFlips clock={clock} from={0} to={T.end} origin={(f) => ({ x: xOf(clock(f), camera(f)), y: STRIP_Y })}>
    <Scene scratchCaptions={scratchCaptions} />
  </SessionFlips>
);
