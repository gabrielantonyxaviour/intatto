import type { FC } from "react";
import type { LabelKind } from "../data/types";
import { LABEL_COPY, color, fontMono, frameLeft, frameWidth, labelInk } from "../theme";

export const LabelRow: FC<{ kinds: LabelKind[] }> = ({ kinds }) => (
  <div style={{ position: "absolute", top: 36, left: frameLeft, display: "flex", gap: 12, alignItems: "center" }}>
    {kinds.map((kind) => (
      <span
        key={kind}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontFamily: fontMono,
          fontSize: 22,
          lineHeight: 1,
          letterSpacing: 0.3,
          textTransform: "uppercase",
          color: labelInk[kind],
          background: kind === "SANDBOX" ? color.sandboxBg : "transparent",
          borderRadius: 6,
          padding: kind === "SANDBOX" ? "5px 10px" : 0,
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: 5, background: labelInk[kind] }} />
        {LABEL_COPY[kind]}
      </span>
    ))}
  </div>
);

export const OldUiFlag: FC = () => (
  <div
    style={{
      position: "absolute",
      top: 36,
      left: frameLeft + frameWidth - 88,
      fontFamily: fontMono,
      fontSize: 14,
      letterSpacing: 1,
      color: color.muted,
      border: `1px solid ${color.rule}`,
      borderRadius: 4,
      padding: "5px 8px",
      background: color.bg,
    }}
  >
    OLD UI
  </div>
);
