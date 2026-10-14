import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ease, enter, font, GREEN } from "../theme";
import { useTone } from "../tone";
import { midTrim } from "../datakit/format";
import type { ProofRow } from "../datakit/proof";
import { COL, ROW, T, valueY } from "./timeline";

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const shown = (v: string) => (v.startsWith("0x") ? midTrim(v, 14, 12) : v);

/**
 * One compared value, mirrored about the gutter: mainnet right-aligned on the left, the fork left-aligned on the
 * right, so the two values meet at the tick. They read in with a wipe, a green sweep converges on lock, and each
 * side settles a few px inward.
 */
const Cell: FC<{ row: ProofRow; i: number; side: "left" | "right" }> = ({ row, i, side }) => {
  const f = useCurrentFrame();
  const tone = useTone();
  const left = side === "left";
  const read = interpolate(f, [T.read + i * 8, T.read + i * 8 + 22], [0, 1], { ...c, easing: ease.out });
  const lock = T.locks[i];
  const sweep = interpolate(f, [lock - 12, lock], [0, 1], { ...c, easing: ease.inOut });
  const sweepK = interpolate(f, [lock - 12, lock - 8, lock + 2, lock + 12], [0, 1, 1, 0], c);
  const settle = interpolate(f, [lock - 2, lock + 16], [0, 1], { ...c, easing: ease.settle });
  const x = left ? COL.gutter - COL.half - COL.width : COL.gutter + COL.half;
  const y = ROW.top + i * ROW.pitch;
  const wipe = left ? `inset(0 ${(1 - read) * 100}% 0 0)` : `inset(0 ${(1 - read) * 100}% 0 0)`;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: COL.width, textAlign: left ? "right" : "left", translate: `${(left ? 6 : -6) * settle}px 0px` }}>
      <div style={{ fontFamily: font.sans, fontSize: 22, fontWeight: 500, color: tone.muted, opacity: enter(f, T.read + i * 8 - 4, 16) }}>{row.label}</div>
      <div style={{ position: "relative", marginTop: 8, height: 40 }}>
        <div style={{ fontFamily: font.mono, fontSize: 30, lineHeight: "40px", color: tone.ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", clipPath: wipe }}>
          {shown(side === "left" ? row.mainnet : row.sandbox)}
        </div>
      </div>
      {/* the row's hairline; on lock a green line converges from the outer edge toward the gutter */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 100, height: 1.5, background: tone.hairline, opacity: enter(f, T.read + i * 8, 20) }} />
      <div style={{ position: "absolute", top: 99, height: 2.5, background: GREEN, opacity: sweepK,
        ...(left ? { right: 0, width: `${sweep * 100}%` } : { left: 0, width: `${sweep * 100}%` }) }} />
    </div>
  );
};

/** The lock mark in the gutter: a green ring and a check drawn on. */
const Lock: FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame();
  const tone = useTone();
  const lock = T.locks[i];
  const ring = enter(f, lock - 2, 14);
  const check = interpolate(f, [lock + 2, lock + 14], [0, 1], { ...c, easing: ease.out });
  const idle = enter(f, T.read + i * 8 + 10, 16) * (1 - ring);
  const y = valueY(i);
  return (
    <svg width={48} height={48} viewBox="0 0 48 48" style={{ position: "absolute", left: COL.gutter - 24, top: y - 24, overflow: "visible" }}>
      <circle cx={24} cy={24} r={5} fill={tone.hairline} opacity={idle} />
      <circle cx={24} cy={24} r={19} fill="none" stroke={GREEN} strokeWidth={2.5} opacity={ring} strokeDasharray={120} strokeDashoffset={120 * (1 - ring)} />
      <path d="M15.5 24.5 L21.5 30.5 L33 18" fill="none" stroke={GREEN} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={26} strokeDashoffset={26 * (1 - check)} />
    </svg>
  );
};

export const Rows: FC<{ rows: ProofRow[] }> = ({ rows }) => (
  <>
    {rows.map((row, i) => (
      <div key={row.id}>
        <Cell row={row} i={i} side="left" />
        <Cell row={row} i={i} side="right" />
        {row.equal ? <Lock i={i} /> : null}
      </div>
    ))}
  </>
);
