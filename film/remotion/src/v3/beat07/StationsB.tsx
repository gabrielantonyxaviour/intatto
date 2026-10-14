import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ease, enter, font, RED } from "../theme";
import { useTone } from "../tone";
import { SourceLine } from "../ui/SourceLine";
import { fmt, pct } from "../datakit/format";
import { SYN } from "../datakit/synthetic";
import { Eyebrow, Pill } from "./parts";
import { RAIL_Y, SX, T } from "./timeline";

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const TANK = { w: 260, h: 360, full: 0.78 } as const;

/** The liquid's surface: a gentle sine that stirs while it drains and goes still once empty. */
const surface = (w: number, y: number, amp: number, phase: number) => {
  const pts: string[] = [];
  for (let x = 0; x <= w; x += 10) pts.push(`${x},${(y + amp * Math.sin((x / w) * Math.PI * 2 + phase)).toFixed(2)}`);
  return `M0,${TANK.h} L${pts.join(" L")} L${w},${TANK.h} Z`;
};

/** 03 · The gap reserve pays first: the tank drains 149.10 → 0.00 in lock step with its number. */
export const Reserve: FC = () => {
  const f = useCurrentFrame();
  const tone = useTone();
  const cx = SX[2];
  const left = cx - TANK.w / 2;
  const top = RAIL_Y - TANK.h / 2;
  const tank = enter(f, T.reserve.in, 22);
  const drained = interpolate(f, T.reserve.drain, [0, 1], { ...c, easing: ease.inOut });
  const value = SYN.reserveBefore + (SYN.reserveAfter - SYN.reserveBefore) * drained;
  const level = TANK.h * TANK.full * (1 - drained) * enter(f, T.reserve.in + 6, 26);
  const stir = interpolate(f, [T.reserve.drain[0], T.reserve.drain[0] + 12, T.reserve.drain[1] - 8, T.reserve.drain[1] + 10], [2, 6, 6, 0], c);
  const flow = interpolate(f, [T.reserve.drain[0], T.reserve.drain[0] + 8, T.reserve.drain[1], T.reserve.drain[1] + 10], [0, 1, 1, 0], c);
  const num = enter(f, T.reserve.number, 18);
  const label = enter(f, T.reserve.number + 10, 18);
  return (
    <>
      <Eyebrow x={left - 60} k={enter(f, T.reserve.in + 2)}>03 · GAP RESERVE</Eyebrow>
      {/* what the reserve pays flows on toward the vault */}
      <svg width={900} height={8} style={{ position: "absolute", left: left + TANK.w, top: RAIL_Y - 4, opacity: flow }}>
        <line x1={0} x2={900} y1={4} y2={4} stroke={tone.ink} strokeWidth={3} strokeDasharray="14 12" strokeDashoffset={-f * 3} />
      </svg>
      <div style={{ position: "absolute", left, top, width: TANK.w, height: TANK.h, borderRadius: 18, overflow: "hidden", background: tone.bg,
        boxSizing: "border-box", border: `2px solid ${tone.ink}`, opacity: tank, scale: String(0.94 + 0.06 * tank) }}>
        <svg width={TANK.w} height={TANK.h} style={{ position: "absolute", left: 0, top: 0 }}>
          {level > 0.5 ? <path d={surface(TANK.w, TANK.h - level, stir * Math.min(1, level / 24), f * 0.18)} fill={tone.ink} /> : null}
          {[0.25, 0.5, 0.75].map((k) => (
            <line key={k} x1={TANK.w - 26} x2={TANK.w} y1={TANK.h * k} y2={TANK.h * k} stroke={tone.muted} strokeWidth={1.5} opacity={0.6} />
          ))}
        </svg>
      </div>
      <div style={{ position: "absolute", left: cx + 200, top: RAIL_Y - 164, fontFamily: font.mono, fontSize: 104, lineHeight: "116px", letterSpacing: "-0.03em",
        color: tone.ink, fontVariantNumeric: "tabular-nums", opacity: num, translate: `0px ${(1 - num) * 18}px` }}>
        {fmt(value, 2)}
      </div>
      <div style={{ position: "absolute", left: cx + 204, top: RAIL_Y + 58, opacity: label, translate: `0px ${(1 - label) * 12}px`, whiteSpace: "nowrap" }}>
        <div style={{ fontFamily: font.sans, fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em", color: tone.ink }}>USDG in the gap reserve</div>
        <SourceLine style={{ marginTop: 8 }}>Sandbox synthetic run · 25 Sep 2026</SourceLine>
      </div>
    </>
  );
};

/** What the reserve couldn't cover travels on to the lenders. */
export const Shortfall: FC = () => {
  const f = useCurrentFrame();
  const [a, b] = T.reserve.token;
  const x = interpolate(f, [a, b - 10], [SX[2] + 290, SX[3] - 650], { ...c, easing: ease.inOut });
  // At the lenders' node the token folds into it, as the slice folded into the pool.
  const fold = interpolate(f, [b - 10, b], [0, 1], { ...c, easing: ease.inOut });
  const k = enter(f, a - 6, 12) * (1 - fold * 0.6);
  return (
    <Pill x={x + fold * 170} y={RAIL_Y} color={RED} textOpacity={1 - Math.min(1, fold * 3)} style={{ opacity: f > b ? 0 : k, scale: `${1 - fold * 0.9} 1` }}>
      {fmt(SYN.lenderLoss, 2)} USDG bad debt
    </Pill>
  );
};

/** 04 · Lenders take the rest: the loss lands, and every share loses the same fraction. */
export const Lenders: FC = () => {
  const f = useCurrentFrame();
  const tone = useTone();
  const x = SX[3] - 420;
  const loss = enter(f, T.lenders.loss, 18);
  const lossN = interpolate(f, [T.lenders.loss, T.lenders.loss + 24], [0, SYN.lenderLoss], { ...c, easing: ease.out });
  const shareK = enter(f, T.lenders.share[0] - 6, 18);
  const share = interpolate(f, T.lenders.share, [SYN.shareBefore, SYN.shareAfter], { ...c, easing: ease.out });
  const change = enter(f, T.lenders.share[1] - 6, 16);
  return (
    <>
      <Eyebrow x={x} k={enter(f, T.lenders.in)}>04 · LENDERS</Eyebrow>
      <div style={{ position: "absolute", left: x, top: RAIL_Y - 196, opacity: loss, translate: `0px ${(1 - loss) * 18}px`, whiteSpace: "nowrap" }}>
        <div style={{ fontFamily: font.sans, fontSize: 26, fontWeight: 500, color: tone.muted }}>Socialized to lenders</div>
        <div style={{ fontFamily: font.mono, fontSize: 104, lineHeight: "118px", letterSpacing: "-0.03em", color: RED, fontVariantNumeric: "tabular-nums" }}>
          {fmt(lossN, 2)} <span style={{ fontSize: 44, letterSpacing: 0 }}>USDG</span>
        </div>
      </div>
      <div style={{ position: "absolute", left: x, top: RAIL_Y + 34, opacity: shareK, translate: `0px ${(1 - shareK) * 14}px`, whiteSpace: "nowrap" }}>
        <div style={{ fontFamily: font.sans, fontSize: 26, fontWeight: 500, color: tone.muted }}>Share value</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 4, fontFamily: font.mono, fontVariantNumeric: "tabular-nums" }}>
          <span style={{ fontSize: 40, color: tone.muted }}>{SYN.shareBefore.toFixed(6)} →</span>
          <span style={{ fontSize: 64, color: tone.ink, letterSpacing: "-0.02em" }}>{share.toFixed(6)}</span>
          <span style={{ fontSize: 30, color: RED, opacity: change }}>{pct(SYN.shareChangePercent, 4)}</span>
        </div>
        <SourceLine style={{ marginTop: 10, opacity: change }}>Sandbox synthetic run · 25 Sep 2026</SourceLine>
      </div>
    </>
  );
};
