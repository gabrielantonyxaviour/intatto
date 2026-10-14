import type { FC } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { et, keyedClock, type Clock } from "../dial/session";
import { beat } from "../script";
import type { BeatProps } from "../stage";
import { ease, enter, font, leave } from "../theme";
import { useTone } from "../tone";
import { cueFrame, ScratchCaptions } from "../ui/Caption";
import { keyedCamera, xOf, type WeekCamera } from "../week/camera";
import { SessionFlips } from "../week/SessionFlips";
import { WeekTimeline } from "../week/WeekTimeline";
import { Exchanges, GapBracket, IssuerReadout, STRIP_Y, TokenPrints } from "./parts";

/**
 * Beat 2 · Why it's hard (16 s, white → black). The exchanges in plain type squash flat into the week's line; the
 * clock runs to Fri 20:00 ET and black grows from the playhead ("Price discovery stops"); the token keeps printing
 * thinly; the issuer's max order is $0; a red bracket from Friday's close to Monday's open reads "Gap risk".
 */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const CLOSE = et(4, 20, 0);
const MON_OPEN = et(7, 9, 30);

function useTimeline() {
  const { durationInFrames: D } = useVideoConfig();
  const vo = beat(2).vo;
  const cue = (p: string) => cueFrame(vo, D, p);
  const squash = cue("doing it onchain") - 4;
  const stops = cue("Price discovery stops");
  const token = cue("The token keeps trading");
  const issuer = cue("even the issuer");
  const lend = cue("Lend into that");
  const clock: Clock = keyedClock([
    [0, et(4, 14, 0)],
    [stops - 20, et(4, 14, 0)],
    [stops + 26, CLOSE],
    [token + 30, et(5, 9, 0)],
    [D, et(5, 15, 0)],
  ]);
  const camera = keyedCamera([
    [squash + 14, { focus: et(3, 12, 0), zoom: 1 }],
    [stops - 20, { focus: et(4, 16, 0), zoom: 3.2 }],
    [stops + 30, { focus: et(4, 19, 0), zoom: 3.2 }],
    [token + 40, { focus: et(6, 2, 45), zoom: 2.1 }],
  ]);
  return { D, vo, squash, stops, token, issuer, lend, clock, camera };
}

export const Beat02: FC<BeatProps> = ({ scratchCaptions }) => {
  const t = useTimeline();
  return (
    <SessionFlips clock={t.clock} from={0} to={t.D} origin={(f) => ({ x: xOf(t.clock(f), t.camera(f)), y: STRIP_Y })} duration={32}>
      <Scene t={t} />
      <ScratchCaptions vo={t.vo} show={scratchCaptions} />
    </SessionFlips>
  );
};

const Scene: FC<{ t: ReturnType<typeof useTimeline> }> = ({ t }) => {
  const frame = useCurrentFrame();
  const tone = useTone();
  const cam: WeekCamera = t.camera(frame);
  const now = t.clock(frame);
  const strip = frame >= t.squash + 12;
  const headline = enter(frame, t.stops + 30, 20) * leave(frame, t.issuer - 10, 14);
  return (
    <AbsoluteFill style={{ scale: String(1 + 0.025 * interpolate(frame, [0, t.D], [0, 1], clamp)) }}>
      <Exchanges start={10} squash={t.squash} />
      {strip ? (
        <WeekTimeline
          camera={cam}
          y={STRIP_Y}
          days={[0, 7]}
          playhead={frame >= t.squash + 30 ? now : undefined}
          clockStep={15}
          reveal={interpolate(frame, [t.squash + 12, t.squash + 40], [0, 1], { ...clamp, easing: ease.out })}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 150,
          textAlign: "center",
          opacity: headline,
          translate: `0px ${(1 - enter(frame, t.stops + 30, 20)) * 20}px`,
          fontFamily: font.sans,
          fontWeight: 700,
          fontSize: 96,
          letterSpacing: "-0.035em",
          color: tone.ink,
        }}
      >
        Price discovery stops
      </div>
      <TokenPrints camera={cam} until={now} k={enter(frame, t.token, 20)} />
      <IssuerReadout at={t.issuer + 6} out={t.lend - 6} />
      <GapBracket camera={cam} from={et(4, 20, 0)} to={MON_OPEN} at={t.lend + 4} />
    </AbsoluteFill>
  );
};
