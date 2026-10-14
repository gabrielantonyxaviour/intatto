import type { FC, ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ease, HEIGHT, WIDTH, type ToneName } from "../theme";
import { Ground, ToneProvider } from "../tone";

export type FlipProps = {
  /** Frame the circle starts growing. */
  start: number;
  /** Frames until it covers the frame. */
  duration?: number;
  /** Centre of the circle, in frame pixels (usually the dial's centre). */
  origin: { x: number; y: number };
  from: ToneName;
  to: ToneName;
  children: ReactNode;
};

/**
 * The signature transition. The same content is rendered in both tones; the `to` tone is revealed inside a circle
 * growing from `origin`, so every glyph inverts exactly at the circle's edge. Children read colours via useTone().
 * Before `start` only the `from` layer renders, after the end only the `to` layer.
 */
export const ThemeFlip: FC<FlipProps> = ({ start, duration = 30, origin, from, to, children }) => {
  const frame = useCurrentFrame();
  const end = start + duration;
  const cover = Math.hypot(Math.max(origin.x, WIDTH - origin.x), Math.max(origin.y, HEIGHT - origin.y)) + 4;
  const radius = interpolate(frame, [start, end], [0, cover], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease.inOut,
  });
  const layer = (tone: ToneName) => (
    <ToneProvider tone={tone}>
      <Ground>{children}</Ground>
    </ToneProvider>
  );
  if (frame < start) return layer(from);
  if (frame >= end) return layer(to);
  return (
    <AbsoluteFill>
      {layer(from)}
      <AbsoluteFill style={{ clipPath: `circle(${radius}px at ${origin.x}px ${origin.y}px)` }}>{layer(to)}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/** A fixed-tone ground for scenes (or parts of scenes) that don't flip. */
export const Toned: FC<{ tone: ToneName; children: ReactNode }> = ({ tone, children }) => (
  <ToneProvider tone={tone}>
    <Ground>{children}</Ground>
  </ToneProvider>
);
