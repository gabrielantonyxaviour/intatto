import type { FC } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { cueSeconds } from "../lib/cues";
import { sceneFrames } from "../lib/timeline";
import { FPS, LEAD, color, fontMono, fontSans } from "../theme";

const FACTS = [
  {
    cue: "While the market is closed",
    value: "$0",
    body: "Issuer's max order while the market is closed",
    source: "xStocks public asset API, read 25 Sep 2026",
    layout: "center",
  },
  {
    cue: "Venus listed",
    value: "0",
    body: "Venus: stock collateral launched with borrowing switched off",
    source: "CryptoSlate",
    layout: "band",
  },
  {
    cue: "mishandled split",
    value: "405",
    body: "Users liquidated after a mishandled split on Ventuals",
    source: "Unchained",
    layout: "left",
  },
] as const;

const ease = Easing.bezier(0.16, 1, 0.3, 1);

export const FactCards: FC = () => {
  const frame = useCurrentFrame();
  const end = sceneFrames("hook");
  const starts = FACTS.map((fact) => Math.round((LEAD + cueSeconds("hook", fact.cue)) * FPS));
  return (
    <>
      {FACTS.map((fact, index) => {
        const start = starts[index];
        const stop = index + 1 < starts.length ? starts[index + 1] : end;
        const opacity = presence(frame, start, stop, index === FACTS.length - 1);
        const rise = interpolate(frame, [start, start + 12], [16, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: ease,
        });
        if (opacity <= 0) return null;
        return (
          <div key={fact.cue} style={{ opacity, translate: `0px ${rise}px` }}>
            <Card fact={fact} />
          </div>
        );
      })}
    </>
  );
};

function presence(frame: number, start: number, stop: number, hold: boolean): number {
  if (frame < start || frame >= stop) return 0;
  const fade = 12;
  if (hold || stop - start < fade * 2 + 2) {
    return interpolate(frame, [start, start + fade], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  }
  return interpolate(frame, [start, start + fade, stop - fade, stop], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

const Card: FC<{ fact: (typeof FACTS)[number] }> = ({ fact }) => {
  if (fact.layout === "center") {
    return (
      <div style={{ position: "absolute", left: 0, right: 0, top: 500, textAlign: "center" }}>
        <div style={{ fontFamily: fontSans, fontWeight: 700, fontSize: 128, letterSpacing: -3, color: color.ink }}>{fact.value}</div>
        <div style={{ fontFamily: fontSans, fontSize: 32, color: color.ink, marginTop: 8 }}>{fact.body}</div>
        <Source text={fact.source} />
      </div>
    );
  }
  if (fact.layout === "band") {
    return (
      <div
        style={{
          position: "absolute",
          left: 180,
          right: 180,
          top: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 48,
          borderTop: `1px solid ${color.rule}`,
          borderBottom: `1px solid ${color.rule}`,
          padding: "32px 8px",
        }}
      >
        <div style={{ maxWidth: 760 }}>
          <div style={{ fontFamily: fontSans, fontSize: 32, lineHeight: 1.35, color: color.ink }}>{fact.body}</div>
          <Source text={fact.source} />
        </div>
        <div style={{ fontFamily: fontSans, fontWeight: 700, fontSize: 140, color: color.ink }}>{fact.value}</div>
      </div>
    );
  }
  return (
    <div style={{ position: "absolute", left: 260, top: 500, maxWidth: 860 }}>
      <div style={{ fontFamily: fontSans, fontWeight: 700, fontSize: 104, letterSpacing: -2, color: color.ink }}>{fact.value}</div>
      <div style={{ fontFamily: fontSans, fontSize: 32, lineHeight: 1.35, color: color.ink, marginTop: 12 }}>{fact.body}</div>
      <Source text={fact.source} />
    </div>
  );
};

const Source: FC<{ text: string }> = ({ text }) => (
  <div style={{ fontFamily: fontMono, fontSize: 18, color: color.muted, marginTop: 14 }}>{text}</div>
);
