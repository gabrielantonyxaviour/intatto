/** Shared v3 primitives (owned by cg-motion-lead). Import from "../index" or the files directly; never edit. */
export * from "./theme";
export * from "./tone";
export * from "./script";
export * from "./dial/session";
export { SessionDial, type SessionDialProps } from "./dial/SessionDial";
export { LimitBar, formatPct, settledLtv, type LimitBarProps } from "./dial/LimitBar";
export { ThemeFlip, Toned, type FlipProps } from "./dial/ThemeFlip";
export { Chip, ChipRow, HonestyLabel, CHIP_TEXT, type ChipKind } from "./ui/Chip";
export { SourceLine } from "./ui/SourceLine";
export { FloatingFrame, type FloatingFrameProps } from "./ui/FloatingFrame";
export { ScratchCaptions, scratchTimings, cueFrame, type CaptionTiming } from "./ui/Caption";
export { beatStage, type BeatProps } from "./stage";
export * from "./week/camera";
export { WeekTimeline, type WeekTimelineProps } from "./week/WeekTimeline";
export { SessionFlips, type SessionFlipsProps } from "./week/SessionFlips";
export { Dive, type DiveProps } from "./week/Dive";
