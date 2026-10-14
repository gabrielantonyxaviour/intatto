import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { WEEKEND_START } from "../dial/session";
import { ease, enter, font, RED } from "../theme";
import { useTone } from "../tone";
import { SourceLine } from "../ui/SourceLine";
import { Wordmark } from "../ui/Wordmark";
import type { WeekCamera } from "../week/camera";
import { xOf } from "../week/camera";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const STRIP_Y = 520;

/** Three exchanges in plain type (no logos). On "Onchain it's harder" the row squashes flat into the week's line. */
export const Exchanges: FC<{ start: number; squash: number }> = ({ start, squash }) => {
  const frame = useCurrentFrame();
  const tone = useTone();
  const flat = interpolate(frame, [squash, squash + 16], [1, 0.02], { ...clamp, easing: ease.inOut });
  const gone = interpolate(frame, [squash + 14, squash + 20], [1, 0], clamp);
  const sub = enter(frame, start + 34, 18) * interpolate(frame, [squash - 6, squash + 4], [1, 0], clamp);
  if (gone <= 0) return null;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: STRIP_Y,
          display: "flex",
          justifyContent: "center",
          gap: 64,
          translate: "0px -50%",
          scale: `1 ${flat}`,
          opacity: gone,
        }}
      >
        {["Bybit", "Kraken", "Bitget"].map((name, i) => (
          <Wordmark key={name} text={name} fontSize={112} weight={600} start={start + i * 9} />
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: STRIP_Y + 100, textAlign: "center", opacity: sub }}>
        <div style={{ fontFamily: font.mono, fontSize: 22, letterSpacing: "0.08em", color: tone.muted }}>
          ACCEPT XSTOCKS AS LOAN COLLATERAL
        </div>
        <SourceLine style={{ marginTop: 14 }}>spotedcrypto.com · Bitget Jun 2026 · Kraken Jul 2026 · Bybit 31 Jul 2026</SourceLine>
      </div>
    </>
  );
};

/** Deterministic, irregular gaps between onchain prints (no prices are drawn, only that trades happen, sparsely). */
function prints(from: number, to: number): { t: number; h: number }[] {
  const out: { t: number; h: number }[] = [];
  let t = from + 40;
  let i = 1;
  while (t < to) {
    const r = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    out.push({ t, h: 18 + r * 52 });
    t += 50 + r * 190;
    i += 1;
  }
  return out;
}

/** The token keeps trading through the weekend on thin liquidity: sparse prints above the empty weekend. */
export const TokenPrints: FC<{ camera: WeekCamera; until: number; k: number }> = ({ camera, until, k }) => {
  const tone = useTone();
  if (k <= 0) return null;
  const y = STRIP_Y - 120;
  const all = prints(WEEKEND_START, until);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: k }}>
      <div style={{ position: "absolute", left: xOf(WEEKEND_START, camera), top: y - 104, fontFamily: font.mono, fontSize: 22, color: tone.muted, whiteSpace: "nowrap" }}>
        NVDAx onchain · thin liquidity
      </div>
      {all.map((p) => (
        <div key={p.t} style={{ position: "absolute", left: xOf(p.t, camera) - 1.5, top: y - p.h, width: 3, height: p.h, background: tone.ink, borderRadius: 1 }}>
          <div style={{ position: "absolute", left: -3.5, top: -5, width: 10, height: 10, borderRadius: 5, background: tone.ink }} />
        </div>
      ))}
      <div style={{ position: "absolute", left: xOf(WEEKEND_START, camera), width: Math.max(0, xOf(until, camera) - xOf(WEEKEND_START, camera)), top: y, height: 1.5, background: tone.hairline }} />
    </div>
  );
};

/** The issuer's own readout while closed: max order $0. */
export const IssuerReadout: FC<{ at: number; out: number }> = ({ at, out }) => {
  const frame = useCurrentFrame();
  const tone = useTone();
  const k = enter(frame, at, 20) * (1 - enter(frame, out, 14));
  if (k <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 730, textAlign: "center", opacity: k, translate: `0px ${(1 - k) * 18}px` }}>
      <div style={{ fontFamily: font.mono, fontSize: 24, letterSpacing: "0.06em", color: tone.muted }}>XSTOCKS ISSUER · MAX ORDER</div>
      <div style={{ fontFamily: font.mono, fontWeight: 500, fontSize: 104, lineHeight: 1.1, color: tone.ink }}>$0</div>
      <SourceLine>xStocks public asset API · maxOrderFiatValue = 0 while closed · read 25 Sep 2026</SourceLine>
    </div>
  );
};

/** Gap risk: a red bracket over the dark hours, from Friday's 20:00 close to Monday's 09:30 open. */
export const GapBracket: FC<{ camera: WeekCamera; from: number; to: number; at: number }> = ({ camera, from, to, at }) => {
  const frame = useCurrentFrame();
  const tone = useTone();
  const draw = interpolate(frame, [at, at + 24], [0, 1], { ...clamp, easing: ease.inOut });
  const text = enter(frame, at + 12, 20);
  const sub = enter(frame, at + 40, 18);
  if (draw <= 0) return null;
  const a = xOf(from, camera);
  const b = xOf(to, camera);
  const y = STRIP_Y + 200;
  return (
    <>
      <div style={{ position: "absolute", left: a, top: y, width: (b - a) * draw, height: 3, background: RED }} />
      <div style={{ position: "absolute", left: a, top: y - 18, width: 3, height: 21, background: RED }} />
      <div style={{ position: "absolute", left: b - 3, top: y - 18, width: 3, height: 21, background: RED, opacity: draw >= 1 ? 1 : 0 }} />
      <div style={{ position: "absolute", left: b, top: y + 18, translate: "-100% 0%", fontFamily: font.mono, fontSize: 20, color: tone.muted, opacity: sub, whiteSpace: "nowrap" }}>
        MON 09:30 ET · OPEN
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: y + 70, textAlign: "center", opacity: text, translate: `0px ${(1 - text) * 20}px` }}>
        <div style={{ fontFamily: font.sans, fontWeight: 700, fontSize: 96, letterSpacing: "-0.035em", color: tone.ink, lineHeight: 1 }}>Gap risk</div>
        <div style={{ marginTop: 18, fontFamily: font.mono, fontSize: 24, color: tone.muted, opacity: sub }}>no reference price until Monday&apos;s open</div>
      </div>
    </>
  );
};
