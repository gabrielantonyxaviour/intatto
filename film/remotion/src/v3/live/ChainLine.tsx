import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ease, enter } from "../theme";
import { useTone } from "../tone";
import { BORROW, BRANCH_X, DEPLOY, FORK, FORK_Y } from "./world";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SPAN = 4200;
const BLOCK_GAP = 24; // world px between block ticks (texture: the chain is made of blocks)

export type ChainTiming = { draw: readonly [number, number]; nodes: { deploy: number; borrow: number; fork: number }; branch: readonly [number, number]; fade: number };

/**
 * The X Layer block line in world coordinates (render inside the world transform). It draws out from under the logo
 * in both directions; block ticks give it texture, and right of the fork they drift right: mainnet keeps producing
 * blocks. Nodes mark real blocks; the fork's branch curves down to FORK_Y and runs on as the fork's own line.
 */
export const ChainLine: FC<{ t: ChainTiming; zoom: number }> = ({ t, zoom }) => {
  const frame = useCurrentFrame();
  const tone = useTone();
  const w = 2.4 / zoom;
  const reach = interpolate(frame, t.draw, [0, SPAN], { ...clamp, easing: ease.out });
  const branch = interpolate(frame, t.branch, [0, 1], { ...clamp, easing: ease.inOut });
  // At the end the fork's line hands over to the WeekTimeline strip, and mainnet steps back.
  const fade = interpolate(frame, [t.fade, t.fade + 24], [1, 0], clamp);
  const dim = interpolate(frame, [t.fade, t.fade + 24], [1, 0.35], clamp);
  const drift = (frame * 0.9) % BLOCK_GAP;

  const ticks: number[] = [];
  for (let x = -SPAN; x <= SPAN; x += BLOCK_GAP) ticks.push(x);
  const node = (x: number, y: number, at: number, key: string) => {
    const k = enter(frame, at, 14);
    const ring = interpolate(frame, [at, at + 22], [0, 1], clamp);
    return k <= 0 ? null : (
      <g key={key}>
        <circle cx={x} cy={y} r={(7 * k) / Math.sqrt(zoom)} fill={tone.ink} />
        {ring < 1 ? <circle cx={x} cy={y} r={(8 + ring * 26) / zoom} fill="none" stroke={tone.ink} strokeWidth={1.5 / zoom} opacity={1 - ring} /> : null}
      </g>
    );
  };

  return (
    <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
      <g opacity={dim}>
        <line x1={-reach} y1={0} x2={reach} y2={0} stroke={tone.ink} strokeWidth={w} />
        {ticks.map((x) => {
          const xx = x > 0 ? x + drift : x;
          if (Math.abs(xx) > reach) return null;
          return <line key={x} x1={xx} y1={-6 / zoom} x2={xx} y2={6 / zoom} stroke={tone.muted} strokeWidth={1.2 / zoom} opacity={0.5} />;
        })}
        {node(DEPLOY.x, 0, t.nodes.deploy, "deploy")}
        {node(BORROW.x, 0, t.nodes.borrow, "borrow")}
      </g>
      {/* The fork: a copy of the chain at block 71,563,431 that runs on with its own clock. */}
      <path
        d={`M ${FORK.x} 0 C ${FORK.x + 240} 0 ${BRANCH_X - 240} ${FORK_Y} ${BRANCH_X} ${FORK_Y} L ${BRANCH_X + SPAN} ${FORK_Y}`}
        fill="none"
        stroke={tone.ink}
        strokeWidth={w}
        pathLength={1}
        strokeDasharray={`${branch} 1`}
        opacity={fade}
      />
      {node(FORK.x, 0, t.nodes.fork, "fork")}
    </svg>
  );
};
