import type { FC } from "react";
import { Composition } from "remotion";
import { Beat10 } from "./beat10/Beat10";
import { beatStage } from "./stage";

/** Beats owned by cg-motion-ai: Beat10 (OKX AI). */
export const AiCompositions: FC = () => <Composition component={Beat10} {...beatStage(10)} />;
