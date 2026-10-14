import type { FC } from "react";
import { Composition } from "remotion";
import { Beat01 } from "./beat01/Beat01";
import { Beat02 } from "./beat02/Beat02";
import { Beat03 } from "./beat03/Beat03";
import { Beat11 } from "./beat11/Beat11";
import { beatStage } from "./stage";

/** Beats owned by cg-motion-lead: Beat01, Beat02, Beat03, Beat11. */
export const LeadCompositions: FC = () => (
  <>
    <Composition component={Beat01} {...beatStage(1)} />
    <Composition component={Beat02} {...beatStage(2)} />
    <Composition component={Beat03} {...beatStage(3)} />
    <Composition component={Beat11} {...beatStage(11)} />
  </>
);
