import type { FC, ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Captions } from "../components/Captions";
import { SceneAudio } from "../components/SceneAudio";
import { cueSeconds } from "../lib/cues";
import { FPS, LEAD, color, fontMono, fontSans } from "../theme";

const ITEMS = ["xStocks", "their pools", "USDG", "OKX AI"];
const STATS = [
  { n: "$91.5M", t: "xStocks on X Layer", s: "Crypto Briefing, 12 Sep 2026" },
  { n: "0", t: "xStocks listed on X Layer's Aave", s: "onchain read, 25 Sep 2026" },
];

const ease = Easing.bezier(0.16, 1, 0.3, 1);

const at = (phrase: string) => Math.round((LEAD + cueSeconds("close", phrase)) * FPS);

export const Close: FC = () => {
  const frame = useCurrentFrame();
  const items = at("Everything Intatto needs");
  const stats = at("ninety-one");
  const next = at("Next");
  const mark = at("Intatto. Borrow");
  const line = at("Borrow against tokenized");
  const url = at("And it's live");
  return (
    <AbsoluteFill style={{ background: color.bg }}>
      <Phase frame={frame} start={items} end={stats}>
        <div style={{ display: "flex", gap: 20 }}>
          {ITEMS.map((item, index) => (
            <div
              key={item}
              style={{
                minWidth: 210,
                textAlign: "center",
                fontFamily: fontSans,
                fontSize: 28,
                fontWeight: 500,
                color: color.ink,
                background: color.white,
                border: `1px solid ${color.rule}`,
                borderRadius: 12,
                padding: "28px 22px",
                opacity: fadeIn(frame, items + index * 4),
                translate: `0px ${rise(frame, items + index * 4)}px`,
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </Phase>
      <Phase frame={frame} start={stats} end={next}>
        <div style={{ display: "flex", gap: 88 }}>
          {STATS.map((stat) => (
            <div key={stat.n} style={{ width: 480 }}>
              <div style={{ fontFamily: fontSans, fontWeight: 700, fontSize: 88, letterSpacing: -2, color: color.ink }}>{stat.n}</div>
              <div style={{ fontFamily: fontSans, fontSize: 26, lineHeight: 1.3, color: color.ink, marginTop: 8 }}>{stat.t}</div>
              <div style={{ fontFamily: fontMono, fontSize: 16, color: color.muted, marginTop: 10 }}>{stat.s}</div>
            </div>
          ))}
        </div>
      </Phase>
      <Phase frame={frame} start={next} end={mark}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: fontMono, fontSize: 18, letterSpacing: 2, color: color.muted }}>NEXT</div>
          <div style={{ fontFamily: fontSans, fontSize: 40, color: color.ink, marginTop: 14 }}>
            Chainlink Data Streams live · more stocks
          </div>
        </div>
      </Phase>
      {frame >= mark ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 280, textAlign: "center" }}>
          <div
            style={{
              fontFamily: fontSans,
              fontWeight: 700,
              fontSize: 140,
              letterSpacing: -3,
              color: color.ink,
              lineHeight: 1,
              opacity: fadeIn(frame, mark),
              translate: `0px ${rise(frame, mark)}px`,
            }}
          >
            Intatto
          </div>
          <div
            style={{
              fontFamily: fontSans,
              fontSize: 34,
              lineHeight: 1.35,
              color: color.ink,
              maxWidth: 920,
              margin: "36px auto 0",
              opacity: frame >= line ? fadeIn(frame, line) : 0,
            }}
          >
            Borrow against tokenized stocks on X Layer, with limits that know when the market is closed.
          </div>
          <div style={{ marginTop: 40, opacity: frame >= url ? fadeIn(frame, url) : 0 }}>
            <div style={{ fontFamily: fontMono, fontSize: 28, color: color.ink }}>intatto.larinova.com</div>
            <div style={{ fontFamily: fontSans, fontSize: 22, color: color.muted, marginTop: 10 }}>
              Live on X Layer mainnet · contracts verified on OKLink
            </div>
          </div>
        </div>
      ) : null}
      <Captions beat="close" />
      <SceneAudio beat="close" />
    </AbsoluteFill>
  );
};

const fadeIn = (frame: number, start: number) =>
  interpolate(frame, [start, start + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

const rise = (frame: number, start: number) =>
  interpolate(frame, [start, start + 12], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

const Phase: FC<{ frame: number; start: number; end: number; children: ReactNode }> = ({ frame, start, end, children }) => {
  if (frame < start || frame >= end || end <= start) return null;
  const fade = Math.min(12, Math.max(4, Math.floor((end - start) / 4)));
  const room = end - start > fade * 2 + 1;
  const opacity = room
    ? Math.min(
        interpolate(frame, [start, start + fade], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        interpolate(frame, [end - fade, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      )
    : 1;
  const lift = room
    ? interpolate(frame, [end - fade, end], [0, -12], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        translate: `0px ${lift}px`,
      }}
    >
      {children}
    </div>
  );
};
