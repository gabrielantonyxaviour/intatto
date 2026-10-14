import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { fmt } from "../datakit/format";
import { enter, font, GREEN, leave, size, tracking } from "../theme";
import { useTone } from "../tone";
import { SourceLine } from "../ui/SourceLine";
import { ANSWER } from "./data";
import { CARD, Q } from "./layout";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const QUESTION_HEAD = "How much can ";
const QUESTION_TAIL = " borrow right now?";

/** The question types itself on: Inter, with the wallet in mono, and a caret that blinks once it stops. */
const Question: FC = () => {
  const frame = useCurrentFrame();
  const tone = useTone();
  const total = QUESTION_HEAD.length + ANSWER.wallet.length + QUESTION_TAIL.length;
  const typed = Math.floor(interpolate(frame, [Q.typeFrom, Q.typeTo], [0, total], clamp));
  const head = QUESTION_HEAD.slice(0, typed);
  const wallet = ANSWER.wallet.slice(0, Math.max(0, typed - QUESTION_HEAD.length));
  const tail = QUESTION_TAIL.slice(0, Math.max(0, typed - QUESTION_HEAD.length - ANSWER.wallet.length));
  const caretOn = frame < Q.typeTo || Math.floor((frame - Q.typeTo) / 15) % 2 === 0;
  return (
    <div style={{ fontFamily: font.sans, fontWeight: 600, fontSize: 64, letterSpacing: tracking.title, color: tone.ink, lineHeight: 1.15 }}>
      {head}
      <span style={{ fontFamily: font.mono, fontWeight: 500, letterSpacing: "-0.02em" }}>{wallet}</span>
      {tail}
      <span
        style={{
          display: "inline-block",
          width: 4,
          height: 62,
          marginLeft: 6,
          translate: "0px 10px",
          background: tone.ink,
          opacity: caretOn && frame < Q.answerAt + 10 ? 1 : 0,
        }}
      />
    </div>
  );
};

/** The real value, never an in-between one: each character rises into place, staggered left to right. */
const RiseText: FC<{ text: string; at: number }> = ({ text, at }) => {
  const frame = useCurrentFrame();
  return (
    <span style={{ display: "inline-flex", overflow: "hidden", verticalAlign: "bottom" }}>
      {text.split("").map((ch, i) => {
        const k = enter(frame, at + i, 18);
        return (
          <span key={i} style={{ display: "inline-block", opacity: k, translate: `0px ${(1 - k) * 0.6}em` }}>
            {ch}
          </span>
        );
      })}
    </span>
  );
};

const Row: FC<{ i: number; label: string; value: string; hideValue?: boolean }> = ({ i, label, value, hideValue }) => {
  const frame = useCurrentFrame();
  const tone = useTone();
  const k = enter(frame, CARD.rowsAt + i * 6, 20);
  return (
    <div
      style={{
        position: "absolute",
        left: CARD.rowsX,
        right: CARD.x + CARD.w - CARD.rowsRight,
        top: CARD.rowTop(i) - CARD.y,
        height: CARD.rowH,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderTop: i === 0 ? "none" : `1px solid ${tone.hairline}`,
        opacity: k,
        translate: `0px ${(1 - k) * 14}px`,
      }}
    >
      <span style={{ fontFamily: font.sans, fontSize: size.label, fontWeight: 500, color: tone.muted }}>{label}</span>
      <span style={{ fontFamily: font.mono, fontSize: size.data, color: tone.ink, fontVariantNumeric: "tabular-nums", opacity: hideValue ? 0 : 1 }}>
        {value}
      </span>
    </div>
  );
};

/**
 * Shot 1: an agent's question, the request it makes, and the credit API's real answer for the demo wallet
 * (credit.json). The borrowable amount rises in at its real value; the price row's value is handed to the heartbeat.
 */
export const AgentQA: FC = () => {
  const frame = useCurrentFrame();
  const tone = useTone();
  const qOut = leave(frame, Q.exitAt, 18);
  const req = interpolate(frame, [Q.requestAt, Q.requestAt + 22], [0, 1], { ...clamp, easing: (t) => 1 - (1 - t) ** 3 });
  const done = enter(frame, Q.requestAt + 26, 12);
  const card = enter(frame, Q.answerAt, 22);
  const cardOut = leave(frame, CARD.exitAt, 12);
  const push = interpolate(frame, [0, CARD.exitAt], [1, 1.025], clamp);

  return (
    <div style={{ position: "absolute", inset: 0, scale: String(push), transformOrigin: "120px 45%" }}>
      <div style={{ position: "absolute", left: Q.x, top: Q.y, opacity: qOut, translate: `0px ${(1 - qOut) * -24}px` }}>
        <div style={{ fontFamily: font.sans, fontSize: size.label, fontWeight: 500, color: tone.muted, marginBottom: 14, opacity: enter(frame, 2, 16) }}>
          An agent asks
        </div>
        <Question />
        <div style={{ marginTop: 34, display: "flex", alignItems: "center", gap: 18, fontFamily: font.mono, fontSize: size.label, color: tone.muted }}>
          <span style={{ clipPath: `inset(0 ${(1 - req) * 100}% 0 0)` }}>{ANSWER.request}</span>
          <span style={{ opacity: done, color: GREEN }}>200</span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: CARD.x,
          top: CARD.y,
          width: CARD.w,
          height: CARD.h,
          boxSizing: "border-box",
          border: `1.5px solid ${tone.hairline}`,
          borderRadius: 18,
          background: tone.bg,
          opacity: card * cardOut,
          translate: `0px ${(1 - card) * 40 + (1 - cardOut) * 16}px`,
        }}
      >
        <div style={{ position: "absolute", left: CARD.pad, top: CARD.pad, opacity: enter(frame, CARD.rowsAt - 4, 18) }}>
          <div style={{ fontFamily: font.sans, fontSize: size.label, fontWeight: 500, color: tone.muted }}>Borrowing capacity now</div>
          <div style={{ fontFamily: font.mono, fontSize: 104, lineHeight: 1.1, color: tone.ink, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", marginTop: 8 }}>
            <RiseText text={fmt(ANSWER.borrowable, 6)} at={CARD.revealAt} />
            <span style={{ fontSize: 44, color: tone.muted, marginLeft: 18 }}>USDG</span>
          </div>
          <div style={{ fontFamily: font.sans, fontSize: size.label, color: tone.muted, marginTop: 14 }}>
            for {ANSWER.wallet} against NVDAx, right now
          </div>
        </div>
        <Row i={0} label="Session" value={`${ANSWER.session} · max LTV ${ANSWER.limitPct}%`} />
        <Row i={1} label="LTV" value={`${fmt(ANSWER.ltvPct, 2)}%`} />
        <Row i={2} label="Liquidation price (65% threshold)" value={`$${fmt(ANSWER.liquidationUsd, 2)}`} />
        <Row i={3} label="NVDAx price, keeper relay" value={`$${ANSWER.priceUsd}`} hideValue={frame >= CARD.handoffAt} />

      </div>
      <SourceLine style={{ position: "absolute", left: CARD.x + 4, top: CARD.y + CARD.h + 18, opacity: enter(frame, CARD.rowsAt + 30, 16) * cardOut }}>
        intatto.larinova.com/api/credit · X Layer block {fmt(ANSWER.block, 0)} · {ANSWER.asOf}
      </SourceLine>
    </div>
  );
};
