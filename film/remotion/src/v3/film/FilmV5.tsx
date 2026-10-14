import { Audio } from "@remotion/media";
import type { FC } from "react";
import { Sequence, Series, staticFile } from "remotion";
import { Beat01 } from "../beat01/Beat01";
import { Beat02 } from "../beat02/Beat02";
import { Beat03 } from "../beat03/Beat03";
import { Beat10 } from "../beat10/Beat10";
import { Beat11 } from "../beat11/Beat11";
import { Beat05Friday } from "../friday/Beat05Friday";
import { Beat08 } from "../hood/Beat08";
import { Beat04Live } from "../live/Beat04Live";
import { Beat09 } from "../model/Beat09";
import { Beat06Saturday } from "../saturday/Beat06Saturday";
import { beatStage, type BeatProps } from "../stage";
import { voFile, type VoSource } from "../vo/voice";
import { Beat07 } from "../weekend/Beat07";

/**
 * The master film (v5.3): Beat01 … Beat11 back to back, each as long as Gabriel's VO for it (+0.1 s; +2 s URL hold
 * at the end), so the voice runs continuously and transitions happen under it. `voice` switches the source
 * (polished / edit / a future rerecord; scripts/vo-link.mjs copies them to public/), `captions` burns the script
 * lines on his real timing, and `music` is an empty slot until Gabriel picks a track. Render only on cg-film's go.
 */

export type FilmProps = {
  /** Which of Gabriel's takes to play. */
  voice: VoSource;
  /** Burn the captions (script text on his real timing); the final film may turn them off. */
  captions: boolean;
  /** Music bed under the whole film, a path in public/ (e.g. "music/bed.mp3"); empty until Gabriel picks one. */
  music: string;
  musicVolume: number;
};

const BEATS: FC<BeatProps>[] = [Beat01, Beat02, Beat03, Beat04Live, Beat05Friday, Beat06Saturday, Beat07, Beat08, Beat09, Beat10, Beat11];

export const filmFrames = () => BEATS.reduce((sum, _, i) => sum + beatStage(i + 1).durationInFrames, 0);

export const FilmV5: FC<FilmProps> = ({ voice, captions, music, musicVolume }) => (
  <>
    <Series>
      {BEATS.map((Beat, i) => {
        const stage = beatStage(i + 1);
        const vo = voFile(i + 1, voice);
        return (
          <Series.Sequence key={stage.id} name={stage.id} durationInFrames={stage.durationInFrames}>
            <Beat scratchCaptions={captions} />
            {vo ? (
              <Sequence layout="none" name={`VO ${voice}`}>
                <Audio src={staticFile(vo)} />
              </Sequence>
            ) : null}
          </Series.Sequence>
        );
      })}
    </Series>
    {music ? <Audio src={staticFile(music)} volume={musicVolume} loop /> : null}
  </>
);
