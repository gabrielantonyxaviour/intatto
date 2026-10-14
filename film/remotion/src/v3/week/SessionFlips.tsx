import type { FC, ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import type { Clock } from "../dial/session";
import { Toned, ThemeFlip } from "../dial/ThemeFlip";
import { toneCrossings, weekToneAt, type ToneRule } from "./camera";

export type SessionFlipsProps = {
  clock: Clock;
  /** Frame range to scan for crossings (usually 0 … durationInFrames). */
  from: number;
  to: number;
  /** Where each flip's circle grows from at its first frame (usually the playhead or the dial centre). */
  origin: (frame: number) => { x: number; y: number };
  rule?: ToneRule;
  /** Frames each flip takes to cover the frame. */
  duration?: number;
  children: ReactNode;
};

/**
 * Lets the clock drive the ground: whenever `clock` crosses into or out of the closed market, a ThemeFlip grows
 * from `origin`. Children read colours with useTone(), so everything inverts at the circle's edge.
 */
export const SessionFlips: FC<SessionFlipsProps> = ({ clock, from, to, origin, rule = "weekend", duration = 30, children }) => {
  const frame = useCurrentFrame();
  const crossings = toneCrossings(clock, from, to, rule);
  const initial = weekToneAt(clock(from), rule);
  let active: { frame: number; from: typeof initial; to: typeof initial } | null = null;
  let tone = initial;
  for (const c of crossings) {
    if (c.frame > frame) break;
    active = { frame: c.frame, from: tone, to: c.to };
    tone = c.to;
  }
  if (!active) return <Toned tone={initial}>{children}</Toned>;
  return (
    <ThemeFlip start={active.frame} duration={duration} origin={origin(active.frame)} from={active.from} to={active.to}>
      {children}
    </ThemeFlip>
  );
};
