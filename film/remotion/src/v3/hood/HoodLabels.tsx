import type { CSSProperties, FC, ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ease, enter, font, GREEN } from "../theme";
import { useTone } from "../tone";
import { fmt } from "../datakit/format";
import { BAND_OPEN_BPS, CAP_POST, CAP_SIZE, CAP_USDG, etClock, POSTS, WIDEST } from "../datakit/hood";
import { BUDGET_PRICE, depthXY, PLOT, uOfTime, xOfU, yOf } from "./geometry";
import { T } from "./timeline";

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const mono = (px: number, color: string): CSSProperties => ({ fontFamily: font.mono, fontSize: px, color, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" });
const sans = (px: number, color: string, weight = 500): CSSProperties => ({ fontFamily: font.sans, fontSize: px, fontWeight: weight, color, whiteSpace: "nowrap", letterSpacing: "-0.01em" });

const Rise: FC<{ k: number; style: CSSProperties; children: ReactNode }> = ({ k, style, children }) => (
  <div style={{ position: "absolute", opacity: k, translate: `0px ${(1 - k) * 14}px`, ...style }}>{children}</div>
);

/** A handful of words for ideas 1 and 2, each leaving before the next arrives. */
export const HoodLabels: FC = () => {
  const f = useCurrentFrame();
  const tone = useTone();
  const out1 = interpolate(f, [T.morph[0] - 12, T.morph[0] + 6], [1, 0], c);
  // While the widest post is measured, the other labels step aside.
  const aside = interpolate(f, [T.widest[0], T.widest[0] + 12, T.irisIn[1], T.irisIn[1] + 12], [1, 0, 0, 1], c);
  const lastPost = POSTS[POSTS.length - 1];
  const endX = xOfU(uOfTime(lastPost.t));
  const widest = enter(f, T.widest[0] + 10, 18) * interpolate(f, [T.irisIn[1] - 2, T.irisIn[1]], [1, 0], c);
  const pct = interpolate(f, [T.widest[0] + 10, T.widest[1] + 6], [0, WIDEST.deviationBps / 100], { ...c, easing: ease.out });
  const cap = depthXY(CAP_SIZE.shares, CAP_SIZE.price);
  const capN = interpolate(f, [T.cap, T.cap + 26], [0, CAP_USDG], { ...c, easing: ease.out });
  return (
    <>
      <Rise k={enter(f, T.line[1] - 10) * out1 * aside} style={{ left: endX, top: yOf(lastPost.twap * (1 - BAND_OPEN_BPS / 1e4)) + 16, translate: "-100% 0px", ...sans(24, tone.ink, 600) }}>
        Pool, 30-min average
      </Rise>
      <Rise k={enter(f, T.band[1] - 6) * out1 * aside} style={{ left: endX, top: yOf(lastPost.twap * (1 + BAND_OPEN_BPS / 1e4)) - 38, translate: "-100% 0px", ...mono(20, tone.muted) }}>
        ±{BAND_OPEN_BPS / 100}% band
      </Rise>
      <Rise k={enter(f, T.posts[0] + 20) * out1 * aside} style={{ left: PLOT.x, top: PLOT.y - 64, display: "flex", alignItems: "center", gap: 12, ...sans(24, tone.ink, 600) }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: tone.ink }} />
        Keeper price posts
        <span style={mono(20, tone.muted)}>{etClock(POSTS[0].t)} → {etClock(lastPost.t)}</span>
      </Rise>
      <Rise k={widest} style={{ left: xOfU(uOfTime(WIDEST.t)) - 10, top: yOf(WIDEST.twap * (1 + BAND_OPEN_BPS / 1e4)) - 92, display: "flex", alignItems: "baseline", gap: 18 }}>
        <div style={{ ...mono(64, GREEN), lineHeight: "70px", letterSpacing: "-0.03em" }}>{pct.toFixed(2)}%</div>
        <div style={sans(24, tone.muted)}>widest gap to the pool · limit {BAND_OPEN_BPS / 100}%</div>
      </Rise>

      <Rise k={enter(f, T.budget[1] - 6)} style={{ left: PLOT.x, top: yOf(BUDGET_PRICE) + 12, ...mono(20, tone.muted) }}>
        2% slippage budget
      </Rise>
      <Rise k={enter(f, T.pick + 6)} style={{ left: cap.x - 24, top: cap.y - 118, translate: "-100% 0px", textAlign: "right" }}>
        <div style={mono(28, tone.ink)}>{CAP_SIZE.shares} wNVDAx → {fmt(CAP_SIZE.out, 2)} USDG</div>
        <div style={{ ...sans(22, tone.muted), marginTop: 6 }}>{(CAP_SIZE.slipBps / 100).toFixed(2)}% under the smallest sale</div>
      </Rise>
      <Rise k={enter(f, T.cap)} style={{ left: PLOT.x + PLOT.w, top: PLOT.y - 40, translate: "-100% 0px", textAlign: "right" }}>
        <div style={sans(24, tone.muted)}>Credit cap, half of that sale, posted onchain</div>
        <div style={{ ...mono(72, tone.ink), lineHeight: "84px", letterSpacing: "-0.03em" }}>{fmt(capN, 2)} <span style={{ fontSize: 32 }}>USDG</span></div>
        <div style={{ ...mono(20, tone.muted), marginTop: 6 }}>keeper post {CAP_POST.at.slice(11, 16)} UTC, 25 Sep 2026 · tx {CAP_POST.tx.slice(0, 6)}…{CAP_POST.tx.slice(-4)}</div>
      </Rise>
    </>
  );
};
