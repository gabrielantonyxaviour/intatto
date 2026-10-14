import type { FC } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { color, fontMono, fontSans } from "../theme";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_W = 132;
const GAP = 12;
const BAR = 52;
const CHART_W = DAYS.length * DAY_W + (DAYS.length - 1) * GAP;
const SAT_X = 5 * (DAY_W + GAP) + DAY_W / 2;

const ease = Easing.bezier(0.16, 1, 0.3, 1);

export const WeekChart: FC = () => {
  const frame = useCurrentFrame();
  const daysIn = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const bar = interpolate(frame, [16, 36], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const play = interpolate(frame, [32, 46], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return (
    <div style={{ position: "relative", width: CHART_W, height: 250 }}>
      <div
        style={{
          position: "absolute",
          left: SAT_X - 1,
          top: interpolate(play, [0, 1], [8, 0]),
          width: 2,
          height: 214,
          background: color.ink,
          opacity: play,
        }}
      />
      <div style={{ display: "flex", gap: GAP, opacity: daysIn }}>
        {DAYS.map((day) => (
          <div key={day} style={{ width: DAY_W, textAlign: "center", fontFamily: fontMono, fontSize: 16, color: color.muted }}>
            {day}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, fontFamily: fontSans, fontSize: 22, color: color.ink }}>NVDA · Nasdaq</div>
      <div style={{ marginTop: 8, display: "flex", gap: GAP }}>
        {DAYS.slice(0, 5).map((day, index) => {
          const shown = interpolate(frame, [8 + index * 3, 18 + index * 3], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: ease,
          });
          return (
            <div
              key={day}
              style={{
                width: DAY_W,
                height: BAR,
                borderRadius: 6,
                background: color.ink,
                opacity: shown,
                translate: `0px ${interpolate(shown, [0, 1], [10, 0])}px`,
              }}
            />
          );
        })}
        <div
          style={{
            width: DAY_W * 2 + GAP,
            height: BAR,
            borderRadius: 6,
            border: `1.5px solid ${color.rule}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: fontSans,
            fontSize: 20,
            color: color.muted,
            opacity: interpolate(frame, [24, 36], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          Closed
        </div>
      </div>
      <div style={{ marginTop: 22, fontFamily: fontSans, fontSize: 22, color: color.ink }}>NVDAx · X Layer</div>
      <div style={{ marginTop: 8, position: "relative", height: BAR }}>
        <div
          style={{
            width: CHART_W * bar,
            height: BAR,
            borderRadius: 6,
            background: color.ink,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: fontSans,
            fontSize: 20,
            color: color.bg,
            opacity: interpolate(frame, [34, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          Trades onchain, 24/7
        </div>
      </div>
    </div>
  );
};
