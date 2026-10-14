import { FPS, HEIGHT, WIDTH } from "./theme";
import { beat, SCRIPT } from "./script";
import { voSeconds } from "./vo/voice";

/** Props every beat composition takes. The storyboard clips burn scratch captions; the final film turns them off. */
export type BeatProps = { scratchCaptions: boolean };

/**
 * A beat lasts as long as Gabriel's VO for it plus 0.1 s (the voice runs continuously across beats; transitions
 * happen under it); the last beat adds a 2 s hold on the URL. Before the timing pass, the script's estimate.
 */
export function beatFrames(n: number): number {
  const vo = voSeconds(n);
  if (vo === undefined) return Math.round(beat(n).seconds * FPS);
  return Math.ceil((vo + 0.1 + (n === SCRIPT.length ? 2 : 0)) * FPS);
}

/** Spread into <Composition>: id `BeatNN`, 1920×1080, 30 fps, duration from the script, captions on. */
export const beatStage = (n: number) => ({
  id: `Beat${String(n).padStart(2, "0")}`,
  durationInFrames: beatFrames(n),
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
  defaultProps: { scratchCaptions: true } as BeatProps,
});
