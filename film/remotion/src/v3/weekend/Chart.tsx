import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { enter, RED } from "../theme";
import { useTone } from "../tone";
import { xOf } from "../week/camera";
import { closeY, etOf, fridayBars, mondayBars, openY, packed, TIMES, type Bar } from "./axis";
import { camera, drawnTo, morphAt, PLOT, T, warpAt } from "./timeline";

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Screen x of a bar at frame f: on the week strip's clock at first, then on the packed plot as the weekend collapses. */
export const sx = (t: number, f: number) => {
  const w = warpAt(f);
  return xOf(etOf(t), camera(f)) * (1 - w) + (PLOT.x + packed(t) * PLOT.w) * w;
};
export const sy = (y: number) => PLOT.y + y * PLOT.h;

const pathOf = (bars: Bar[], f: number, until: number) =>
  bars
    .filter((b) => b.t <= until)
    .map((b, i) => `${i ? "L" : "M"}${sx(b.t, f).toFixed(1)},${sy(b.y).toFixed(1)}`)
    .join(" ");

/**
 * The DeepSeek weekend as one line: Friday afternoon, nothing across the weekend, Monday from its opening print.
 * The same Monday line turns into the loan's LTV when `morph` runs (price down, LTV up).
 */
export const Chart: FC = () => {
  const f = useCurrentFrame();
  const tone = useTone();
  const morph = morphAt(f);
  const until = drawnTo(f, TIMES);
  const fri = fridayBars();
  const mon = mondayBars(morph);
  const x0 = sx(TIMES.FRI_LAST, f);
  const x1 = sx(TIMES.MON_FIRST, f);
  const y0 = sy(closeY(morph));
  const y1 = sy(openY(morph));
  const drop = interpolate(f, [T.open, T.open + 12], [0, 1], { ...c, easing: (k) => 1 - Math.pow(1 - k, 3) });
  const band = enter(f, T.warp[0] + 10, 24);
  const friFade = 1 - morph;
  const head = until >= TIMES.MON_FIRST ? mon.filter((b) => b.t <= until).pop() : fri.filter((b) => b.t <= until).pop();
  const headK = f < T.friday[0] ? 0 : f < T.friday[1] + 4 || (f >= T.monday[0] && f < T.monday[1] + 4) ? 1 : 0;
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      {/* once the weekend collapses, its place is a quiet band: no bars exist there */}
      <g opacity={band * (1 - morph * 0.6)}>
        <rect x={x0} y={PLOT.y - 20} width={Math.max(0, x1 - x0)} height={PLOT.h + 40} fill={tone.wash} />
      </g>
      {/* Friday close carried across as a reference, so the drop reads against it */}
      <line x1={x0} x2={x0 + (x1 + 36 - x0) * drop} y1={sy(closeY(0))} y2={sy(closeY(0))}
        stroke={tone.muted} strokeWidth={1.5} strokeDasharray="2 8" opacity={friFade * (f >= T.open ? 1 : 0)} />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={pathOf(fri, f, until)} stroke={tone.ink} strokeWidth={3.5} opacity={friFade} />
        {f >= T.open ? (
          <line x1={x0} y1={y0} x2={x0 + (x1 - x0) * drop} y2={y0 + (y1 - y0) * drop} stroke={RED} strokeWidth={3} strokeDasharray="8 9" />
        ) : null}
        <path d={pathOf(mon, f, until)} stroke={tone.ink} strokeWidth={3.5} />
      </g>
      {f >= T.open + 10 ? <circle cx={x1} cy={y1} r={7} fill={RED} /> : null}
      <circle cx={x0} cy={y0} r={6.5} fill={tone.ink} opacity={enter(f, T.friday[1] - 4, 12)} />
      {head && headK ? (
        <g>
          <circle cx={sx(head.t, f)} cy={sy(head.y)} r={15} fill={tone.ink} opacity={0.14} />
          <circle cx={sx(head.t, f)} cy={sy(head.y)} r={6} fill={tone.ink} />
        </g>
      ) : null}
    </svg>
  );
};
