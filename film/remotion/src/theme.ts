import { loadFont } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import type { LabelKind } from "./data/types";

const sans = loadFont("normal", {
  weights: ["400", "500", "700"],
  subsets: ["latin"],
});

const mono = loadMono("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

export const fontSans = sans.fontFamily;
export const fontMono = mono.fontFamily;

export const color = {
  bg: "#F5F5F2",
  ink: "#121212",
  muted: "#5F6368",
  rule: "#DADCD7",
  live: "#1E7F4F",
  sandboxInk: "#7A5600",
  sandboxBg: "#FFF1CC",
  replay: "#2F55B5",
  synthetic: "#B3261E",
  white: "#FFFFFF",
  dot: "#C5C7C2",
} as const;

export const labelInk: Record<LabelKind, string> = {
  LIVE: color.live,
  SANDBOX: color.sandboxInk,
  REPLAY: color.replay,
  SYNTHETIC: color.synthetic,
};

export const LABEL_COPY: Record<LabelKind, string> = {
  LIVE: "Live · X Layer mainnet",
  SANDBOX: "Sandbox · fork of X Layer mainnet",
  REPLAY: "Replay · CFD data · Dukascopy NVDA · 24 and 27 Jan 2025",
  SYNTHETIC: "Synthetic · not market data",
};

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const LEAD = 0.5;
export const TAIL = 0.9;
export const CLOSE_TAIL = 2.5;
export const SCENE_FADE = 12;

export const FRAME = {
  videoW: 1440,
  videoH: 900,
  scale: 0.9,
  chrome: 36,
  top: 96,
  radius: 12,
} as const;

export const frameWidth = FRAME.videoW * FRAME.scale;
export const frameHeight = FRAME.videoH * FRAME.scale;
export const frameLeft = (WIDTH - frameWidth) / 2;
