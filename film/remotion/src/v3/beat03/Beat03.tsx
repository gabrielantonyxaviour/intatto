import type { FC } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { et, keyedClock, smoothedLtv, type Clock } from "../dial/session";
import { SessionDial } from "../dial/SessionDial";
import { beat } from "../script";
import type { BeatProps } from "../stage";
import { ease, enter } from "../theme";
import { cueFrame, ScratchCaptions } from "../ui/Caption";
import { SessionFlips } from "../week/SessionFlips";
import { KnockoutDive } from "./KnockoutDive";
import { Market, type MarketCues } from "./Market";

/**
 * Beat 3 · Intatto (18 s, black → white → black). The name lands as white type on beat 2's black and we dive
 * through its "I" into white. The product in one picture: NVDAx in, USDG streaming out, any day of the week. The
 * session dial rises under it and the USDG stream's width follows the session (wider while the stock trades); at
 * Fri 20:00 black grows from the dial and the stream thins;
 * the clock runs on through the weekend while the open loan's liquidation threshold doesn't move, and at Sun 20:00
 * the ground turns white again from the dial. No percentages.
 */

const DIAL = { x: 960, y: 790, size: 360 } as const;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function useTimeline() {
  const { durationInFrames: D } = useVideoConfig();
  const vo = beat(3).vo;
  const cue = (p: string) => cueFrame(vo, D, p);
  const land = cue("Intatto") - 8;
  const diveStart = cue("lives natively") - 6;
  const key = cue("The key thing");
  const tracks = cue("tracks the market session");
  const closes = cue("it tightens");
  const rules = cue("the liquidation threshold never moves");
  // Thu afternoon → Fri morning on "tracks" (the stream thins overnight and widens at the open), then the close.
  const clock: Clock = keyedClock([
    [0, et(3, 14, 0)],
    [tracks, et(3, 14, 0)],
    [tracks + 70, et(4, 11, 0)],
    [closes - 12, et(4, 13, 0)],
    [closes + 22, et(4, 20, 0)],
    [rules, et(4, 21, 0)],
    // Through the weekend to Sun 20:00, when the closed period ends: white again from the dial in the last
    // second, so the open loan has visibly ridden out the whole weekend, and beat 4 opens on white.
    [D - 30, et(6, 19, 40)],
    [D - 8, et(6, 20, 40)],
  ]);
  const market: MarketCues = {
    box: diveStart + 30,
    putIn: cue("put in your"),
    usdg: cue("borrow USDG"),
    anyDay: cue("any day of the week"),
    dayOut: key - 6,
    rules: rules - 4,
  };
  return { D, vo, land, diveStart, diveEnd: diveStart + 28, key, clock, market, dialIn: cue("knows when") - 10 };
}

export const Beat03: FC<BeatProps> = ({ scratchCaptions }) => {
  const frame = useCurrentFrame();
  const t = useTimeline();
  const scene = (
    <>
      <Scene t={t} />
      <ScratchCaptions vo={t.vo} show={scratchCaptions} />
    </>
  );
  return (
    <AbsoluteFill>
      {frame < t.diveEnd ? <KnockoutDive land={t.land} diveStart={t.diveStart} diveEnd={t.diveEnd} /> : null}
      {frame >= t.diveEnd - 8 ? (
        <AbsoluteFill style={{ opacity: interpolate(frame, [t.diveEnd - 8, t.diveEnd], [0, 1], clamp) }}>
          <SessionFlips clock={t.clock} from={t.diveEnd - 8} to={t.D} origin={(f) => { const a = ((t.clock(f) % 1440) / 1440) * 2 * Math.PI - Math.PI / 2; return { x: DIAL.x + (Math.cos(a) * DIAL.size) / 2, y: DIAL.y + (Math.sin(a) * DIAL.size) / 2 }; }} duration={22}>
            {scene}
          </SessionFlips>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

const Scene: FC<{ t: ReturnType<typeof useTimeline> }> = ({ t }) => {
  const frame = useCurrentFrame();
  const lift = interpolate(frame, [t.key - 4, t.key + 26], [0, 1], { ...clamp, easing: ease.inOut });
  const push = 1 + 0.02 * interpolate(frame, [t.diveEnd, t.D], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ scale: String(push) }}>
      <AbsoluteFill style={{ translate: `0px ${-120 * lift}px`, scale: String(1 - 0.1 * lift), transformOrigin: "960px 470px" }}>
        <Market c={t.market} streamWidth={interpolate(smoothedLtv(t.clock, frame, 14), [20, 30, 40, 50], [14, 22, 44, 76], clamp)} />
      </AbsoluteFill>
      <SessionDial
        etMinutes={t.clock(frame)}
        x={DIAL.x}
        y={DIAL.y}
        size={DIAL.size}
        hours={false}
        clockStep={15}
        reveal={interpolate(frame, [t.dialIn, t.dialIn + 36], [0, 1], { ...clamp, easing: ease.out })}
        style={{ opacity: enter(frame, t.dialIn, 10) }}
      />
    </AbsoluteFill>
  );
};
