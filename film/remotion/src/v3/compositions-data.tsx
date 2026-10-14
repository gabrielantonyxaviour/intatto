import type { FC } from "react";
import { Composition } from "remotion";
import { beatStage } from "./stage";
import { Beat07 } from "./weekend/Beat07";
import { Beat08 } from "./hood/Beat08";
import { Beat09 } from "./model/Beat09";

/**
 * Beats owned by cg-motion-data under script v5.1: Beat07 The real weekend, Beat08 Under the hood, Beat09 The model.
 * (The v3 folders beat06/beat07/beat08 are kept as sources to recycle; they're no longer registered under those ids.)
 */
export const DataCompositions: FC = () => (
  <>
    <Composition component={Beat07} {...beatStage(7)} />
    <Composition component={Beat08} {...beatStage(8)} />
    <Composition component={Beat09} {...beatStage(9)} />
  </>
);
