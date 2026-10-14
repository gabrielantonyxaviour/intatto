import type { FC } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { LimitBar } from "../dial/LimitBar";
import { et, keyedClock, maxLtvAt, smoothedLtv } from "../dial/session";
import { SessionDial } from "../dial/SessionDial";
import { ThemeFlip } from "../dial/ThemeFlip";
import { beat } from "../script";
import type { BeatProps } from "../stage";
import { ease, enter, font, leave, RED } from "../theme";
import { useTone } from "../tone";
import { cueFrame, ScratchCaptions } from "../ui/Caption";
import { Wordmark } from "../ui/Wordmark";
import { BAR, FloorTick, Sheen } from "./details";
import { CHART, chartY, WeekChart } from "./WeekChart";

/** Beat 3 · Intatto (22 s). The name lands; the dial and the limit bar run the week; black at Fri 20:00 ET. */

const DIAL = { x: 740, y: 575, size: 560 } as const;
const WORD = { x: 960, y: 470, size: 200 } as const;
const HEADER = { x: 120, y: 100, scale: 0.2 } as const;
const PUSH = 0.04;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function useTimeline() {
  const { durationInFrames: D } = useVideoConfig();
  const vo = beat(3).vo;
  const cue = (p: string) => cueFrame(vo, D, p);
  const word = cue("Intatto") - 8;
  // The name holds ~2.5 s, then hands over so the dial draws on "the stock market's session".
  const shrink = cue("follows the stock market") - 24;
  const dialIn = shrink + 24;
  const runA = dialIn + 30;
  const close = cue("After the close");
  const drop = Math.max(cue("through the weekend"), close + 56);
  const liq = cue("The liquidation threshold");
  const dropEnd = Math.min(drop + 78, liq - 12);
  const clock = keyedClock([
    [dialIn, et(0, 9, 30)],
    [runA, et(0, 9, 30)],
    [runA + 62, et(4, 10, 30)],
    [close, et(4, 13, 0)],
    [close + 42, et(4, 20, 0)],
    [drop, et(4, 20, 0)],
    [dropEnd, et(6, 19, 30)],
  ]);
  return {
    D,
    vo,
    word,
    desc: cue("a lending market") + 4,
    shrink,
    dialIn,
    flip: close + 40,
    twenty: cue("decays toward twenty"),
    liq,
    lendLess: cue("We take less new risk"),
    goalposts: cue("never move the goalposts"),
    clock,
  };
}

type Timeline = ReturnType<typeof useTimeline>;

const pushAt = (frame: number, t: Timeline) => 1 + PUSH * interpolate(frame, [t.dialIn, t.D], [0, 1], clamp);

export const Beat03: FC<BeatProps> = ({ scratchCaptions }) => {
  const frame = useCurrentFrame();
  const t = useTimeline();
  const content = (
    <>
      <Scene t={t} />
      <ScratchCaptions vo={t.vo} show={scratchCaptions} />
    </>
  );
  if (frame < t.flip) {
    // Beat 2 ends black; the name opens in a white circle from the centre.
    return (
      <ThemeFlip start={0} duration={22} origin={{ x: WORD.x, y: WORD.y }} from="dark" to="light">
        {content}
      </ThemeFlip>
    );
  }
  // The market closes: black grows out of the dial's centre (tracked through the camera push).
  const s = pushAt(t.flip, t);
  const origin = { x: 960 + (DIAL.x - 960) * s, y: 540 + (DIAL.y - 540) * s };
  return (
    <ThemeFlip start={t.flip} duration={34} origin={origin} from="light" to="dark">
      {content}
    </ThemeFlip>
  );
};

const Scene: FC<{ t: Timeline }> = ({ t }) => {
  const frame = useCurrentFrame();
  const tone = useTone();
  const etNow = t.clock(frame);
  const handoff = interpolate(frame, [t.shrink, t.shrink + 34], [0, 1], {
    ...clamp,
    easing: ease.inOut,
  });
  const descIn = enter(frame, t.desc, 20) * leave(frame, t.shrink - 6, 12);
  const toC = leave(frame, t.liq - 8, 14);
  const stretch = interpolate(frame, [t.liq, t.liq + 30], [0, 1], {
    ...clamp,
    easing: ease.inOut,
  });
  const redY = chartY(65);
  return (
    <AbsoluteFill>
      {/* The name, then the header it becomes (outside the camera push, so it stays on the safe margin) */}
      <div
        style={{
          position: "absolute",
          left: interpolate(handoff, [0, 1], [WORD.x, HEADER.x]),
          top: interpolate(handoff, [0, 1], [WORD.y, HEADER.y]),
          transformOrigin: "0 0",
          translate: `${-50 * (1 - handoff)}% ${-50 * (1 - handoff)}%`,
          scale: String(
            interpolate(
              handoff,
              [0, 1],
              [1 + 0.03 * interpolate(frame, [t.word, t.shrink], [0, 1], clamp), HEADER.scale],
            ),
          ),
        }}
      >
        <Wordmark fontSize={WORD.size} start={t.word} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: WORD.y + 150,
          textAlign: "center",
          fontFamily: font.sans,
          fontWeight: 500,
          fontSize: 40,
          letterSpacing: "-0.01em",
          color: tone.muted,
          opacity: descIn,
          translate: `0px ${(1 - enter(frame, t.desc, 20)) * 18}px`,
        }}
      >
        A lending market on X Layer
      </div>

      <AbsoluteFill style={{ scale: String(pushAt(frame, t)) }}>
        {/* The motif */}
        <SessionDial
          etMinutes={etNow}
          x={DIAL.x}
          y={DIAL.y}
          size={DIAL.size}
          reveal={interpolate(frame, [t.dialIn, t.dialIn + 42], [0, 1], {
            ...clamp,
            easing: ease.out,
          })}
          clockStep={frame < t.liq ? 15 : 30}
          closedFade={enter(frame, t.flip + 4, 26)}
          style={{
            opacity: toC,
            scale: String(interpolate(toC, [0, 1], [0.92, 1])),
          }}
        />
        <LimitBar
          ltv={smoothedLtv(t.clock, frame)}
        value={maxLtvAt(etNow)}
          x={BAR.x}
          y={BAR.y}
          height={BAR.h}
          reveal={interpolate(frame, [t.dialIn + 14, t.dialIn + 54], [0, 1], {
            ...clamp,
            easing: ease.out,
          })}
          style={{ opacity: leave(frame, t.liq - 8, 10) }}
        />
        <FloorTick at={t.twenty} fade={toC} />

        {/* Shot C: the bar's red line stretches into the week */}
        {frame >= t.liq - 8 ? (
          <>
            <WeekChart
              frameIn={enter(frame, t.liq + 4, 24)}
              draw={interpolate(frame, [t.liq + 14, t.liq + 76], [0, 1], {
                ...clamp,
                easing: ease.inOut,
              })}
              weekend={enter(frame, t.lendLess, 20)}
              cursorEt={etNow}
              cursor={enter(frame, t.liq + 78, 16)}
            />
            <div
              style={{
                position: "absolute",
                left: interpolate(stretch, [0, 1], [BAR.x - 10, CHART.left]),
                width: interpolate(stretch, [0, 1], [292, CHART.right - CHART.left]),
                top: redY - 1.5,
                height: 3,
                background: RED,
                borderRadius: 2,
                scale: `1 ${1 + enter(frame, t.goalposts, 16) * 0.67}`,
                overflow: "hidden",
              }}
            >
              <Sheen frame={frame} start={t.goalposts} />
            </div>
            <div
              style={{
                position: "absolute",
                left: BAR.x + 50,
                top: redY - 60,
                opacity: leave(frame, t.liq - 8, 10),
                fontFamily: font.mono,
                fontSize: 22,
                lineHeight: "28px",
                color: RED,
              }}
            >
              Liquidation 65%
              <div
                style={{
                  fontFamily: font.sans,
                  fontSize: 20,
                  lineHeight: "24px",
                  color: tone.muted,
                }}
              >
                never moves
              </div>
            </div>
          </>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
