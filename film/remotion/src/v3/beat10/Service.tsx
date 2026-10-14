import type { CSSProperties, FC } from "react";
import { Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { enter, font } from "../theme";
import { CARD, DOCK, layout, lerpRect } from "./layout";
import { AI, DATA, T } from "./look";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const inOut = Easing.inOut(Easing.cubic);
const AVATAR = staticFile("brand/intatto-agent-avatar.png");

export const glass = (fill: string = AI.glass): CSSProperties => ({
  background: fill,
  border: `1px solid ${AI.edge}`,
  backdropFilter: "blur(28px) saturate(140%)",
  boxShadow: "0 30px 80px rgba(3,2,20,0.45), inset 0 1px 0 rgba(255,255,255,0.10)",
});

/** Rises into place: opacity and a short upward travel, ease-out expo. */
const rise = (frame: number, at: number, px = 16): CSSProperties => {
  const k = enter(frame, at, 20);
  return { opacity: k, translate: `0px ${(1 - k) * px}px` };
};

/** The registration: who Intatto is on OKX AI. Real ids from okx-ai/credit-service.json. */
const CardFace: FC = () => {
  const frame = useCurrentFrame();
  const pulse = 0.55 + 0.45 * Math.sin(((frame - T.reviewAt) / 30) * Math.PI * 1.2) ** 2;
  return (
    <div style={{ position: "absolute", inset: 0, padding: 44, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <Img src={AVATAR} style={{ width: 104, height: 104, borderRadius: 26, display: "block" }} />
        <div>
          <div style={{ fontFamily: font.sans, fontSize: 60, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.05, color: AI.ink }}>Intatto</div>
          <div style={{ fontFamily: font.mono, fontSize: 24, color: AI.soft, marginTop: 10, whiteSpace: "nowrap", ...rise(frame, T.idAt, 12) }}>
            Agent #{DATA.agentId} · OKX AI marketplace
          </div>
        </div>
      </div>
      <div style={{ height: 1, background: AI.edge, marginTop: 32, scale: `${enter(frame, T.serviceAt - 6, 26)} 1`, transformOrigin: "0 0" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 26, ...rise(frame, T.serviceAt) }}>
        <span
          style={{
            fontFamily: font.mono,
            fontSize: 18,
            letterSpacing: "0.1em",
            color: AI.violetHi,
            padding: "6px 12px",
            borderRadius: 999,
            border: `1px solid rgba(138,107,255,0.55)`,
          }}
        >
          {DATA.serviceType}
        </span>
        <span style={{ fontFamily: font.sans, fontSize: 34, fontWeight: 500, letterSpacing: "-0.015em", color: AI.ink }}>{DATA.serviceName}</span>
      </div>
      <div
        style={{
          position: "absolute",
          top: 44,
          right: 44,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "7px 14px 7px 12px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.06)",
          border: `1px solid ${AI.edge}`,
          ...rise(frame, T.reviewAt, 10),
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 4, background: AI.violetHi, opacity: pulse }} />
        <span style={{ fontFamily: font.mono, fontSize: 17, color: AI.soft }}>Listing under review</span>
      </div>
    </div>
  );
};

/** Docked above the composer: the service this agent can call. */
const PillFace: FC = () => (
  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 12, paddingLeft: 10 }}>
    <Img src={AVATAR} style={{ width: 30, height: 30, borderRadius: 8, display: "block" }} />
    <span style={{ fontFamily: font.sans, fontSize: 20, fontWeight: 500, color: AI.ink, whiteSpace: "nowrap" }}>
      Intatto <span style={{ color: AI.faint }}>·</span> {DATA.serviceName}
    </span>
  </div>
);

const Spinner: FC<{ done: number }> = ({ done }) => {
  const frame = useCurrentFrame();
  const r = 13;
  const c = 2 * Math.PI * r;
  return (
    <svg width={32} height={32} viewBox="0 0 32 32" style={{ display: "block" }}>
      <circle cx={16} cy={16} r={r} fill="none" stroke={AI.edge} strokeWidth={2.5} opacity={1 - done} />
      <circle
        cx={16}
        cy={16}
        r={r}
        fill="none"
        stroke={done > 0 ? AI.check : AI.violetHi}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={`${c * (0.28 + done * 0.72)} ${c}`}
        transform={`rotate(${frame * 14 * (1 - done) - 90} 16 16)`}
      />
      <path d="M22 11 13.8 20.5 10 16.7" fill="none" stroke={AI.check} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={20} strokeDashoffset={20 * (1 - done)} opacity={done} />
    </svg>
  );
};

/** In the conversation: the agent calling the A2MCP service, then its 200. */
const RowFace: FC = () => {
  const frame = useCurrentFrame();
  const done = interpolate(frame, [T.okAt, T.okAt + 10], [0, 1], { ...clamp, easing: inOut });
  const sweep = interpolate(frame, [T.callAt + 8, T.okAt], [-0.4, 1.4], clamp);
  const req = interpolate(frame, [T.callAt + 14, T.okAt - 4], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 18, padding: "0 24px" }}>
      <Img src={AVATAR} style={{ width: 48, height: 48, borderRadius: 13, display: "block" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: font.sans,
            fontSize: 24,
            fontWeight: 500,
            color: AI.ink,
            whiteSpace: "nowrap",
            WebkitMaskImage:
              done < 1
                ? `linear-gradient(90deg, rgba(0,0,0,0.55) ${(sweep - 0.25) * 100}%, #000 ${sweep * 100}%, rgba(0,0,0,0.55) ${(sweep + 0.25) * 100}%)`
                : undefined,
          }}
        >
          Intatto <span style={{ color: AI.faint }}>·</span> {DATA.serviceName}
        </div>
        <div style={{ fontFamily: font.mono, fontSize: 17, color: AI.faint, marginTop: 6, whiteSpace: "nowrap", clipPath: `inset(0 ${(1 - req) * 100}% 0 0)` }}>
          {DATA.request}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: font.mono, fontSize: 18, color: AI.check, opacity: done }}>200</span>
        <Spinner done={done} />
      </div>
    </div>
  );
};

/**
 * One continuous object: the registration card folds into the service pill docked above the composer, and when
 * the agent needs it the pill lifts out of the dock into the conversation as the tool call.
 */
export const Service: FC = () => {
  const frame = useCurrentFrame();
  const t1 = interpolate(frame, [T.dockAt, T.dockAt + 28], [0, 1], { ...clamp, easing: inOut });
  const t2 = interpolate(frame, [T.callAt, T.callAt + 22], [0, 1], { ...clamp, easing: inOut });
  const row = layout(frame).tool;
  const rect = t2 > 0 ? lerpRect(DOCK, row, t2) : lerpRect(CARD, DOCK, t1);
  const radius = t2 > 0 ? 25 - t2 : 30 - t1 * 5;
  const k = enter(frame, T.cardIn, 26);
  const cardO = interpolate(t1, [0, 0.5], [1, 0], clamp);
  const pillO = interpolate(t1, [0.35, 0.8], [0, 1], clamp) * interpolate(t2, [0, 0.45], [1, 0], clamp);
  const rowO = interpolate(t2, [0.3, 0.8], [0, 1], clamp);
  const srcO = enter(frame, T.reviewAt + 10, 18) * interpolate(frame, [T.dockAt - 8, T.dockAt + 4], [1, 0], clamp);
  if (frame < T.cardIn) return null;

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          borderRadius: radius,
          overflow: "hidden",
          ...glass(t2 > 0 ? AI.glass : AI.glassHi),
          opacity: k,
          translate: `0px ${(1 - k) * 44}px`,
          scale: String(0.96 + k * 0.04),
        }}
      >
        {cardO > 0 && <div style={{ position: "absolute", inset: 0, opacity: cardO }}><CardFace /></div>}
        {pillO > 0 && <div style={{ position: "absolute", inset: 0, opacity: pillO }}><PillFace /></div>}
        {rowO > 0 && <div style={{ position: "absolute", inset: 0, opacity: rowO }}><RowFace /></div>}
      </div>
      <div style={{ position: "absolute", left: CARD.x + 4, top: CARD.y + CARD.h + 20, fontFamily: font.mono, fontSize: 18, color: AI.faint, opacity: srcO }}>
        registration tx {DATA.regTx}
      </div>
    </>
  );
};
