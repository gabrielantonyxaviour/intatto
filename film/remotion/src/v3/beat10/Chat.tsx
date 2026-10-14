import type { FC } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { enter, font } from "../theme";
import { COMPOSER, layout, presence } from "./layout";
import { AI, DATA, T } from "./look";
import { glass } from "./Service";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const QUESTION = `How much can ${DATA.wallet} borrow right now?`;

/** The question, set the way iMessage sets it: the wallet in mono so the address reads as an address. */
const QuestionText: FC<{ chars?: number }> = ({ chars = QUESTION.length }) => {
  const [head, tail] = QUESTION.split(DATA.wallet);
  const w0 = Math.min(chars, head.length);
  const w1 = Math.max(0, Math.min(chars - head.length, DATA.wallet.length));
  const w2 = Math.max(0, chars - head.length - DATA.wallet.length);
  return (
    <>
      {head.slice(0, w0)}
      <span style={{ fontFamily: font.mono, fontSize: "0.92em", letterSpacing: "-0.02em" }}>{DATA.wallet.slice(0, w1)}</span>
      {tail.slice(0, w2)}
    </>
  );
};

/** The composer: the question types in, the send button lights, and on send the text leaves as the bubble. */
const Composer: FC = () => {
  const frame = useCurrentFrame();
  const k = enter(frame, T.dockAt + 6, 24);
  const typed = Math.floor(interpolate(frame, [T.typeFrom, T.sendAt - 8], [0, QUESTION.length], clamp));
  const sent = frame >= T.sendAt;
  const armed = interpolate(frame, [T.typeFrom, T.typeFrom + 6], [0, 1], clamp) * (sent ? interpolate(frame, [T.sendAt, T.sendAt + 10], [1, 0], clamp) : 1);
  const press = frame >= T.sendAt - 3 && frame < T.sendAt + 3 ? 0.9 : 1;
  const caret = !sent && Math.floor(frame / 15) % 2 === 0;
  return (
    <div
      style={{
        position: "absolute",
        left: COMPOSER.x,
        top: COMPOSER.y,
        width: COMPOSER.w,
        height: COMPOSER.h,
        borderRadius: COMPOSER.h / 2,
        ...glass(),
        display: "flex",
        alignItems: "center",
        padding: "0 12px 0 30px",
        boxSizing: "border-box",
        opacity: k,
        translate: `0px ${(1 - k) * 30}px`,
      }}
    >
      <div style={{ flex: 1, fontFamily: font.sans, fontSize: 28, color: typed > 0 && !sent ? AI.ink : AI.faint, whiteSpace: "nowrap" }}>
        {typed > 0 && !sent ? <QuestionText chars={typed} /> : "Message"}
        {caret && typed > 0 && <span style={{ display: "inline-block", width: 2.5, height: 32, background: AI.violetHi, marginLeft: 3, translate: "0px 6px" }} />}
      </div>
      <div
        style={{
          width: 50,
          height: 50,
          borderRadius: 25,
          background: `rgba(108,67,253,${0.25 + armed * 0.75})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          scale: String(press),
        }}
      >
        <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" opacity={0.5 + armed * 0.5}>
          <path d="m5 12 7-7 7 7" />
          <path d="M12 19V5" />
        </svg>
      </div>
    </div>
  );
};

/** Three dots breathing in sequence while the agent works out what to call. */
const Dots: FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "center", justifyContent: "center", height: "100%" }}>
      {[0, 1, 2].map((i) => {
        const w = 0.5 + 0.5 * Math.sin(((frame - i * 5) / 30) * Math.PI * 2.2);
        return <span key={i} style={{ width: 12, height: 12, borderRadius: 6, background: AI.ink, opacity: 0.3 + w * 0.6, translate: `0px ${-w * 3}px` }} />;
      })}
    </div>
  );
};

/** The conversation above the composer: the sent question and the typing dots. */
export const Chat: FC = () => {
  const frame = useCurrentFrame();
  if (frame < T.dockAt) return null;
  const L = layout(frame);
  // The bubble leaves the composer and settles in its slot: travel up from the composer line, ease-out expo.
  const send = interpolate(frame, [T.sendAt, T.sendAt + 18], [0, 1], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const fromY = COMPOSER.y - L.ask.y;
  const dots = presence(frame, "dots");

  return (
    <>
      {frame >= T.sendAt && (
        <div
          style={{
            position: "absolute",
            right: 1920 - (L.ask.x + L.ask.w),
            top: L.ask.y,
            height: L.ask.h,
            boxSizing: "border-box",
            borderRadius: 30,
            borderBottomRightRadius: 10,
            background: `linear-gradient(180deg, ${AI.violetHi} 0%, ${AI.violet} 100%)`,
            boxShadow: "0 18px 50px rgba(108,67,253,0.35)",
            display: "flex",
            alignItems: "center",
            padding: "0 30px",
            fontFamily: font.sans,
            fontSize: 30,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: "#fff",
            whiteSpace: "nowrap",
            translate: `${(1 - send) * 40}px ${(1 - send) * fromY}px`,
            scale: String(0.94 + send * 0.06),
            transformOrigin: "100% 100%",
            opacity: interpolate(send, [0, 0.25], [0, 1], clamp),
          }}
        >
          <span>
            <QuestionText />
          </span>
        </div>
      )}
      {dots > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: L.dots.x,
            top: L.dots.y,
            width: L.dots.w,
            height: L.dots.h,
            borderRadius: 30,
            borderBottomLeftRadius: 10,
            ...glass(),
            opacity: dots,
            scale: String(0.8 + dots * 0.2),
            transformOrigin: "0% 100%",
          }}
        >
          <Dots />
        </div>
      )}
      <Composer />
    </>
  );
};
