import { interpolate } from "remotion";
import { ease } from "../theme";
import { FRIDAY_END, MONDAY_START, ltvAt, OPEN_LTV, MONDAY_OPEN, pointAt } from "../datakit/replay";

/** Beat 06 cue sheet, in frames (15 s). See storyboard/MOTION_V3_DATA_PLAN.md. */
export const T = {
  eyebrow: 6,
  title: 10,
  grid: 14,
  friday: [30, 126] as const,
  close: 124,
  band: 128,
  connector: [138, 160] as const,
  gapCount: [152, 184] as const,
  meter: 212,
  meterFill: 232,
  gapPulse: [252, 270] as const,
  monday: [266, 374] as const,
  settle: 376,
  liquidations: 388,
  camera: [0, 450] as const,
} as const;

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Where the line has been drawn to, as a fraction of the plot width. */
export const drawnTo = (f: number) => {
  if (f < T.friday[0]) return 0;
  if (f < T.monday[0]) return interpolate(f, T.friday, [0, FRIDAY_END], { ...c, easing: ease.inOut });
  return interpolate(f, T.monday, [MONDAY_START, 1], { ...c, easing: ease.inOut });
};

/** The loan's LTV the meter shows at frame f: rises to the opening 49.5%, steps across the gap, then rides Monday. */
export const meterLtv = (f: number) => {
  if (f < T.gapPulse[0]) return interpolate(f, [T.meterFill, T.meterFill + 20], [0, OPEN_LTV], { ...c, easing: ease.out });
  if (f < T.monday[0]) return interpolate(f, T.gapPulse, [OPEN_LTV, ltvAt(MONDAY_OPEN)], { ...c, easing: ease.out });
  return ltvAt(pointAt(drawnTo(f)).price);
};
