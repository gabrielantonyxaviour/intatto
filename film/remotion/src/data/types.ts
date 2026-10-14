export const BEATS = [
  "hook",
  "what",
  "mainnet",
  "saturday",
  "proof",
  "replay",
  "synthetic",
  "agents",
  "close",
] as const;

export type BeatId = (typeof BEATS)[number];

export const FOOTAGE_BEATS = [
  "what",
  "mainnet",
  "saturday",
  "proof",
  "replay",
  "synthetic",
  "agents",
] as const;

export type FootageBeat = (typeof FOOTAGE_BEATS)[number];

export type LabelKind = "LIVE" | "SANDBOX" | "REPLAY" | "SYNTHETIC";

export type Focus = {
  x: number;
  y: number;
  w: number;
  h: number;
  zoom: number;
};

export type Segment = {
  take: string;
  mark: string;
  offset?: number;
  cue: string | null;
  rate?: number;
  url: string;
  label: LabelKind;
  with?: LabelKind;
  focus?: Focus;
  fallback?: { take: string; mark: string; url?: string };
  /** Keep playing this take from the previous segment instead of jumping back to the mark. */
  continue?: boolean;
};

export type VoWord = { text: string; start: number; end: number };

export type VoBeat = {
  source: "gabriel" | "scratch";
  file: string;
  seconds: number;
  words: VoWord[];
};

export type TakeFile = {
  stamp: string;
  seconds: number;
  oldUi: boolean;
  marks: Record<string, number>;
};
