import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ease, enter, font, RED } from "../theme";
import { useTone } from "../tone";
import { SourceLine } from "../ui/SourceLine";
import { fmt } from "../datakit/format";
import { SYN } from "../datakit/synthetic";
import { Eyebrow, Pill, Tick } from "./parts";
import { RAIL_Y, SX, T } from "./timeline";

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 01 · The crash: a price column loses 45%; the missing part stays as a red outlined void. */
export const Crash: FC = () => {
  const f = useCurrentFrame();
  const tone = useTone();
  const cx = SX[0];
  const col = { x: cx - 420, top: 340, w: 200, h: 440 };
  const draw = enter(f, T.crash.column, 22);
  const kept = interpolate(f, T.crash.drop, [1, 1 - SYN.crashPercent / 100], { ...c, easing: ease.out });
  const lost = interpolate(f, [T.crash.drop[0], T.crash.drop[0] + 10], [0, 1], c);
  const n = interpolate(f, [T.crash.drop[0], T.crash.drop[1] + 6], [0, -SYN.crashPercent], { ...c, easing: ease.out });
  const num = enter(f, T.crash.drop[0], 16);
  const label = enter(f, T.crash.label, 18);
  const fillTop = col.top + col.h * (1 - kept);
  return (
    <>
      <Eyebrow x={col.x} k={enter(f, 4)}>01 · CRASH</Eyebrow>
      {/* the void the crash leaves */}
      <div style={{ position: "absolute", left: col.x, top: col.top, width: col.w, height: fillTop - col.top, boxSizing: "border-box",
        border: `2px dashed ${RED}`, borderBottom: "none", borderRadius: "10px 10px 0 0", opacity: lost }} />
      {/* the price column, drawn up from its base */}
      <div style={{ position: "absolute", left: col.x, top: fillTop + (col.top + col.h - fillTop) * (1 - draw), width: col.w,
        height: (col.top + col.h - fillTop) * draw, background: tone.ink, borderRadius: kept > 0.999 ? 10 : "0 0 10px 10px" }} />
      <div style={{ position: "absolute", left: col.x - 88, top: col.top - 12, width: 72, textAlign: "right", fontFamily: font.mono, fontSize: 20, color: tone.muted, opacity: draw }}>100%</div>
      <div style={{ position: "absolute", left: col.x - 88, top: fillTop - 12, width: 72, textAlign: "right", fontFamily: font.mono, fontSize: 20, color: tone.ink, opacity: lost }}>55%</div>

      <div style={{ position: "absolute", left: cx - 120, top: RAIL_Y - 190, fontFamily: font.mono, fontSize: 160, lineHeight: "170px", letterSpacing: "-0.04em",
        color: RED, fontVariantNumeric: "tabular-nums", opacity: num, translate: `0px ${(1 - num) * 20}px` }}>
        {fmt(n, 0)}%
      </div>
      <div style={{ position: "absolute", left: cx - 110, top: RAIL_Y + 36, opacity: label, translate: `0px ${(1 - label) * 12}px`, whiteSpace: "nowrap" }}>
        <div style={{ fontFamily: font.sans, fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em", color: tone.ink }}>A synthetic gap in NVDAx</div>
        <SourceLine style={{ marginTop: 8 }}>Sandbox synthetic scenario · not market data</SourceLine>
      </div>
    </>
  );
};

/** 02 · The sale: one slice of collateral goes into the pool, USDG comes out, above the floor price. */
export const Sale: FC = () => {
  const f = useCurrentFrame();
  const tone = useTone();
  const cx = SX[1];
  const R = 112;
  const pool = enter(f, T.sale.in, 22);
  const inX = interpolate(f, T.sale.slice, [cx - 470, cx - R - 150], { ...c, easing: ease.inOut });
  const inK = enter(f, T.sale.slice[0] - 14, 16) * interpolate(f, [T.sale.slice[1] - 10, T.sale.slice[1]], [1, 0], c);
  // At the pool's edge the slice folds into it (no glyph is ever cut by the circle).
  const inScale = interpolate(f, [T.sale.slice[1] - 10, T.sale.slice[1]], [1, 0.2], { ...c, easing: ease.inOut });
  const inShift = interpolate(f, [T.sale.slice[1] - 10, T.sale.slice[1]], [0, 120], { ...c, easing: ease.inOut });
  const outX = interpolate(f, T.sale.usdg, [cx + 40, cx + 440], { ...c, easing: ease.out });
  const outK = interpolate(f, [T.sale.usdg[0], T.sale.usdg[0] + 8, ...T.sale.usdgOut], [0, 1, 1, 0], c);
  const outScale = interpolate(f, [T.sale.usdg[0], T.sale.usdg[0] + 14], [0.7, 1], { ...c, easing: ease.out });
  const swallow = interpolate(f, [T.sale.slice[1] - 6, T.sale.slice[1] + 4, T.sale.usdg[0] + 16], [0, 1, 0], c);
  const floor = enter(f, T.sale.floor, 18);
  const check = interpolate(f, [T.sale.floor + 6, T.sale.floor + 22], [0, 1], c);
  return (
    <>
      <Eyebrow x={cx - 470 - 150} k={enter(f, T.sale.in + 6)}>02 · SALE</Eyebrow>
      <div style={{ position: "absolute", left: cx - 470 - 150, top: RAIL_Y - 110, fontFamily: font.mono, fontSize: 20, color: tone.muted,
        opacity: enter(f, T.sale.slice[0] - 10), whiteSpace: "nowrap" }}>
        slice {SYN.slices} of {SYN.slices}
      </div>
      <Pill x={inX + inShift} y={RAIL_Y} textOpacity={interpolate(f, [T.sale.slice[1] - 12, T.sale.slice[1] - 8], [1, 0], c)} style={{ opacity: inK, scale: `${inScale} 1` }}>{fmt(SYN.soldWnvdax, 3)} wNVDAx</Pill>
      {/* the pool sits over the rail and swallows the slice */}
      <div style={{ position: "absolute", left: cx - R, top: RAIL_Y - R, width: 2 * R, height: 2 * R, borderRadius: R, boxSizing: "border-box",
        border: `2px solid ${tone.ink}`, background: tone.bg, opacity: pool, scale: String(0.9 + 0.1 * pool + 0.04 * swallow),
        display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font.sans, fontSize: 32, fontWeight: 600, color: tone.ink }}>
        Pool
      </div>
      <div style={{ position: "absolute", left: cx - R - 18, top: RAIL_Y - R - 18, width: 2 * R + 36, height: 2 * R + 36, borderRadius: R + 18,
        border: `2px solid ${tone.ink}`, opacity: swallow * 0.35, boxSizing: "border-box" }} />
      <Pill x={outX} y={RAIL_Y} solid style={{ opacity: outK, scale: String(outScale) }}>{fmt(SYN.receivedUsdg, 2)} USDG</Pill>
      <div style={{ position: "absolute", left: cx - 190, top: RAIL_Y + R + 44, opacity: floor, translate: `0px ${(1 - floor) * 12}px`, whiteSpace: "nowrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Tick k={check} />
          <div style={{ fontFamily: font.sans, fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em", color: tone.ink }}>Floor price held</div>
        </div>
        <SourceLine style={{ marginTop: 10, marginLeft: 46 }}>Sandbox synthetic run · 25 Sep 2026</SourceLine>
      </div>
    </>
  );
};
