import { Video } from "@remotion/media";
import type { FC } from "react";
import { Easing, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { TimedSegment } from "../lib/timeline";
import { FRAME, color, fontMono, frameHeight, frameLeft, frameWidth } from "../theme";

const ENTER = 14;

const activeAt = (segments: TimedSegment[], frame: number) =>
  segments.find((seg) => frame >= seg.startFrame && frame < seg.endFrame) ?? segments[0];

export const BrowserFrame: FC<{
  segments: TimedSegment[];
  enterAt: number;
  sceneFrames: number;
}> = ({ segments, enterAt, sceneFrames }) => {
  const frame = useCurrentFrame();
  if (frame < enterAt || !segments.length) return null;
  const enter = interpolate(frame, [enterAt, enterAt + ENTER], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const settle = interpolate(frame, [enterAt, enterAt + ENTER], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const push = interpolate(frame, [enterAt, Math.max(enterAt + 1, sceneFrames - 1)], [1, 1.02], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const active = activeAt(segments, frame);
  return (
    <div
      style={{
        position: "absolute",
        left: frameLeft,
        top: FRAME.top,
        width: frameWidth,
        height: FRAME.chrome + frameHeight,
        opacity: enter,
        translate: `0px ${settle}px`,
        scale: push,
        borderRadius: FRAME.radius,
        overflow: "hidden",
        background: color.white,
        boxShadow: "0 18px 50px rgba(18,18,18,0.12)",
      }}
    >
      <Chrome url={active?.url ?? ""} />
      <div style={{ position: "relative", width: frameWidth, height: frameHeight, overflow: "hidden", background: color.bg }}>
        {segments.map((seg) => (
          <Sequence key={seg.index} from={seg.sequenceFrom} durationInFrames={seg.sequenceDur} layout="none">
            <Clip seg={seg} />
          </Sequence>
        ))}
        {active && active.rate > 1 ? <RateChip rate={active.rate} /> : null}
      </div>
    </div>
  );
};

const Chrome: FC<{ url: string }> = ({ url }) => (
  <div
    style={{
      height: FRAME.chrome,
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "0 14px",
      background: color.bg,
      borderBottom: `1px solid ${color.rule}`,
    }}
  >
    {[0, 1, 2].map((dot) => (
      <span key={dot} style={{ width: 10, height: 10, borderRadius: 5, background: color.dot }} />
    ))}
    <div
      style={{
        marginLeft: 10,
        maxWidth: 980,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontFamily: fontMono,
        fontSize: 14,
        color: color.muted,
        background: color.white,
        border: `1px solid ${color.rule}`,
        borderRadius: 11,
        padding: "3px 12px",
      }}
    >
      {url}
    </div>
  </div>
);

const Clip: FC<{ seg: TimedSegment }> = ({ seg }) => {
  const local = useCurrentFrame();
  const opacity = clipOpacity(local, seg);
  const view = zoomAt(local, seg);
  const scale = FRAME.scale * view.z;
  if (seg.placeholder) return <Placeholder take={seg.take} mark={seg.mark} opacity={opacity} />;
  return (
    <div style={{ position: "absolute", inset: 0, opacity }}>
      <Video
        src={staticFile(seg.src)}
        trimBefore={seg.trimBefore}
        playbackRate={seg.rate}
        muted
        objectFit="cover"
        style={{
          position: "absolute",
          left: frameWidth / 2 - view.cx * scale,
          top: frameHeight / 2 - view.cy * scale,
          width: FRAME.videoW * scale,
          height: FRAME.videoH * scale,
        }}
      />
    </div>
  );
};

function clipOpacity(local: number, seg: TimedSegment): number {
  const fade = 4;
  const points = [0];
  const values = [seg.fadeIn > 0 ? 0 : 1];
  if (seg.fadeIn > 0) {
    points.push(fade);
    values.push(1);
  }
  if (seg.fadeOut && seg.sequenceDur > points[points.length - 1] + fade) {
    points.push(seg.sequenceDur - fade, seg.sequenceDur);
    values.push(1, 0);
  }
  if (points.length < 2) return values[0];
  return interpolate(local, points, values, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

function zoomAt(local: number, seg: TimedSegment): { z: number; cx: number; cy: number } {
  const cx0 = FRAME.videoW / 2;
  const cy0 = FRAME.videoH / 2;
  const focus = seg.focus;
  if (!focus || seg.sequenceDur < 36) return { z: 1, cx: cx0, cy: cy0 };
  const z = Math.min(1.25, focus.zoom);
  const inn = 18;
  const out = seg.sequenceDur - 18;
  if (out <= inn) return { z: 1, cx: cx0, cy: cy0 };
  const ease = Easing.inOut(Easing.cubic);
  const range = [0, inn, out, seg.sequenceDur - 1];
  return {
    z: interpolate(local, range, [1, z, z, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease }),
    cx: interpolate(local, range, [cx0, focus.x + focus.w / 2, focus.x + focus.w / 2, cx0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: ease,
    }),
    cy: interpolate(local, range, [cy0, focus.y + focus.h / 2, focus.y + focus.h / 2, cy0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: ease,
    }),
  };
}

const Placeholder: FC<{ take: string; mark: string; opacity: number }> = ({ take, mark, opacity }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      opacity,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: color.bg,
    }}
  >
    <div
      style={{
        border: `2px dashed ${color.ink}`,
        borderRadius: 12,
        padding: "28px 40px",
        textAlign: "center",
        fontFamily: fontMono,
        color: color.ink,
      }}
    >
      <div style={{ fontSize: 18, letterSpacing: 2, color: color.muted }}>TO RECORD</div>
      <div style={{ fontSize: 32, marginTop: 10 }}>
        {take} · {mark}
      </div>
    </div>
  </div>
);

const RateChip: FC<{ rate: number }> = ({ rate }) => (
  <div
    style={{
      position: "absolute",
      right: 16,
      bottom: 16,
      fontFamily: fontMono,
      fontSize: 18,
      color: color.white,
      background: "rgba(18,18,18,0.72)",
      borderRadius: 6,
      padding: "4px 10px",
    }}
  >
    ×{rate}
  </div>
);
