import { FPS } from "../theme";
import { voCue } from "../vo/voice";

/**
 * The frame in beat `n` where Gabriel starts saying `phrase` (script words, whisper timing from src/v3/vo), so
 * pictures land on his words. `estimate` (seconds) stands in until the timing pass has run. Phrases must be
 * consecutive words of VO_SCRIPT v5.3.
 */
export const said = (n: number, phrase: string, estimate: number) => Math.round((voCue(n, phrase) ?? estimate) * FPS);
