import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ease, enter, font } from "../theme";
import { useTone } from "../tone";
import { SourceLine } from "../ui/SourceLine";
import { RESERVE_FACTOR_BPS } from "../datakit/hood";
import { G, T } from "./timeline";

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
type Pt = { x: number; y: number };

/** CollateralMarketBase: PENALTY_BPS = 500; CollateralMarket pays penalty / 2 to the keeper, the rest to the reserve. */
const PENALTY_PCT = 5;

const bez = (end: Pt, k: number): Pt => {
  const a = G.node;
  const mx = (a.x + end.x) / 2;
  const u = 1 - k;
  return {
    x: u * u * u * a.x + 3 * u * u * k * mx + 3 * u * k * k * mx + k * k * k * end.x,
    y: u * u * u * a.y + 3 * u * u * k * a.y + 3 * u * k * k * end.y + k * k * k * end.y,
  };
};
const branchD = (end: Pt) => `M${G.node.x},${G.node.y} C${(G.node.x + end.x) / 2},${G.node.y} ${(G.node.x + end.x) / 2},${end.y} ${end.x},${end.y}`;

/** Tokens travelling source → node → a branch; every `every`-th one takes the lower branch. */
const Flow: FC<{ span: readonly [number, number]; n: number; every: number; travel: number }> = ({ span, n, every, travel }) => {
  const f = useCurrentFrame();
  const tone = useTone();
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const start = span[0] + (i * (span[1] - span[0] - travel)) / n;
        const k = interpolate(f, [start, start + travel], [0, 1], c);
        if (k <= 0 || k >= 1) return null;
        const lower = i % every === every - 1;
        const trunk = 0.42;
        const p = k < trunk ? { x: G.source.x + ((G.node.x - G.source.x) * k) / trunk, y: G.source.y } : bez(lower ? G.lower : G.upper, (k - trunk) / (1 - trunk));
        return <circle key={i} cx={p.x} cy={p.y} r={7} fill={tone.ink} opacity={Math.min(1, k * 8, (1 - k) * 8)} />;
      })}
    </>
  );
};

/** Two states of one label: the old one rises out in the first half of `k`, the new one rises in during the second. */
const Swap: FC<{ k: number; x: number; y: number; a: [string, string]; b: [string, string]; inK: number }> = ({ k, x, y, a, b, inK }) => {
  const tone = useTone();
  const one = (t: [string, string], o: number, dy: number) => (
    <div style={{ position: "absolute", left: 0, top: dy, opacity: o, whiteSpace: "nowrap" }}>
      <div style={{ fontFamily: font.mono, fontSize: 96, lineHeight: "100px", color: tone.ink, letterSpacing: "-0.03em" }}>{t[0]}</div>
      <div style={{ fontFamily: font.sans, fontSize: 28, fontWeight: 600, color: tone.ink }}>{t[1]}</div>
    </div>
  );
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: inK, translate: `0px ${(1 - inK) * 14}px` }}>
      {one(a, 1 - Math.min(1, k * 2), -18 * Math.min(1, k * 2))}
      {one(b, Math.max(0, k * 2 - 1), 18 * (1 - Math.max(0, k * 2 - 1)))}
    </div>
  );
};

/**
 * The money flows through one split: first interest (80% lenders, 20% gap reserve, RESERVE_FACTOR_BPS = 2000),
 * then the same split re-weighted for the 5% liquidation penalty (half to the keeper we run, half to the reserve).
 */
export const Split: FC = () => {
  const f = useCurrentFrame();
  const tone = useTone();
  const draw = interpolate(f, T.draw, [0, 1], { ...c, easing: ease.inOut });
  const pm = interpolate(f, T.penalty, [0, 1], { ...c, easing: ease.inOut });
  const lowerShare = RESERVE_FACTOR_BPS / 10_000 + (0.5 - RESERVE_FACTOR_BPS / 10_000) * pm;
  // The split clears before the request line starts, so no label ever sits on another.
  const out = interpolate(f, [T.request[0] - 24, T.request[0] - 4], [1, 0], { ...c, easing: ease.inOut });
  const reserveFill = 0.3 + 0.2 * interpolate(f, T.flow, [0, 1], c) + 0.15 * interpolate(f, T.penaltyFlow, [0, 1], c);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: out }}>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <line x1={G.source.x} y1={G.source.y} x2={G.source.x + (G.node.x - G.source.x) * draw} y2={G.node.y} stroke={tone.hairline} strokeWidth={40} strokeLinecap="round" />
        <path d={branchD(G.upper)} fill="none" stroke={tone.hairline} strokeWidth={40 * (1 - lowerShare)} strokeLinecap="round" pathLength={1} strokeDasharray={`${draw} 1`} />
        <path d={branchD(G.lower)} fill="none" stroke={tone.hairline} strokeWidth={40 * lowerShare} strokeLinecap="round" pathLength={1} strokeDasharray={`${draw} 1`} />
        <Flow span={T.flow} n={30} every={Math.round(10_000 / RESERVE_FACTOR_BPS)} travel={44} />
        <Flow span={T.penaltyFlow} n={14} every={2} travel={44} />
      </svg>
      <div style={{ position: "absolute", left: G.source.x - 40, top: G.source.y - 96, width: 520, height: 40, opacity: enter(f, T.source),
        fontFamily: font.sans, fontSize: 30, fontWeight: 600, color: tone.ink, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 1 - Math.min(1, pm * 2) }}>Interest from borrowers</div>
        <div style={{ position: "absolute", inset: 0, opacity: Math.max(0, pm * 2 - 1) }}>{PENALTY_PCT}% liquidation penalty</div>
      </div>
      <Swap k={pm} x={G.upper.x + 40} y={G.upper.y - 62} inK={enter(f, T.lenders, 20)}
        a={[`${100 - RESERVE_FACTOR_BPS / 100}%`, "to lenders"]} b={["50%", "to the keeper, which we run"]} />
      <div style={{ position: "absolute", left: G.lower.x + 40, top: G.lower.y - 58, width: 84, height: 116, borderRadius: 12, overflow: "hidden", boxSizing: "border-box",
        border: `2px solid ${tone.ink}`, opacity: enter(f, T.reserve, 20) }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${reserveFill * 100}%`, background: tone.ink }} />
      </div>
      <Swap k={pm} x={G.lower.x + 150} y={G.lower.y - 62} inK={enter(f, T.reserve, 20)}
        a={[`${RESERVE_FACTOR_BPS / 100}%`, "to the gap reserve"]} b={["50%", "to the gap reserve"]} />
      <SourceLine style={{ position: "absolute", left: G.source.x - 40, top: 900, opacity: enter(f, T.reserve + 12) * (1 - pm) }}>
        RESERVE_FACTOR_BPS = {RESERVE_FACTOR_BPS} · CollateralMarket on X Layer mainnet
      </SourceLine>
      <SourceLine style={{ position: "absolute", left: G.source.x - 40, top: 900, opacity: enter(f, T.half + 10) }}>
        PENALTY_BPS = 500 · penalty / 2 to the keeper, the rest to the gap reserve · CollateralMarket
      </SourceLine>
    </div>
  );
};
