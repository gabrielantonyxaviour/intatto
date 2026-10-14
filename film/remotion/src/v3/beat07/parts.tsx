import type { CSSProperties, FC, ReactNode } from "react";
import { font, GREEN, size } from "../theme";
import { useTone } from "../tone";

/** Small pieces shared by the four stations. */

export const Eyebrow: FC<{ x: number; k: number; children: ReactNode }> = ({ x, k, children }) => {
  const tone = useTone();
  return (
    <div style={{ position: "absolute", left: x, top: 262, fontFamily: font.mono, fontSize: size.label, letterSpacing: "0.04em", color: tone.muted, opacity: k, translate: `0px ${(1 - k) * 12}px`, whiteSpace: "nowrap" }}>
      {children}
    </div>
  );
};

export const Tick: FC<{ k: number; px?: number }> = ({ k, px = 32 }) => (
  <svg width={px} height={px} viewBox="0 0 30 30" style={{ flex: "none" }}>
    <circle cx={15} cy={15} r={14} fill="none" stroke={GREEN} strokeWidth={2} opacity={Math.min(1, k * 2)} />
    <path d="M8.5 15.5 L13 20 L21.5 10.5" fill="none" stroke={GREEN} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
      strokeDasharray={20} strokeDashoffset={20 * (1 - k)} />
  </svg>
);

/** A token that travels on the rail: outlined (an asset going in) or solid (what comes out). Fade `textOpacity`
 * out before squeezing the pill, so no glyph is ever distorted. */
export const Pill: FC<{ x: number; y: number; solid?: boolean; color?: string; textOpacity?: number; style?: CSSProperties; children: ReactNode }> = ({ x, y, solid, color, textOpacity = 1, style, children }) => {
  const tone = useTone();
  const c = color ?? tone.ink;
  return (
    <div style={{
      position: "absolute", left: x, top: y, translate: "-50% -50%", height: 64, padding: "0 26px", display: "flex", alignItems: "center",
      borderRadius: 32, border: `2px solid ${c}`, background: solid ? c : tone.bg, color: solid ? tone.bg : c,
      fontFamily: font.mono, fontSize: 28, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", ...style,
    }}>
      <span style={{ opacity: textOpacity }}>{children}</span>
    </div>
  );
};
