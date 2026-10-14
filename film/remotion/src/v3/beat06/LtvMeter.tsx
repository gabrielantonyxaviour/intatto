import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { enter, font, GREEN, RED } from "../theme";
import { useTone } from "../tone";
import { SourceLine } from "../ui/SourceLine";
import { LIQUIDATION, LIQUIDATIONS, OPEN_LTV } from "../datakit/replay";
import { meterLtv, T } from "./timeline";

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const W = 22;

/**
 * The loan's loan-to-value, in the LimitBar's form (vertical, 0–100%, the fixed red 65% line) so it reads as the
 * same instrument from beat 3, now measuring one loan. `x, y` is the track's top-left; the readout sits above it.
 */
export const LtvMeter: FC<{ x: number; y: number; height: number }> = ({ x, y, height }) => {
  const f = useCurrentFrame();
  const tone = useTone();
  const at = (pct: number) => height * (1 - pct / 100);
  const track = interpolate(f, [T.meter, T.meter + 22], [0, 1], { ...c, easing: (t) => 1 - Math.pow(1 - t, 4) });
  const line = enter(f, T.meter + 10, 20);
  const tick = enter(f, T.meterFill + 8, 18);
  const read = enter(f, T.meter + 4, 18);
  const ltv = meterLtv(f);
  const settled = enter(f, T.settle, 16);
  const liq = enter(f, T.liquidations, 18);
  const check = interpolate(f, [T.liquidations + 6, T.liquidations + 20], [0, 1], c);
  const glow = interpolate(f, [T.gapPulse[0], T.gapPulse[0] + 6, T.gapPulse[1] + 10], [0, 1, 0], c);
  return (
    <div style={{ position: "absolute", left: x, top: y }}>
      {/* readout */}
      <div style={{ position: "absolute", left: 0, top: -170, opacity: read, translate: `0px ${(1 - read) * 16}px`, whiteSpace: "nowrap" }}>
        <div style={{ fontFamily: font.sans, fontSize: 22, fontWeight: 500, color: tone.muted }}>LTV · this loan</div>
        <div style={{ fontFamily: font.mono, fontSize: 76, lineHeight: "92px", color: tone.ink, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
          {ltv.toFixed(2)}%
        </div>
        <SourceLine style={{ opacity: settled, marginTop: 2 }}>Sandbox run · 25 Sep 2026</SourceLine>
      </div>

      {/* track, drawn up from 0 */}
      <div style={{ position: "absolute", left: 0, top: height * (1 - track), width: W, height: height * track, boxSizing: "border-box", border: `1.5px solid ${tone.hairline}`, borderRadius: 3, opacity: track > 0.01 ? 1 : 0 }} />
      {[0, 50, 100].map((p) => (
        <div key={p} style={{ position: "absolute", right: 16, top: at(p) - 11, fontFamily: font.mono, fontSize: 18, lineHeight: "22px", color: tone.muted, opacity: track }}>
          {p}%
        </div>
      ))}
      {/* fill: the loan */}
      <div style={{ position: "absolute", left: 0, top: at(ltv), width: W, height: (height * ltv) / 100, background: tone.ink, borderRadius: 3 }} />
      <div style={{ position: "absolute", left: -6, top: at(ltv) - 6, width: W + 12, height: 12, borderRadius: 6, background: RED, opacity: glow * 0.5 }} />

      {/* opened at the weekday limit */}
      <div style={{ position: "absolute", left: -8, top: at(OPEN_LTV) - 1, width: (W + 16) * tick, height: 2, background: tone.muted }} />
      <div style={{ position: "absolute", left: W + 28, top: at(OPEN_LTV) - 13, opacity: tick, whiteSpace: "nowrap", fontFamily: font.mono, fontSize: 20, lineHeight: "26px", color: tone.muted }}>
        {OPEN_LTV}% · opened Fri
      </div>

      {/* the liquidation line: fixed */}
      <div style={{ position: "absolute", left: -10, top: at(LIQUIDATION) - 1.5, height: 3, width: (W + 20 + 250) * line, background: RED, borderRadius: 2 }} />
      <div style={{ position: "absolute", left: W + 28, top: at(LIQUIDATION) - 62, opacity: line, whiteSpace: "nowrap" }}>
        <div style={{ fontFamily: font.mono, fontSize: 22, lineHeight: "28px", color: RED }}>Liquidation {LIQUIDATION}%</div>
        <div style={{ fontFamily: font.sans, fontSize: 20, lineHeight: "24px", color: tone.muted }}>never moves</div>
      </div>

      {/* outcome */}
      <div style={{ position: "absolute", left: 0, top: height + 34, display: "flex", alignItems: "center", gap: 14, opacity: liq, translate: `0px ${(1 - liq) * 14}px`, whiteSpace: "nowrap" }}>
        <svg width={30} height={30} viewBox="0 0 30 30">
          <circle cx={15} cy={15} r={14} fill="none" stroke={GREEN} strokeWidth={2} />
          <path d="M8.5 15.5 L13 20 L21.5 10.5" fill="none" stroke={GREEN} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={20} strokeDashoffset={20 * (1 - check)} />
        </svg>
        <div style={{ fontFamily: font.sans, fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em", color: tone.ink }}>
          {LIQUIDATIONS} liquidations
        </div>
      </div>
    </div>
  );
};
