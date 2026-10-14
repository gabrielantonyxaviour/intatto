import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { DAYS } from "../dial/session";
import { ease, enter, font, leave, RED } from "../theme";
import { useTone } from "../tone";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const ROW_Y = 470;
const BOX = { x: 960, w: 540, h: 280 } as const;
const COIN = 190;
const LEFT_X = 210;
/** Symmetric with USDG: the collateral sits as far left of the market as the borrowed USDG sits right. */
const DOCK_X = 300;
const RIGHT_X = 1620;

export type MarketCues = { box: number; putIn: number; usdg: number; anyDay: number; dayOut: number; rules: number };

/** A token as a coin: outlined disc, ticker inside, what it is underneath. */
const Coin: FC<{ x: number; label: string; sub: string; k: number }> = ({ x, label, sub, k }) => {
  const tone = useTone();
  return (
    <div style={{ position: "absolute", left: x - COIN / 2, top: ROW_Y - COIN / 2, width: COIN, opacity: k, scale: String(0.85 + 0.15 * k) }}>
      <div
        style={{
          width: COIN,
          height: COIN,
          borderRadius: COIN / 2,
          border: `2px solid ${tone.ink}`,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: font.mono,
          fontSize: 38,
          color: tone.ink,
        }}
      >
        {label}
      </div>
      <div style={{ position: "absolute", top: COIN + 16, left: "50%", translate: "-50% 0%", fontFamily: font.sans, fontSize: 28, color: tone.muted, whiteSpace: "nowrap" }}>
        {sub}
      </div>
    </div>
  );
};

/** USDG leaving the market as a stream; its width is how much you can borrow right now (no numbers): it follows the session. */
const Stream: FC<{ width: number; k: number }> = ({ width, k }) => {
  const frame = useCurrentFrame();
  const tone = useTone();
  const a = BOX.x + BOX.w / 2 + 12;
  const b = RIGHT_X - COIN / 2 - 16;
  const len = b - a;
  const hash = (i: number, k: number) => Math.abs(Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1;
  const dots = Array.from({ length: 40 }, (_, i) => {
    // Each dot has its own lane and speed (hashed), so the stream reads as flow, not stripes.
    const speed = 3.2 + hash(i, 1) * 2.4;
    const p = ((frame * speed + hash(i, 2) * len) % len) / len;
    const lane = (hash(i, 3) - 0.5) * (width - 10);
    const edge = Math.min(p, 1 - p) * 8;
    return { x: a + p * len, y: ROW_Y + lane, o: Math.min(1, edge), d: Math.max(4, Math.min(8, width * 0.35)) };
  });
  return (
    <div style={{ position: "absolute", inset: 0, opacity: k }}>
      <div style={{ position: "absolute", left: a, width: len * k, top: ROW_Y - width / 2, height: 1.5, background: tone.hairline }} />
      <div style={{ position: "absolute", left: a, width: len * k, top: ROW_Y + width / 2, height: 1.5, background: tone.hairline }} />
      {dots.map((d, i) => (d.x < a + len * k ? <div key={i} style={{ position: "absolute", left: d.x - d.d / 2, top: d.y - d.d / 2, width: d.d, height: d.d, borderRadius: d.d, background: tone.ink, opacity: d.o }} /> : null))}
    </div>
  );
};

/** Row: NVDAx docks into the Intatto market, USDG streams out. Plus the week's pips and the open loan's gauge. */
export const Market: FC<{ c: MarketCues; streamWidth: number }> = ({ c, streamWidth }) => {
  const frame = useCurrentFrame();
  const tone = useTone();
  const boxK = interpolate(frame, [c.box, c.box + 26], [0, 1], { ...clamp, easing: ease.out });
  const dock = interpolate(frame, [c.putIn, c.putIn + 26], [0, 1], { ...clamp, easing: ease.inOut });
  const usdgK = enter(frame, c.usdg, 20);
  const perim = 2 * (BOX.w + BOX.h);
  return (
    <>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <rect
          x={BOX.x - BOX.w / 2}
          y={ROW_Y - BOX.h / 2}
          width={BOX.w}
          height={BOX.h}
          rx={28}
          fill="none"
          stroke={tone.ink}
          strokeWidth={2.5}
          strokeDasharray={`${perim * boxK} ${perim}`}
        />
      </svg>
      <div style={{ position: "absolute", left: BOX.x, top: ROW_Y, translate: "-50% -50%", textAlign: "center", opacity: enter(frame, c.box + 10, 18) }}>
        <div style={{ fontFamily: font.sans, fontWeight: 700, fontSize: 76, letterSpacing: "-0.03em", color: tone.ink }}>Intatto</div>
        <div style={{ fontFamily: font.mono, fontSize: 24, color: tone.muted, marginTop: 8 }}>lending market · X Layer</div>
      </div>
      <Coin x={interpolate(dock, [0, 1], [LEFT_X, DOCK_X])} label="NVDAx" sub="you put in" k={enter(frame, c.putIn - 14, 16)} />
      {/* Held collateral: a solid line into the market (the USDG side flows; this side stays put). */}
      <div
        style={{
          position: "absolute",
          left: DOCK_X + COIN / 2 + 12,
          top: ROW_Y - 1.5,
          height: 3,
          width: (BOX.x - BOX.w / 2 - 12 - (DOCK_X + COIN / 2 + 12)) * interpolate(frame, [c.putIn + 18, c.putIn + 40], [0, 1], { ...clamp, easing: ease.inOut }),
          background: tone.ink,
        }}
      />
      <Stream width={streamWidth} k={interpolate(frame, [c.usdg, c.usdg + 30], [0, 1], { ...clamp, easing: ease.out })} />
      <Coin x={interpolate(usdgK, [0, 1], [RIGHT_X - 120, RIGHT_X])} label="USDG" sub="you borrow" k={usdgK} />
      <div style={{ position: "absolute", left: BOX.x, top: ROW_Y + BOX.h / 2 + 44, translate: "-50% 0%", display: "flex", gap: 30, opacity: leave(frame, c.dayOut, 12) }}>
        {DAYS.map((d, i) => {
          const k = enter(frame, c.anyDay + i * 3, 12);
          return (
            <div key={d} style={{ textAlign: "center", opacity: 0.25 + 0.75 * k }}>
              <div style={{ width: 18, height: 18, margin: "0 auto", borderRadius: 9, border: `2px solid ${tone.ink}`, boxSizing: "border-box", background: k > 0.5 ? tone.ink : "transparent" }} />
              <div style={{ fontFamily: font.mono, fontSize: 22, color: tone.muted, marginTop: 10 }}>{d}</div>
            </div>
          );
        })}
      </div>
      <LoanGauge at={c.rules} />
    </>
  );
};

/** The open loan: its LTV and the liquidation threshold. The clock runs, the ground flips; the threshold never moves. */
const LoanGauge: FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const tone = useTone();
  const k = enter(frame, at, 20);
  const pulse = enter(frame, at + 30, 16);
  if (k <= 0) return null;
  const W = 380;
  return (
    <div style={{ position: "absolute", left: 190, top: ROW_Y + 230, width: W, opacity: k, translate: `0px ${(1 - k) * 16}px` }}>
      <div style={{ fontFamily: font.sans, fontWeight: 600, fontSize: 32, color: tone.ink }}>Your open loan</div>
      <div style={{ position: "relative", marginTop: 20, height: 16, borderRadius: 8, border: `1.5px solid ${tone.hairline}` }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "38%", background: tone.ink, borderRadius: 6 }} />
        <div style={{ position: "absolute", left: "72%", top: -10, width: 3, height: 32, background: RED, borderRadius: 2, scale: `1 ${1 + pulse * 0.25}` }} />
      </div>
      <div style={{ marginTop: 16, fontFamily: font.mono, fontSize: 24, color: RED, whiteSpace: "nowrap" }}>liquidation threshold · fixed</div>
    </div>
  );
};
