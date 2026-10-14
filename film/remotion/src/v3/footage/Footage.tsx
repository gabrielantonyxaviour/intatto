import { Video } from "@remotion/media";
import type { FC } from "react";
import { Sequence, staticFile } from "remotion";
import { FPS } from "../theme";
import { markSeconds, take } from "./takes";

/**
 * One piece of a recorded take on the scene timeline: from scene frame `at`, for `dur` frames, starting at
 * `mark` + `offset` seconds of take `take`, at `rate`. Swappable: re-shoot, rerun v3-takes, re-render.
 */
export type Segment = { at: number; dur: number; take: string; mark: string; offset?: number; rate?: number };

/** Source seconds shown at scene frame `f` by a segment (for placing overlays on footage events). */
export const segmentSourceAt = (s: Segment, f: number) => markSeconds(s.take, s.mark, s.offset) + ((f - s.at) / FPS) * (s.rate ?? 1);

/** Scene frame at which a segment reaches source second `t`. */
export const segmentFrameOf = (s: Segment, t: number) => s.at + ((t - markSeconds(s.take, s.mark, s.offset)) / (s.rate ?? 1)) * FPS;

/**
 * Hard-cut footage track, laid out at the recorded CSS size (1440×900) so FloatingFrame's zoom/focus work in page
 * pixels. Cuts are meant to sit under a camera move. Each segment premounts, so a cut never shows a blank frame.
 */
export const Footage: FC<{ segments: Segment[]; width?: number; height?: number }> = ({ segments, width = 1440, height = 900 }) => (
  <>
    {segments.map((s, i) => {
      const t = take(s.take);
      const from = Math.round(markSeconds(s.take, s.mark, s.offset) * FPS);
      return (
        <Sequence key={`${s.take}-${s.mark}-${i}`} from={s.at} durationInFrames={s.dur} premountFor={FPS} name={`${s.take}@${s.mark}`}>
          <Video
            src={staticFile(t.file)}
            trimBefore={from}
            playbackRate={s.rate ?? 1}
            muted
            style={{ position: "absolute", left: 0, top: 0, width, height }}
          />
        </Sequence>
      );
    })}
  </>
);
