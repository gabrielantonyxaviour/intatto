import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ease, enter, font, GREEN, RED } from "../theme";
import { useTone } from "../tone";
import { POSTS, WIDEST, DEPTH, CAP_SIZE } from "../datakit/hood";
import { bandPath, BUDGET_PRICE, BUDGET_U, depthXY, linePath, PLOT, uOfTime, xOfU, yOf } from "./geometry";
import { T } from "./timeline";

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const mono = (px: number) => ({ fontFamily: font.mono, fontSize: px, fontVariantNumeric: "tabular-nums" as const });

/**
 * Ideas 1 and 2 on one plot. The pool's 30-min average draws, the ±3% band opens around it, and the keeper's
 * real posts drop in and land inside it. Then the same line bends into the pool's price for bigger sales.
 */
export const PriceCheck: FC = () => {
  const f = useCurrentFrame();
  const tone = useTone();
  const m = interpolate(f, T.morph, [0, 1], { ...c, easing: ease.inOut });
  const draw = interpolate(f, T.line, [0, 1], { ...c, easing: ease.inOut });
  const band = interpolate(f, T.band, [0, 1], { ...c, easing: ease.out }) * (1 - m);
  const postsOut = interpolate(f, [T.morph[0] - 10, T.morph[0] + 14], [1, 0], c);
  const budget = interpolate(f, T.budget, [0, 1], { ...c, easing: ease.inOut });
  const plotIn = enter(f, 0, 20);
  const wide = interpolate(f, [T.widest[0] + 8, T.widest[1] + 4], [0, 1], { ...c, easing: ease.out }) *
    interpolate(f, [T.irisIn[1] - 2, T.irisIn[1]], [1, 0], c);
  const wx = xOfU(uOfTime(WIDEST.t));
  const pick = enter(f, T.pick, 16);
  const cap = depthXY(CAP_SIZE.shares, CAP_SIZE.price);
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      {/* the plot's floor, the only axis */}
      <line x1={PLOT.x} x2={PLOT.x + PLOT.w * plotIn} y1={PLOT.y + PLOT.h} y2={PLOT.y + PLOT.h} stroke={tone.hairline} strokeWidth={1.5} />

      {/* the relay's band: 3% either side of the pool's average while the market is open */}
      <path d={bandPath(band)} fill={tone.wash} stroke={tone.hairline} strokeWidth={1.5} opacity={band > 0.01 ? 1 : 0} />

      {/* idea 2's budget line: 2% under the smallest sale's price */}
      <line x1={PLOT.x} x2={PLOT.x + PLOT.w * budget} y1={yOf(BUDGET_PRICE)} y2={yOf(BUDGET_PRICE)} stroke={tone.muted} strokeWidth={2} strokeDasharray="6 8" />

      {draw > 0.001 ? <path d={linePath(m, 0, draw)} fill="none" stroke={tone.ink} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" /> : null}

      {/* the keeper's posts: each falls onto its price at its minute */}
      <g opacity={postsOut}>
        {POSTS.map((p, i) => {
          const at = T.posts[0] + (i * (T.posts[1] - T.posts[0])) / POSTS.length;
          const k = interpolate(f, [at, at + 12], [0, 1], { ...c, easing: ease.out });
          const ring = interpolate(f, [at + 10, at + 26], [0, 1], c);
          const x = xOfU(uOfTime(p.t));
          const y = yOf(p.keeper) - (1 - k) * 120;
          return (
            <g key={p.tx} opacity={k}>
              <circle cx={x} cy={y} r={6} fill={tone.ink} />
              <circle cx={x} cy={y} r={6 + 16 * ring} fill="none" stroke={GREEN} strokeWidth={2} opacity={(1 - ring) * (k >= 1 ? 1 : 0)} />
            </g>
          );
        })}
      </g>

      {/* the widest post of the hour, measured against the average */}
      <g opacity={wide}>
        <line x1={wx + 18} x2={wx + 18} y1={yOf(WIDEST.twap)} y2={yOf(WIDEST.keeper)} stroke={GREEN} strokeWidth={2.5} />
        <line x1={wx + 11} x2={wx + 25} y1={yOf(WIDEST.twap)} y2={yOf(WIDEST.twap)} stroke={GREEN} strokeWidth={2.5} />
        <line x1={wx + 11} x2={wx + 25} y1={yOf(WIDEST.keeper)} y2={yOf(WIDEST.keeper)} stroke={GREEN} strokeWidth={2.5} />
      </g>

      {/* idea 2: the sizes along the floor and the keeper's largest in-budget sale */}
      <g opacity={m} style={mono(20)} fill={tone.muted}>
        {DEPTH.filter((d) => [0.5, 10, 200, 1600].includes(d.shares)).map((d) => (
          <text key={d.shares} x={depthXY(d.shares, d.price).x} y={PLOT.y + PLOT.h + 38} textAnchor={d.shares === 1600 ? "end" : "middle"}>
            {d.shares.toLocaleString("en-US")}{d.shares === 1600 ? " wNVDAx sold" : ""}
          </text>
        ))}
      </g>
      <g opacity={pick}>
        <line x1={cap.x} x2={cap.x} y1={cap.y + 14} y2={PLOT.y + PLOT.h} stroke={tone.ink} strokeWidth={1.5} strokeDasharray="3 6" />
        <circle cx={cap.x} cy={cap.y} r={9} fill={tone.ink} />
        <circle cx={cap.x} cy={cap.y} r={20} fill="none" stroke={tone.ink} strokeWidth={1.5} opacity={0.4} />
      </g>
      {/* past the budget the curve turns red: a sale that big would move the price too far */}
      <path d={linePath(m, BUDGET_U, 1)} fill="none" stroke={RED} strokeWidth={3.5} strokeLinecap="round" opacity={interpolate(f, [T.budget[1], T.budget[1] + 14], [0, 1], c)} />
    </svg>
  );
};
