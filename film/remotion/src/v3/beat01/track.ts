/** Beat 1 layout shared by Beat01 and Supply (kept separate to avoid a circular import). */
export const TRACK = { x0: 200, width: 1360, a: 500, b: 720 } as const;

/** Cue frames for Beat 1 (built in Beat01's useTimeline). */
export type Timeline = { D: number; vo: string[]; seven: number; under: number; dont: number; money: number; cant: number };
