import type { CSSProperties, FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ease, enter, font, GREEN, RED } from "../theme";
import { useTone } from "../tone";
import { fmt } from "../datakit/format";
import { FRIDAY_CLOSE, GAP_PERCENT, LIQUIDATION, OPEN_LTV, TERMINAL_LTV } from "../datakit/replay";
import { closeY, ltvY, openY, TIMES } from "./axis";
import { morphAt, PLOT, T } from "./timeline";
import { sx, sy } from "./Chart";

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const mono = (px: number, color: string): CSSProperties => ({ fontFamily: font.mono, fontSize: px, color, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" });

/** Few words, each only while it matters: the close, the gap, then the loan against its threshold. */
export const Labels: FC = () => {
  const f = useCurrentFrame();
  const tone = useTone();
  const morph = morphAt(f);
  const x0 = sx(TIMES.FRI_LAST, f);
  const x1 = sx(TIMES.MON_FIRST, f);
  const xEnd = sx(TIMES.MON_LAST, f);
  const close = enter(f, T.friday[1] - 2, 16) * (1 - morph);
  const gapK = enter(f, T.gap[0], 18) * interpolate(f, [T.morph[0] - 6, T.morph[0] + 10], [1, 0], c);
  const gapN = interpolate(f, T.gap, [0, GAP_PERCENT], { ...c, easing: ease.out });
  const line = interpolate(f, T.threshold, [0, 1], { ...c, easing: ease.inOut });
  const opened = enter(f, T.morph[1] - 8, 16);
  const end = enter(f, T.settle, 18);
  const none = enter(f, T.none, 18);
  const tick = interpolate(f, [T.none + 6, T.none + 20], [0, 1], c);
  const yLine = sy(ltvY(LIQUIDATION));
  const yEnd = sy(ltvY(TERMINAL_LTV));
  return (
    <>
      <div style={{ position: "absolute", left: x0 - 100, top: sy(closeY(0)) - 58, width: 200, textAlign: "center", opacity: close, ...mono(26, tone.ink) }}>
        {FRIDAY_CLOSE.toFixed(2)}
      </div>

      <div style={{ position: "absolute", left: x1 + 40, top: (sy(closeY(0)) + sy(openY(0))) / 2 - 116, opacity: gapK, translate: `0px ${(1 - gapK) * 16}px` }}>
        <div style={{ ...mono(104, RED), lineHeight: "112px", letterSpacing: "-0.035em" }}>{fmt(gapN, 2)}%</div>
        <div style={{ fontFamily: font.sans, fontSize: 26, fontWeight: 500, color: tone.muted, marginTop: 4 }}>at Monday's open</div>
      </div>

      {/* while the playhead crosses 65 empty hours: say why they're empty */}
      <div style={{ position: "absolute", left: (x0 + x1) / 2, top: PLOT.y + PLOT.h * 0.5, translate: "-50% 0px",
        opacity: enter(f, T.weekend[0] + 6, 18) * interpolate(f, [T.open - 10, T.open + 2], [1, 0], c), ...mono(24, tone.muted) }}>
        Weekend: no NVDA trades
      </div>

      {/* the liquidation threshold: fixed, drawn across once price has become LTV */}
      <div style={{ position: "absolute", left: x0, top: yLine - 1.5, width: (xEnd - x0 + 40) * line, height: 3, background: RED, borderRadius: 2 }} />
      <div style={{ position: "absolute", left: xEnd, top: yLine - 40, translate: "-100% 0px", opacity: enter(f, T.threshold[0] + 10, 16), ...mono(24, RED) }}>
        {LIQUIDATION}% liquidation threshold
      </div>

      <div style={{ position: "absolute", left: x0 - 132, top: sy(closeY(1)) - 16, width: 116, textAlign: "right", opacity: opened, ...mono(24, tone.muted) }}>
        {OPEN_LTV}%
      </div>

      <div style={{ position: "absolute", left: xEnd - 420, top: yEnd + 26, width: 420, textAlign: "right", opacity: end, translate: `0px ${(1 - end) * 14}px` }}>
        <div style={{ ...mono(76, tone.ink), lineHeight: "84px", letterSpacing: "-0.03em" }}>{TERMINAL_LTV.toFixed(2)}%</div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 6, opacity: none }}>
          <svg width={26} height={26} viewBox="0 0 30 30">
            <circle cx={15} cy={15} r={14} fill="none" stroke={GREEN} strokeWidth={2} />
            <path d="M8.5 15.5 L13 20 L21.5 10.5" fill="none" stroke={GREEN} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={20} strokeDashoffset={20 * (1 - tick)} />
          </svg>
          <span style={{ fontFamily: font.sans, fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", color: tone.ink }}>No liquidations</span>
        </div>
      </div>
    </>
  );
};
