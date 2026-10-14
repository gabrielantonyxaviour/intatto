import type { FC } from "react";
import { Composition, Folder } from "remotion";
import "./index.css";
import { AiCompositions } from "./v3/compositions-ai";
import { DataCompositions } from "./v3/compositions-data";
import { LeadCompositions } from "./v3/compositions-lead";
import { UiCompositions } from "./v3/compositions-ui";
import { WeekDemo } from "./v3/week/WeekDemo";
import { FilmV5, filmFrames, type FilmProps } from "./v3/film/FilmV5";

/** v3: each beat is its own composition (Beat01 … Beat11), registered by the helper that owns it. */
export const RemotionRoot: FC = () => (
  <>
    <Folder name="film">
      <Composition
        id="FilmV5"
        component={FilmV5}
        durationInFrames={filmFrames()}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ voice: "polished", captions: true, music: "", musicVolume: 0.2 } satisfies FilmProps}
      />
    </Folder>
    <Folder name="dev">
      <Composition id="WeekDemo" component={WeekDemo} durationInFrames={300} fps={30} width={1920} height={1080} />
    </Folder>
    <Folder name="v3">
      <LeadCompositions />
      <DataCompositions />
      <UiCompositions />
      <AiCompositions />
    </Folder>
  </>
);
