import type { FC, ReactNode } from "react";

/**
 * A recorded page (laid out at 1440×900 CSS px) seen through a `width`×`height` window with a camera: zoom ≥ 1
 * about `focus` (page px). No browser chrome: use it inside the WeekTimeline Dive, which is already the window.
 * The page edge never shows (same clamp as FloatingFrame). Frame the sandbox banner out by keeping the top edge
 * below it: top = focus.y − 450 / zoom.
 */
export const PageCam: FC<{
  width: number;
  height: number;
  zoom: number;
  focus: { x: number; y: number };
  contentWidth?: number;
  contentHeight?: number;
  children: ReactNode;
}> = ({ width, height, zoom, focus, contentWidth = 1440, contentHeight = 900, children }) => {
  const s = (width / contentWidth) * Math.max(1, zoom);
  const left = Math.min(0, Math.max(width - contentWidth * s, width / 2 - focus.x * s));
  const top = Math.min(0, Math.max(height - contentHeight * s, height / 2 - focus.y * s));
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#FFFFFF" }}>
      <div style={{ position: "absolute", left, top, width: contentWidth, height: contentHeight, transformOrigin: "0 0", scale: String(s) }}>
        {children}
      </div>
    </div>
  );
};

/** Screen-space position (inside the window) of a page point, for overlays that live outside the page. */
export const pageToWindow = (width: number, height: number, zoom: number, focus: { x: number; y: number }, p: { x: number; y: number }) => {
  const s = (width / 1440) * Math.max(1, zoom);
  const left = Math.min(0, Math.max(width - 1440 * s, width / 2 - focus.x * s));
  const top = Math.min(0, Math.max(height - 900 * s, height / 2 - focus.y * s));
  return { x: left + p.x * s, y: top + p.y * s, scale: s };
};
