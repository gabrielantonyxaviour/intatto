import type { FC } from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { enter, font } from "../theme";
import { AI, T } from "./look";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** One soft light that drifts on a slow orbit. Positions in % of the frame. */
const Light: FC<{ x: number; y: number; r: number; color: string; phase: number; alpha: number }> = ({ x, y, r, color, phase, alpha }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const dx = Math.sin(t * 0.35 + phase) * 4;
  const dy = Math.cos(t * 0.28 + phase * 1.3) * 3;
  return (
    <div
      style={{
        position: "absolute",
        left: `${x + dx}%`,
        top: `${y + dy}%`,
        width: r,
        height: r,
        translate: "-50% -50%",
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, transparent 68%)`,
        opacity: alpha,
      }}
    />
  );
};

/** Film grain: one fixed fractal-noise tile, nudged every other frame so it breathes without flicker. */
const Grain: FC = () => {
  const frame = useCurrentFrame();
  const step = Math.floor(frame / 2) % 7;
  return (
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.07, mixBlendMode: "overlay" }}>
      <filter id="b10grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={step} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#b10grain)" />
    </svg>
  );
};

/**
 * The luminous ground the chat lives on: deep indigo, a violet core and a cool blue edge light, drifting slowly.
 * `lift` brightens the core during the first seconds after the dive and settles as the chat takes over.
 */
export const Field: FC = () => {
  const frame = useCurrentFrame();
  const lift = interpolate(frame, [T.dive + 24, T.dive + 90], [1, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: AI.ground, overflow: "hidden" }}>
      <Light x={50} y={46} r={1500 + lift * 500} color={AI.violet} phase={0} alpha={0.55 + lift * 0.4} />
      <Light x={18} y={82} r={1100} color={AI.blue} phase={1.7} alpha={0.42} />
      <Light x={86} y={16} r={900} color={AI.rose} phase={3.1} alpha={0.2} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(4,3,14,0.7) 100%)" }} />
      <Grain />
    </AbsoluteFill>
  );
};

const ICON = 168;

/**
 * The energy switch. The film's white holds for a breath while OKX AI's app icon lands; on "OKX AI" the camera
 * dives into the icon's violet, which then cools into the luminous ground. The icon is only ever scaled uniformly.
 */
export const Entry: FC = () => {
  const frame = useCurrentFrame();
  if (frame > T.dive + 60) return null;
  const k = enter(frame, T.iconIn, 22);
  const push = interpolate(frame, [0, T.dive], [1, 1.05], clamp);
  const dive = interpolate(frame, [T.dive, T.dive + 18], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const scale = push * (1 + dive * 36);
  const flood = interpolate(frame, [T.dive + 10, T.dive + 17], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const cool = interpolate(frame, [T.dive + 18, T.dive + 50], [1, 0], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const white = frame < T.dive + 18;
  const label = enter(frame, T.iconIn + 10, 20) * interpolate(frame, [T.dive - 6, T.dive + 4], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {white && (
        <AbsoluteFill style={{ background: "#FFFFFF" }}>
          <div
            style={{
              position: "absolute",
              left: 960 - ICON / 2,
              top: 470 - ICON / 2,
              width: ICON,
              height: ICON,
              opacity: k,
              scale: String(scale * (0.92 + k * 0.08)),
              // Dive toward the violet between the top squares, so the marks slide off-frame as we pass through.
              transformOrigin: "50% 26%",
              filter: dive > 0.05 ? `blur(${dive * 1.5}px)` : undefined,
            }}
          >
            <Img src={staticFile("brand/okx-ai-app-icon.png")} style={{ width: ICON, height: ICON, display: "block" }} />
          </div>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 470 + ICON / 2 + 36,
              textAlign: "center",
              fontFamily: font.mono,
              fontSize: 26,
              letterSpacing: "0.16em",
              color: "#0A0A0A",
              opacity: label,
              translate: `0px ${(1 - enter(frame, T.iconIn + 10, 20)) * 18}px`,
            }}
          >
            OKX AI
          </div>
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: AI.violet, opacity: white ? flood : cool }} />
    </AbsoluteFill>
  );
};
