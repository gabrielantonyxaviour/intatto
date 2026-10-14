import { interpolate } from "remotion";
import { ease } from "../theme";

/**
 * Beat 07 cue sheet (17 s, VO v4). Stations sit 1320 px apart in one wide world; the camera trucks between them,
 * then pushes into the Lend primer so its bold line reads at a glance.
 */
export const SX = [960, 2280, 3600, 4920] as const;
export const RAIL_Y = 560;

export const T = {
  crash: { column: 12, drop: [44, 66] as const, label: 64 },
  sale: { in: 120, slice: [150, 184] as const, usdg: [186, 216] as const, usdgOut: [228, 242] as const, floor: 200 },
  reserve: { in: 248, number: 272, drain: [280, 326] as const, token: [344, 378] as const },
  lenders: { in: 344, node: 352, loss: 374, share: [382, 404] as const },
  footage: { at: 408, push: [436, 466] as const, box: 448 },
} as const;

/** Each station fades as the camera starts to leave it, so no clipped text rides the frame edge. */
export const LEAVE = [110, 236, 330] as const;
const TRUCKS = [[110, 144], [236, 270], [330, 364]] as const;

/** The Lend frame's centre in world px (lands at x 1370 on screen after the last truck). */
export const FRAME = { x: SX[3] + 790, y: 548, width: 860 } as const;
/** The push: world scale and FloatingFrame zoom; page scale on screen = (860 / 1440) × zoom × scale ≈ 2.0. */
export const PUSH = { scale: 1.45, zoom: 2.3, lift: -24 } as const;

/** Camera keys: [frame, world x at the frame's centre]. Trucks are ease-in-out cubic; holds drift slightly. */
const KEYS: [number, number][] = [
  [0, SX[0] - 12], [110, SX[0] + 10], [144, SX[1] - 10], [236, SX[1] + 10], [270, SX[2] - 10],
  [330, SX[2] + 10], [364, SX[3] - 10], [404, SX[3]], [436, SX[3] + 380], [466, FRAME.x], [510, FRAME.x],
];

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const cameraX = (f: number) =>
  interpolate(f, KEYS.map((k) => k[0]), KEYS.map((k) => k[1]), { ...c, easing: ease.inOut });

/** A slight pull-back while the camera travels, then the push into the primer and a slow drift through its hold. */
export const cameraScale = (f: number) => {
  let s = 1;
  for (const [a, b] of TRUCKS) s -= 0.03 * interpolate(f, [a, (a + b) / 2, b], [0, 1, 0], { ...c, easing: ease.inOut });
  s *= interpolate(f, [...T.footage.push, 510], [1, PUSH.scale, PUSH.scale * 1.02], { ...c, easing: ease.inOut });
  return s;
};

export const cameraLift = (f: number) => interpolate(f, T.footage.push, [0, PUSH.lift], { ...c, easing: ease.inOut });

export const frameZoom = (f: number) => interpolate(f, T.footage.push, [1, PUSH.zoom], { ...c, easing: ease.inOut });
