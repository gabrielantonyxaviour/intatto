import { createContext, useContext, type FC, type ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { TONES, type Tone, type ToneName } from "./theme";

const ToneContext = createContext<Tone>(TONES.light);

/** Every v3 component reads its colours from here, so ThemeFlip can render the same content in both tones. */
export const useTone = () => useContext(ToneContext);

export const ToneProvider: FC<{ tone: ToneName; children: ReactNode }> = ({ tone, children }) => (
  <ToneContext.Provider value={TONES[tone]}>{children}</ToneContext.Provider>
);

/** A full-frame ground in the current tone. */
export const Ground: FC<{ children?: ReactNode }> = ({ children }) => {
  const tone = useTone();
  return <AbsoluteFill style={{ background: tone.bg, color: tone.ink }}>{children}</AbsoluteFill>;
};
