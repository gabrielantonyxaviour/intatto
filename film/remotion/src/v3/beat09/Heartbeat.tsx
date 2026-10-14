import type { FC, ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ease, enter, font, size } from "../theme";
import { useTone } from "../tone";
import { SourceLine } from "../ui/SourceLine";
import { ANSWER, lastPriceHash, LAST_PRICE, ONCHAIN, OPEN_POST, POSTS, T0, T1, utc } from "./data";
import { HB, TAG, xOf } from "./layout";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const tall = (kind: string) => (kind === "price" ? HB.h.price : HB.h.session);

/** The playhead's time at a frame: the 110 minutes of log swept once, eased like a camera move. */
const headT = (f: number) => interpolate(f, [HB.headFrom, HB.headTo], [T0, T1], { ...clamp, easing: ease.inOut });

/** The frame the playhead reaches each time (for the per-pulse ring). */
const passFrame = (t: number) => {
  for (let f = HB.headFrom; f <= HB.headTo; f++) if (headT(f) >= t) return f;
  return HB.headTo;
};

/** One polyline: baseline, and an ECG-style blip at every onchain post, tall for prices. */
const TRACE = (() => {
  const pts: string[] = [`M ${HB.x0} ${HB.base}`];
  for (const p of ONCHAIN) {
    const x = xOf(p.t);
    pts.push(`L ${x - 5} ${HB.base}`, `L ${x - 1.5} ${HB.base - tall(p.kind)}`, `L ${x + 2.5} ${HB.base + 12}`, `L ${x + 5} ${HB.base}`);
  }
  pts.push(`L ${HB.x1} ${HB.base}`);
  return pts.join(" ");
})();

const MINUTES = (() => {
  const out: number[] = [];
  for (let t = Math.ceil(T0 / 60) * 60; t <= T1; t += 60) out.push(t);
  return out;
})();

const PULSES = POSTS.map((p) => ({ ...p, x: xOf(p.t), at: passFrame(p.t) }));
const LATEST = PULSES[PULSES.length - 1];
const LABELS: [number, string][] = [
  [T0 + 30, "12:47"],
  [Date.parse("2026-09-25T13:00:00Z") / 1000, "13:00"],
  [Date.parse("2026-09-25T13:30:00Z") / 1000, "13:30"],
  [Date.parse("2026-09-25T14:00:00Z") / 1000, "14:00"],
  [T1 - 30, "14:37 UTC"],
];

/**
 * Shot 2: the keeper's heartbeat. One blip per real post in keeper.json at its real time (price posts tall,
 * session and depth-cap posts short), a tick for each minute it read, a hollow dot where a step was retried.
 * The price the agent was quoted parks above its own blip; the newest post keeps beating.
 */
export const Heartbeat: FC = () => {
  const frame = useCurrentFrame();
  const tone = useTone();
  const axis = enter(frame, HB.axisAt, 20);
  const headX = xOf(headT(frame));
  const head = enter(frame, HB.headFrom - 4, 8) * (1 - enter(frame, HB.headTo, 12));
  const posted = ONCHAIN.filter((p) => xOf(p.t) <= headX).length;
  const intro = enter(frame, HB.axisAt + 4, 18);

  // The price tag: from the card's price row (right-aligned) to its blip (centred), then its details.
  const fly = interpolate(frame, [TAG.at, TAG.at + TAG.dur], [0, 1], { ...clamp, easing: ease.inOut });
  const tagX = interpolate(fly, [0, 1], [TAG.from.x, TAG.to.x]);
  const tagY = interpolate(fly, [0, 1], [TAG.from.y, TAG.to.y]);
  const anchor = interpolate(fly, [0, 1], [100, 50]);
  const reached = PULSES.find((p) => p.id === LAST_PRICE.id)!.at;
  const detail = enter(frame, reached, 16);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", left: 120, top: 196, opacity: intro, translate: `0px ${(1 - intro) * 16}px` }}>
        <div style={{ fontFamily: font.mono, fontSize: 96, lineHeight: 1, color: tone.ink, fontVariantNumeric: "tabular-nums" }}>{posted}</div>
        <div style={{ fontFamily: font.sans, fontSize: size.label, fontWeight: 500, color: tone.muted, marginTop: 12 }}>
          onchain posts by the keeper, 12:47–14:37 UTC
        </div>
      </div>

      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <line x1={HB.x0} y1={HB.base} x2={HB.x0 + (HB.x1 - HB.x0) * axis} y2={HB.base} stroke={tone.hairline} strokeWidth={2} />
        {MINUTES.map((t) => {
          const x = xOf(t);
          return x <= headX ? <line key={t} x1={x} y1={HB.base + 16} x2={x} y2={HB.base + 24} stroke={tone.muted} strokeWidth={1.5} opacity={0.55} /> : null;
        })}
        <defs>
          <clipPath id="hb-drawn">
            <rect x={0} y={0} width={Math.max(0, headX)} height={1080} />
          </clipPath>
        </defs>
        <path d={TRACE} fill="none" stroke={tone.ink} strokeWidth={2.5} strokeLinejoin="round" clipPath="url(#hb-drawn)" />
        {PULSES.map((p) => {
          if (frame < p.at) return null;
          if (!p.hash) return <circle key={p.id} cx={p.x} cy={HB.base} r={5.5} fill={tone.bg} stroke={tone.muted} strokeWidth={1.8} />;
          const age = frame - p.at;
          const y = HB.base - tall(p.kind);
          const ring = interpolate(age, [0, 18], [0, 1], clamp);
          return (
            <g key={p.id}>
              <circle cx={p.x - 1.5} cy={y} r={3.5} fill={tone.ink} />
              {ring < 1 ? <circle cx={p.x - 1.5} cy={y} r={4 + ring * 18} fill="none" stroke={tone.ink} strokeWidth={1.5} opacity={1 - ring} /> : null}
            </g>
          );
        })}
        {frame > HB.headTo ? <Beat x={LATEST.x - 1.5} y={HB.base - tall(LATEST.kind)} since={HB.headTo} /> : null}
        <g opacity={head}>
          <line x1={headX} y1={HB.base - 210} x2={headX} y2={HB.base + 28} stroke={tone.ink} strokeWidth={1.5} opacity={0.35} />
          <circle cx={headX} cy={HB.base} r={6} fill={tone.ink} />
        </g>
        <g opacity={enter(frame, PULSES.find((p) => p.id === OPEN_POST.id)!.at, 14)}>
          <line x1={xOf(OPEN_POST.t) - 1.5} y1={HB.base - HB.h.session - 12} x2={xOf(OPEN_POST.t) - 1.5} y2={HB.base - 196} stroke={tone.muted} strokeWidth={1.2} strokeDasharray="3 4" />
        </g>
        <line x1={TAG.to.x - 1.5} y1={TAG.to.y + 84} x2={TAG.to.x - 1.5} y2={HB.base - HB.h.price - 12} stroke={tone.muted} strokeWidth={1.2} strokeDasharray="3 4" opacity={detail} />
      </svg>

      <div style={{ position: "absolute", left: xOf(OPEN_POST.t) - 12, top: HB.base - 232, opacity: enter(frame, PULSES.find((p) => p.id === OPEN_POST.id)!.at, 14), fontFamily: font.mono, fontSize: 18, color: tone.muted, whiteSpace: "nowrap" }}>
        session OPEN · {utc(OPEN_POST.t, false)} UTC, the US open
      </div>

      {LABELS.map(([t, label]) => (
        <div key={label} style={{ position: "absolute", left: xOf(t), top: HB.base + 36, translate: "-50% 0px", fontFamily: font.mono, fontSize: 18, color: tone.muted, opacity: axis, whiteSpace: "nowrap" }}>
          {label}
        </div>
      ))}

      <div style={{ position: "absolute", left: tagX, top: tagY, translate: `-${anchor}% -50%`, textAlign: "center", opacity: frame >= TAG.at ? 1 : 0, whiteSpace: "nowrap" }}>
        <div style={{ fontFamily: font.mono, fontSize: interpolate(fly, [0, 1], [size.data, 40]), color: tone.ink, fontVariantNumeric: "tabular-nums" }}>${ANSWER.priceUsd}</div>
        <div style={{ fontFamily: font.mono, fontSize: 18, lineHeight: "24px", color: tone.muted, marginTop: 4, opacity: detail, height: 0 }}>
          posted {utc(LAST_PRICE.t)} UTC
          <br />
          tx {lastPriceHash}
        </div>
      </div>

      <Legend opacity={enter(frame, HB.headFrom + 10, 18)} />
      <SourceLine style={{ position: "absolute", left: HB.x0, top: HB.base + 166, opacity: enter(frame, HB.headFrom + 16, 18) }}>
        intatto-keeper.larinova.com/log · each post is an X Layer transaction from 0xaBa1…f808 · 25 Sep 2026
      </SourceLine>
    </div>
  );
};

/** The newest post keeps beating: one ring a second. */
const Beat: FC<{ x: number; y: number; since: number }> = ({ x, y, since }) => {
  const frame = useCurrentFrame();
  const tone = useTone();
  const k = ((frame - since) % 30) / 30;
  return <circle cx={x} cy={y} r={4 + k * 22} fill="none" stroke={tone.ink} strokeWidth={1.5} opacity={(1 - k) * 0.8} />;
};

const Legend: FC<{ opacity: number }> = ({ opacity }) => {
  const tone = useTone();
  const glyph = (h: number) => (
    <svg width={14} height={30} viewBox="0 0 14 30" style={{ display: "block" }}>
      <path d={`M 0 26 L 4 26 L 6 ${26 - h} L 9 29 L 14 26`} fill="none" stroke={tone.ink} strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
  const item = (icon: ReactNode, text: string) => (
    <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 10 }}>
      {icon}
      <span style={{ lineHeight: "20px" }}>{text}</span>
    </span>
  );
  return (
    <div style={{ position: "absolute", left: HB.x0, top: HB.base + 96, display: "flex", gap: 40, fontFamily: font.mono, fontSize: 18, color: tone.muted, opacity }}>
      {item(glyph(24), "price post")}
      {item(glyph(13), "session or depth-cap post")}
      {item(<svg width={14} height={14} style={{ display: "block", marginBottom: 3 }}><circle cx={7} cy={7} r={5} fill="none" stroke={tone.muted} strokeWidth={1.8} /></svg>, "step failed, retried next minute")}
      {item(<svg width={4} height={14} style={{ display: "block", marginBottom: 3 }}><line x1={2} y1={2} x2={2} y2={12} stroke={tone.muted} strokeWidth={1.5} /></svg>, "one read a minute")}
    </div>
  );
};
