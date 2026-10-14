import type { FC } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { DAYS, WEEKEND_END, WEEKEND_START, WEEK } from "../dial/session";
import { Toned } from "../dial/ThemeFlip";
import { beat } from "../script";
import type { BeatProps } from "../stage";
import { ease, enter, font, leave } from "../theme";
import { useTone } from "../tone";
import { cueFrame, ScratchCaptions } from "../ui/Caption";
import { Unroll } from "./Unroll";
import { Supply } from "./Supply";
import { TRACK, type Timeline } from "./track";

/**
 * Beat 1 · Hook (11 s, white). Shot A: the dial unrolls into two weeks: NVDAx lit 24/7, NVDA only in session.
 * Shot B: the token's 24/7 line contracts into the rule under ~$91.5M (Crypto Briefing, 12 Sep 2026), and it's
 * nowhere to borrow (Aave on X Layer: getReservesList, 11 reserves, no stocks, read 25 Sep 2026).
 */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function useTimeline(): Timeline {
  const { durationInFrames: D } = useVideoConfig();
  const vo = beat(1).vo;
  const cue = (p: string) => cueFrame(vo, D, p);
  const seven = cue("twenty-four seven");
  const under = cue("The stocks underneath");
  const money = cue("ninety million");
  return { D, vo, seven, under, dont: cue("don't"), money, cant: cue("right now") };
}

export const Beat01: FC<BeatProps> = ({ scratchCaptions }) => {
  const frame = useCurrentFrame();
  const t = useTimeline();
  return (
    <Toned tone="light">
      <AbsoluteFill style={{ scale: String(1 + 0.03 * interpolate(frame, [0, t.D], [0, 1], clamp)) }}>
        <Weeks t={t} />
        <Supply t={t} />
      </AbsoluteFill>
      <ScratchCaptions vo={t.vo} show={scratchCaptions} />
    </Toned>
  );
};

const Weeks: FC<{ t: Timeline }> = ({ t }) => {
  const frame = useCurrentFrame();
  const tone = useTone();
  const out = leave(frame, t.money - 4, 16);
  const tokenK = enter(frame, t.seven + 36, 18);
  const stockK = enter(frame, t.under + 58, 18);
  const band = enter(frame, t.dont - 6, 20) * out;
  const x = (et: number) => TRACK.x0 + (et / WEEK) * TRACK.width;
  const drop = (1 - out) * 40;
  return (
    <>
      {/* The weekend, behind both lines: the token keeps going, the stock has nothing */}
      <div
        style={{
          position: "absolute",
          left: x(WEEKEND_START),
          width: x(WEEKEND_END) - x(WEEKEND_START),
          top: TRACK.a - 110,
          height: TRACK.b - TRACK.a + 200,
          background: tone.wash,
          opacity: band,
          borderRadius: 6,
        }}
      />
      <Label x={x(WEEKEND_START)} y={TRACK.a - 150} k={band} mono muted text="WEEKEND · FRI 20:00 → SUN 20:00 ET" />
      {frame < t.money + 2 ? (
        <Unroll
          kind="token"
          ax={960}
          y={TRACK.a}
          r={120}
          x0={TRACK.x0}
          width={TRACK.width}
          draw={interpolate(frame, [4, 32], [0, 1], { ...clamp, easing: ease.out })}
          unroll={interpolate(frame, [t.seven - 16, t.seven + 14], [0, 1], clamp)}
          spread={interpolate(frame, [t.seven + 8, t.seven + 44], [0, 1], clamp)}
        />
      ) : null}
      <RingLabel x={960} y={TRACK.a - 120} k={enter(frame, 10, 16) * leave(frame, t.seven - 18, 8)} top="NVDAx" bottom="onchain" />
      <Label x={TRACK.x0} y={TRACK.a - 58} k={tokenK * out} text="NVDAx · onchain" />
      <Label x={TRACK.x0 + TRACK.width + 28} y={TRACK.a - 16} k={tokenK * out} mono text="24/7" />

      <div style={{ opacity: out, translate: `0px ${drop}px` }}>
        <Unroll
          kind="stock"
          ax={960}
          y={TRACK.b}
          r={100}
          x0={TRACK.x0}
          width={TRACK.width}
          draw={interpolate(frame, [t.under - 6, t.under + 16], [0, 1], { ...clamp, easing: ease.out })}
          unroll={interpolate(frame, [t.under + 14, t.under + 38], [0, 1], clamp)}
          spread={interpolate(frame, [t.under + 32, t.under + 66], [0, 1], clamp)}
        />
        <RingLabel x={960} y={TRACK.b - 100} k={enter(frame, t.under, 14) * leave(frame, t.under + 12, 8)} top="NVDA" bottom="Nasdaq" />
        <Label x={TRACK.x0} y={TRACK.b - 58} k={stockK} text="NVDA · Nasdaq" />
        <Label x={TRACK.x0 + TRACK.width + 28} y={TRACK.b - 16} k={stockK} mono text="in session" />
        {DAYS.map((d, i) => (
          <Label key={d} x={x(i * 1440 + 720)} y={TRACK.b + 36} k={enter(frame, t.under + 44 + i * 2, 14)} mono muted center text={d} />
        ))}
      </div>
    </>
  );
};

const Label: FC<{ x: number; y: number; k: number; text: string; mono?: boolean; muted?: boolean; center?: boolean }> = ({
  x,
  y,
  k,
  text,
  mono,
  muted,
  center,
}) => {
  const tone = useTone();
  if (k <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        translate: `${center ? "-50%" : "0%"} ${(1 - k) * 12}px`,
        opacity: k,
        fontFamily: mono ? font.mono : font.sans,
        fontWeight: mono ? 400 : 600,
        fontSize: mono ? 22 : 30,
        letterSpacing: mono ? "0.04em" : "-0.01em",
        color: muted ? tone.muted : tone.ink,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};

const RingLabel: FC<{ x: number; y: number; k: number; top: string; bottom: string }> = ({ x, y, k, top, bottom }) => {
  const tone = useTone();
  if (k <= 0) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, translate: "-50% -50%", textAlign: "center", opacity: k }}>
      <div style={{ fontFamily: font.mono, fontSize: 30, color: tone.ink }}>{top}</div>
      <div style={{ fontFamily: font.sans, fontSize: 20, color: tone.muted, marginTop: 4 }}>{bottom}</div>
    </div>
  );
};
