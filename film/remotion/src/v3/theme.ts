import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { Easing, interpolate } from "remotion";

/** Intatto film v3 tokens (MOTION_V3_BRIEF.md). Black and white; colour only when it means something. */

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const SAFE = { x: 120, y: 100 } as const;

export const font = {
  sans: loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] }).fontFamily,
  mono: loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily,
} as const;

/** Relational type sizes, px. */
export const size = {
  hero: 168,
  display: 120,
  title: 72,
  body: 44,
  data: 32,
  label: 22,
  source: 20,
} as const;

export const tracking = { display: "-0.035em", title: "-0.03em", body: "-0.01em", mono: "0" } as const;

export type ToneName = "light" | "dark";

export type Tone = {
  name: ToneName;
  bg: string;
  ink: string;
  muted: string;
  hairline: string;
  /** A faint fill for panels and empty tracks. */
  wash: string;
};

export const TONES: Record<ToneName, Tone> = {
  light: { name: "light", bg: "#FFFFFF", ink: "#0A0A0A", muted: "#737373", hairline: "#E5E5E5", wash: "#F5F5F5" },
  dark: { name: "dark", bg: "#0A0A0A", ink: "#FFFFFF", muted: "#A3A3A3", hairline: "#262626", wash: "#141414" },
};

/** Semantic colours only: loss, refusal and the 65% line; pass and verified. */
export const RED = "#E5484D";
export const GREEN = "#30A46C";

export const ease = {
  /** Entrances, 14–22 frames. */
  out: Easing.bezier(0.16, 1, 0.3, 1),
  /** Camera moves and the theme flip. */
  inOut: Easing.inOut(Easing.cubic),
  /** UI settles: no bounce. */
  settle: Easing.spring({ damping: 200 }),
} as const;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 → 1 over `[start, start + dur]` with ease-out expo. */
export const enter = (frame: number, start: number, dur = 18) =>
  interpolate(frame, [start, start + dur], [0, 1], { ...clamp, easing: ease.out });

/** 1 → 0 over `[start, start + dur]` with ease-in-out cubic. */
export const leave = (frame: number, start: number, dur = 14) =>
  interpolate(frame, [start, start + dur], [1, 0], { ...clamp, easing: ease.inOut });

/** Linear 0 → 1 across a range, clamped. Handy for camera pushes through a hold. */
export const progress = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [0, 1], clamp);

export const sec = (seconds: number) => Math.round(seconds * FPS);
