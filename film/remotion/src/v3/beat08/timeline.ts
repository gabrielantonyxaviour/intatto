/** Beat 08 cue sheet (8 s, VO v4): columns slide together, rows read in, lock one by one on the line, then flip to white. */
export const T = {
  slide: [4, 40] as const,
  read: 34, // first row starts reading in; +8 per row, 22 frames each
  locks: [122, 142, 154, 172] as const, // same block hash · same bytecode ×2 · same state
  flip: { start: 178, duration: 26 },
  snapshot: 192,
} as const;

export const COL = { gutter: 960, half: 90, width: 700 } as const;
export const ROW = { top: 384, pitch: 118 } as const;
export const valueY = (i: number) => ROW.top + i * ROW.pitch + 54;
