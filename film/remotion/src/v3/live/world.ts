import type { CSSProperties } from "react";
import { HEIGHT, WIDTH } from "../theme";
import { keyed, type Key } from "../uibeats/camera";

/**
 * Beat 4's world: one horizontal line of X Layer blocks at world y = 0, left = earlier. Real blocks, spaced 1.6 px
 * per block so the distances are honest: Intatto deployed (71,562,056) → the live borrow (71,562,308) → the fork
 * point (71,563,431, world x = 0). Right of the fork, mainnet runs on along y = 0 and the fork branches down to
 * y = FORK_Y, where it becomes the WeekTimeline strip (screen y 540) for Beat 5.
 */
export const PX_PER_BLOCK = 1.6;
export const FORK_BLOCK = 71_563_431;
export const bx = (block: number) => (block - FORK_BLOCK) * PX_PER_BLOCK;

export const DEPLOY = { block: 71_562_056, x: bx(71_562_056) }; // 25 Sep 2026 10:11:32 UTC
export const BORROW = { block: 71_562_308, x: bx(71_562_308) }; // 10:15:44 UTC, tx 0xa933…0f45
export const FORK = { block: FORK_BLOCK, x: 0 };
export const FORK_Y = 300;
/** Where the fork's branch becomes straight. */
export const BRANCH_X = 520;

export type WorldCam = { x: number; y: number; zoom: number };

/** A world camera through keyframes: zoom in log space, every move eased in and out. */
export const worldCamera = (keys: ReadonlyArray<Key<WorldCam>>) => (frame: number): WorldCam => ({
  x: keyed(frame, keys.map(([f, c]) => [f, c.x] as const)),
  y: keyed(frame, keys.map(([f, c]) => [f, c.y] as const)),
  zoom: Math.exp(keyed(frame, keys.map(([f, c]) => [f, Math.log(c.zoom)] as const))),
});

/** The transform that puts world (cam.x, cam.y) at the frame's centre at cam.zoom. */
export const worldStyle = (cam: WorldCam): CSSProperties => ({
  position: "absolute",
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  transformOrigin: "0 0",
  transform: `translate(${WIDTH / 2 - cam.x * cam.zoom}px, ${HEIGHT / 2 - cam.y * cam.zoom}px) scale(${cam.zoom})`,
});

/** Screen position of a world point. */
export const toScreen = (cam: WorldCam, x: number, y: number) => ({
  x: WIDTH / 2 + (x - cam.x) * cam.zoom,
  y: HEIGHT / 2 + (y - cam.y) * cam.zoom,
});
