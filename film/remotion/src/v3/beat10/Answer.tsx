import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { enter, font } from "../theme";
import { layout, ROW_H } from "./layout";
import { AI, DATA, T } from "./look";
import { glass } from "./Service";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const ANSWER_PAD = 36;
/** The headline number's baseline area inside the card, for the camera's push. */
export const NUMBER_AT = { x: ANSWER_PAD + 230, y: ANSWER_PAD + 96 } as const;

/** The real value, never an in-between one: each character rises into place, left to right. */
const Rise: FC<{ text: string; at: number }> = ({ text, at }) => {
  const frame = useCurrentFrame();
  return (
    <span style={{ display: "inline-flex", overflow: "hidden", verticalAlign: "bottom", padding: "0.08em 0", margin: "-0.08em 0" }}>
      {[...text].map((ch, i) => {
        const k = enter(frame, at + i * 1.5, 20);
        return (
          <span key={i} style={{ display: "inline-block", opacity: k, translate: `0px ${(1 - k) * 0.7}em`, filter: k < 1 && k > 0 ? `blur(${(1 - k) * 4}px)` : undefined }}>
            {ch}
          </span>
        );
      })}
    </span>
  );
};

const ROWS = [
  { label: "Session", value: DATA.session },
  { label: "Limit", value: `${DATA.limitPct}% LTV` },
  { label: "LTV", value: `${DATA.ltv}%` },
  { label: "Liquidation price", value: `$${DATA.liquidation}` },
];

/** One row lands on its spoken word; its value catches a violet light for a moment, then rests. */
const Row: FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame();
  const at = T.rows[i];
  const k = enter(frame, at - 6, 20);
  const glow = interpolate(frame, [at - 2, at + 6, at + 34], [0, 1, 0], clamp);
  return (
    <div
      style={{
        height: ROW_H,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderTop: `1px solid ${AI.edge}`,
        opacity: k,
        translate: `0px ${(1 - k) * 12}px`,
      }}
    >
      <span style={{ fontFamily: font.sans, fontSize: 24, fontWeight: 500, color: AI.soft }}>{ROWS[i].label}</span>
      <span
        style={{
          fontFamily: font.mono,
          fontSize: 28,
          color: AI.ink,
          fontVariantNumeric: "tabular-nums",
          padding: "4px 12px",
          marginRight: -12,
          borderRadius: 10,
          background: `rgba(138,107,255,${glow * 0.32})`,
        }}
      >
        {ROWS[i].value}
      </span>
    </div>
  );
};

/** The agent's reply: Intatto's real answer for the demo wallet, read at one X Layer block (credit.json). */
export const Answer: FC = () => {
  const frame = useCurrentFrame();
  if (frame < T.answerAt) return null;
  const r = layout(frame).answer;
  const k = enter(frame, T.answerAt, 24);
  const grow = interpolate(k, [0, 1], [0.5, 1]);
  return (
    <div
      style={{
        position: "absolute",
        left: r.x,
        top: r.y,
        width: r.w,
        height: r.h * grow,
        boxSizing: "border-box",
        borderRadius: 30,
        borderTopLeftRadius: 12,
        overflow: "hidden",
        ...glass(AI.glassHi),
        opacity: Math.min(1, k * 2),
      }}
    >
      <div style={{ position: "absolute", left: ANSWER_PAD, right: ANSWER_PAD, top: ANSWER_PAD }}>
        <div style={{ fontFamily: font.sans, fontSize: 22, fontWeight: 500, color: AI.soft, opacity: enter(frame, T.answerAt + 2, 16) }}>
          Borrowable now
        </div>
        <div style={{ fontFamily: font.mono, fontSize: 92, lineHeight: 1.15, letterSpacing: "-0.03em", color: AI.ink, fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
          <Rise text={DATA.borrowable} at={T.answerAt + 5} />
          <span style={{ fontFamily: font.sans, fontSize: 36, fontWeight: 500, letterSpacing: "0", color: AI.soft, marginLeft: 16, opacity: enter(frame, T.answerAt + 22, 18) }}>
            USDG
          </span>
        </div>
        <div style={{ marginTop: 22 }}>
          {ROWS.map((_, i) => (
            <Row key={i} i={i} />
          ))}
        </div>
        <div style={{ fontFamily: font.mono, fontSize: 18, color: AI.faint, marginTop: 14, opacity: enter(frame, T.rows[3] + 12, 18) }}>
          X Layer block {DATA.block} · 14:37:56 UTC
        </div>
      </div>
    </div>
  );
};
