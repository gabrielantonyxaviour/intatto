import type { FC } from "react";
import { Composition } from "remotion";
import { Beat05Friday } from "./friday/Beat05Friday";
import { Beat04Live } from "./live/Beat04Live";
import { Beat06Saturday } from "./saturday/Beat06Saturday";
import { beatStage } from "./stage";

/**
 * Beats owned by cg-motion-ui under script v5.1: Beat04 (Live, and forked), Beat05 (Friday), Beat06 (Saturday).
 * The v4 scenes in beat04/, beat05/ and beat09/ stay on disk as reference and are no longer registered.
 */
export const UiCompositions: FC = () => (
  <>
    <Composition component={Beat04Live} {...beatStage(4)} />
    <Composition component={Beat05Friday} {...beatStage(5)} />
    <Composition component={Beat06Saturday} {...beatStage(6)} />
  </>
);
