import type { CSSProperties, FC, ReactNode } from "react";
import { font, size } from "../theme";
import { useTone } from "../tone";

/** The small grey mono source line under every real number, e.g. "Crypto Briefing · 12 Sep 2026". */
export const SourceLine: FC<{ children: ReactNode; style?: CSSProperties }> = ({ children, style }) => {
  const tone = useTone();
  return (
    <div
      style={{
        fontFamily: font.mono,
        fontSize: size.source,
        lineHeight: 1.4,
        letterSpacing: "0.01em",
        color: tone.muted,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
