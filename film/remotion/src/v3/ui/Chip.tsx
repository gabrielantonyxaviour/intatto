import type { CSSProperties, FC } from "react";
import { useCurrentFrame } from "remotion";
import { enter, font, GREEN, RED, SAFE } from "../theme";
import { useTone } from "../tone";

export type ChipKind = "LIVE" | "SANDBOX" | "REPLAY" | "SYNTHETIC";

/** v5: what the material is, said plainly (MOTION_V5_BRIEF). */
export const CHIP_TEXT: Record<ChipKind, string> = {
  LIVE: "X Layer mainnet",
  SANDBOX: "Fork of X Layer mainnet",
  REPLAY: "Replay · Dukascopy CFD minute data",
  SYNTHETIC: "Synthetic scenario",
};

/** Only meaning gets colour: a green live dot for mainnet, a red dash for a synthetic scenario. */
const Mark: FC<{ kind: ChipKind }> = ({ kind }) => {
  if (kind === "LIVE") return <span style={{ width: 8, height: 8, borderRadius: 4, background: GREEN, flex: "none" }} />;
  if (kind === "SYNTHETIC") return <span style={{ width: 12, height: 2, background: RED, flex: "none" }} />;
  return null;
};

/** One honesty statement as quiet type (no box). Kept for existing call sites; prefer HonestyLabel. */
export const Chip: FC<{ kind: ChipKind; text?: string; style?: CSSProperties }> = ({ kind, text, style }) => {
  const tone = useTone();
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        fontFamily: font.mono,
        fontSize: 20,
        letterSpacing: "0.02em",
        color: tone.muted,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <Mark kind={kind} />
      {text ?? CHIP_TEXT[kind]}
    </span>
  );
};

/**
 * The honesty line: ONE small, quiet line of type top-left at the safe margin, e.g. "Fork of X Layer mainnet ·
 * Replay · Dukascopy CFD minute data". It rises in once at `from` and stays while mounted: mount it for exactly
 * the span its content is on screen. `text` overrides the whole line when a beat needs its own wording.
 */
export const HonestyLabel: FC<{ kinds: ChipKind[]; from?: number; text?: string; style?: CSSProperties }> = ({
  kinds,
  from = 0,
  text,
  style,
}) => {
  const frame = useCurrentFrame();
  const tone = useTone();
  const k = enter(frame, from, 20);
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.x,
        top: SAFE.y - 30,
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontFamily: font.mono,
        fontSize: 20,
        letterSpacing: "0.02em",
        color: tone.muted,
        whiteSpace: "nowrap",
        opacity: k,
        translate: `0px ${(1 - k) * 8}px`,
        ...style,
      }}
    >
      {kinds.map((kind) => (
        <Mark key={kind} kind={kind} />
      ))}
      {text ?? kinds.map((kind) => CHIP_TEXT[kind]).join(" · ")}
    </div>
  );
};

/** v3 name, now the quiet line. */
export const ChipRow = HonestyLabel;
