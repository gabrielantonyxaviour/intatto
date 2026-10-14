import type { FC } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { et, keyedClock, type Clock } from "../dial/session";
import { beat } from "../script";
import type { BeatProps } from "../stage";
import { ease, enter, font, GREEN } from "../theme";
import { useTone } from "../tone";
import { cueFrame, ScratchCaptions } from "../ui/Caption";
import { Wordmark } from "../ui/Wordmark";
import { keyedCamera, WEEK_VIEW, xOf } from "../week/camera";
import { SessionFlips } from "../week/SessionFlips";
import { WeekTimeline } from "../week/WeekTimeline";

/**
 * Beat 11 · Close (10 s). The week one last time: the playhead sweeps Monday to Sunday night (black at Fri 20:00,
 * white again at Sun 20:00: any day of the week). The strip collapses into the playhead's dot, which travels into
 * the "." of intatto.larinova.com as the name lands. Hold 2.5 s.
 */

const STRIP_Y = 560;
const URL = "intatto.larinova.com";
const URL_SIZE = 46;
const URL_TOP = 600;
/** JetBrains Mono advances 0.6 em per character, so the period's centre is exact. */
const DOT = { x: 960 - (URL.length * 0.6 * URL_SIZE) / 2 + 7.5 * 0.6 * URL_SIZE, y: URL_TOP + URL_SIZE * 0.84 };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function useTimeline() {
  const { durationInFrames: D } = useVideoConfig();
  const vo = beat(11).vo;
  const cue = (p: string) => cueFrame(vo, D, p);
  const sweep = cue("borrow against") - 10;
  const fold = cue("twenty-four seven") + 30;
  const live = cue("intatto dot") - 8;
  const END = et(6, 22, 30);
  const clock: Clock = keyedClock([
    [0, et(0, 9, 30)],
    [sweep, et(0, 9, 30)],
    [fold - 8, END],
  ]);
  const camera = keyedCamera([
    [fold, WEEK_VIEW],
    [fold + 26, { focus: END, zoom: 0.04 }],
  ]);
  return { D, vo, sweep, fold, live, clock, camera, land: fold + 22 };
}

export const Beat11: FC<BeatProps> = ({ scratchCaptions }) => {
  const t = useTimeline();
  return (
    <SessionFlips clock={t.clock} from={0} to={t.D} origin={(f) => ({ x: xOf(t.clock(f), t.camera(f)), y: STRIP_Y })} duration={26}>
      <Scene t={t} />
      <ScratchCaptions vo={t.vo} show={scratchCaptions} />
    </SessionFlips>
  );
};

const Scene: FC<{ t: ReturnType<typeof useTimeline> }> = ({ t }) => {
  const frame = useCurrentFrame();
  const tone = useTone();
  const cam = t.camera(frame);
  const now = t.clock(frame);
  const folded = interpolate(frame, [t.fold, t.fold + 26], [0, 1], { ...clamp, easing: ease.inOut });
  const travel = interpolate(frame, [t.fold + 12, t.live + 4], [0, 1], { ...clamp, easing: ease.inOut });
  const head = { x: xOf(now, cam), y: STRIP_Y };
  const dot = {
    x: interpolate(travel, [0, 1], [head.x, DOT.x]),
    y: interpolate(travel, [0, 1], [head.y, DOT.y]) - Math.sin(travel * Math.PI) * 60,
    d: interpolate(travel, [0, 1], [22, URL_SIZE * 0.2]),
  };
  const urlK = enter(frame, t.live - 4, 20);
  const liveK = enter(frame, t.live + 14, 18);
  return (
    <AbsoluteFill>
      {folded < 1 ? (
        <WeekTimeline
          camera={cam}
          y={STRIP_Y}
          band={60}
          playhead={folded < 0.2 ? now : undefined}
          clockStep={30}
          reveal={interpolate(frame, [0, 30], [0, 1], { ...clamp, easing: ease.out })}
          style={{ opacity: 1 - Math.min(1, folded / 0.3) }}
        />
      ) : null}
      {folded >= 0.2 && travel < 1 ? (
        <div style={{ position: "absolute", left: dot.x - dot.d / 2, top: dot.y - dot.d / 2, width: dot.d, height: dot.d, borderRadius: dot.d, background: tone.ink }} />
      ) : null}
      <div style={{ position: "absolute", left: 0, right: 0, top: 360, display: "flex", justifyContent: "center" }}>
        <Wordmark fontSize={168} start={t.land} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 960 - (URL.length * 0.6 * URL_SIZE) / 2,
          top: URL_TOP,
          fontFamily: font.mono,
          fontSize: URL_SIZE,
          lineHeight: 1,
          letterSpacing: 0,
          color: tone.ink,
          whiteSpace: "pre",
        }}
      >
        {[...URL].map((ch, i) => (
          <span key={i} style={{ opacity: i === 7 ? (travel >= 1 ? 1 : 0) : urlK, translate: `0px ${i === 7 ? 0 : (1 - urlK) * 10}px`, display: "inline-block" }}>
            {ch}
          </span>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: URL_TOP + 84,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 12,
          opacity: liveK,
          fontFamily: font.mono,
          fontSize: 24,
          color: tone.muted,
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: 5, background: GREEN }} />
        Live on X Layer mainnet
      </div>
    </AbsoluteFill>
  );
};
