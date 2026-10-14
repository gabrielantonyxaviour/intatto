import type { CSSProperties, FC, ReactNode } from "react";
import { font } from "../theme";
import { useTone } from "../tone";

export type FloatingFrameProps = {
  /** Centre of the frame in frame px. */
  x: number;
  y: number;
  /** Displayed width of the page area in px (the chrome bar sits above it). */
  width: number;
  /** The recorded page size; children are laid out at this size and scaled to fit. */
  contentWidth?: number;
  contentHeight?: number;
  /** Address bar text, e.g. "intatto.larinova.com/borrow". Omit to hide the address pill. */
  url?: string;
  /** Camera zoom into the page, ≥ 1, about `focus` (content px). The page always covers the viewport. */
  zoom?: number;
  focus?: { x: number; y: number };
  /** Slight 3D tilt in degrees. Keep small (≤ 6). */
  tiltX?: number;
  tiltY?: number;
  style?: CSSProperties;
  children: ReactNode;
};

const BAR = 44;

/** A glass-quiet browser window holding footage or any page-sized child. Neutral chrome: no decorative colour. */
export const FloatingFrame: FC<FloatingFrameProps> = ({
  x,
  y,
  width,
  contentWidth = 1440,
  contentHeight = 900,
  url,
  zoom = 1,
  focus,
  tiltX = 0,
  tiltY = 0,
  style,
  children,
}) => {
  const tone = useTone();
  const dark = tone.name === "dark";
  const fit = width / contentWidth;
  const height = contentHeight * fit;
  const s = fit * Math.max(1, zoom);
  const fx = focus?.x ?? contentWidth / 2;
  const fy = focus?.y ?? contentHeight / 2;
  // Put the focus point at the viewport centre, then clamp so the page edge never shows.
  const left = Math.min(0, Math.max(width - contentWidth * s, width / 2 - fx * s));
  const top = Math.min(0, Math.max(height - contentHeight * s, height / 2 - fy * s));
  return (
    <div
      style={{
        position: "absolute",
        left: x - width / 2,
        top: y - (height + BAR) / 2,
        width,
        height: height + BAR,
        borderRadius: 14,
        overflow: "hidden",
        background: tone.bg,
        border: `1px solid ${dark ? "#2E2E2E" : "#E5E5E5"}`,
        boxShadow: dark
          ? "0 40px 100px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.02)"
          : "0 40px 100px rgba(10,10,10,0.14), 0 6px 18px rgba(10,10,10,0.06)",
        transform: tiltX || tiltY ? `perspective(2400px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)` : undefined,
        ...style,
      }}
    >
      <div
        style={{
          height: BAR,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 16px",
          boxSizing: "border-box",
          borderBottom: `1px solid ${tone.hairline}`,
          background: dark ? "#111111" : "#FAFAFA",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 12, height: 12, borderRadius: 6, background: dark ? "#3A3A3A" : "#D4D4D4" }} />
        ))}
        {url ? (
          <div
            style={{
              margin: "0 auto",
              minWidth: 360,
              maxWidth: width * 0.55,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 16px",
              borderRadius: 7,
              background: dark ? "#1A1A1A" : "#F0F0F0",
              fontFamily: font.mono,
              fontSize: 15,
              color: tone.muted,
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            {url}
          </div>
        ) : null}
      </div>
      <div style={{ position: "relative", width, height, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            left,
            top,
            width: contentWidth,
            height: contentHeight,
            transformOrigin: "0 0",
            scale: String(s),
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
