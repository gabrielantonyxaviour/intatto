import { interpolate } from "remotion";
import { ease } from "../theme";

/** A camera pose on a 1440×900 recorded page: zoom ≥ 1 about the focus point (page px). */
export type Cam = { zoom: number; x: number; y: number };
export type Key<T> = readonly [number, T];

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** A number through keyframes, eased in and out between each pair (camera language). Holds are free. */
export function keyed(frame: number, keys: ReadonlyArray<Key<number>>, easing = ease.inOut): number {
  if (keys.length === 1) return keys[0][1];
  return interpolate(
    frame,
    keys.map((k) => k[0]),
    keys.map((k) => k[1]),
    { ...clamp, easing },
  );
}

/**
 * Camera through keyframes. Zoom interpolates in log space so a push feels even (a linear scale ramp reads as
 * slowing down); the focus eases with it. Returns FloatingFrame's `zoom` and `focus` props.
 */
export function camera(frame: number, keys: ReadonlyArray<Key<Cam>>) {
  const zoom = Math.exp(keyed(frame, keys.map(([f, c]) => [f, Math.log(c.zoom)] as const)));
  return {
    zoom,
    focus: {
      x: keyed(frame, keys.map(([f, c]) => [f, c.x] as const)),
      y: keyed(frame, keys.map(([f, c]) => [f, c.y] as const)),
    },
  };
}

/**
 * The scale FloatingFrame applies to the page (fit × zoom), so overlays drawn in page px can keep a constant
 * on-screen stroke. Mirrors FloatingFrame: fit = width / 1440.
 */
export const pageScale = (frameWidth: number, zoom: number, contentWidth = 1440) => (frameWidth / contentWidth) * Math.max(1, zoom);

/** Deterministic tiny shake (px) for `dur` frames from `start`, decaying. Used once: the SessionLimit stamp. */
export function shake(frame: number, start: number, dur: number, amp: number) {
  const t = frame - start;
  if (t < 0 || t >= dur) return { x: 0, y: 0 };
  const k = amp * (1 - t / dur);
  const pattern = [
    [1, -0.6],
    [-0.8, 0.9],
    [0.7, 0.4],
    [-0.5, -0.8],
    [0.4, 0.6],
    [-0.2, -0.3],
  ];
  const [x, y] = pattern[t % pattern.length];
  return { x: x * k, y: y * k };
}
