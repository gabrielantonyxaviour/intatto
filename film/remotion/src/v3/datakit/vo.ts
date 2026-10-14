import type { CaptionTiming } from "../ui/Caption";
import { sec } from "../theme";

/**
 * Scratch caption timings for the data beats, in frames, placed by hand on the phrases the pictures land on
 * (VO_SCRIPT.md v4, verbatim). Replace with whisper cues when Gabriel's voice-over arrives.
 */
const at = (text: string, from: number, to: number): CaptionTiming => ({ text, from: sec(from), to: sec(to) });

export const VO_TIMINGS: Record<6 | 7 | 8, CaptionTiming[]> = {
  6: [
    at("Now a real weekend: the DeepSeek selloff in January 2025,", 0.3, 3.7),
    at("when NVIDIA gapped down twelve and a half percent at Monday's open.", 3.8, 7.0),
    at("A loan opened at the weekday limit tops out around sixty percent LTV.", 7.2, 11.3),
    at("Under the threshold. No liquidations.", 11.6, 14.4),
  ],
  7: [
    at("And a real crash? Here's a synthetic forty-five percent gap.", 0.3, 3.6),
    at("The position gets sold into the pool in bounded slices, never below a price floor.", 3.8, 7.8),
    at("The reserve absorbs the shortfall first;", 8.2, 10.8),
    at("anything past that is socialized to lenders,", 11.0, 13.4),
    at("and they see that before they deposit.", 13.6, 16.6),
  ],
  8: [
    at("You don't have to trust our fork.", 0.2, 2.0),
    at("Your browser verifies it against mainnet:", 2.1, 3.9),
    at("same block hash, same bytecode, same state.", 4.0, 6.6),
  ],
};
