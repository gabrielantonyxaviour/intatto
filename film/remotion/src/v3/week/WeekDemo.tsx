import type { FC } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { et, keyedClock } from "../dial/session";
import { font } from "../theme";
import { useTone } from "../tone";
import { keyedCamera, WEEK_VIEW, xOf } from "./camera";
import { Dive } from "./Dive";
import { SessionFlips } from "./SessionFlips";
import { WeekTimeline } from "./WeekTimeline";

/**
 * Reference usage of the WeekTimeline system (composition "WeekDemo", folder dev): the week, the clock runs to
 * Friday afternoon, we dive into that moment and pull back, the clock runs past Fri 20:00 (black), we dive into
 * Saturday. Beats 5–7 do the same with real screens in the Dive.
 */
const STRIP_Y = 540;
const FRI = et(4, 14, 30);
const SAT = et(5, 11, 0);

const clock = keyedClock([
  [0, et(0, 9, 30)],
  [20, et(0, 9, 30)],
  [70, FRI],
  [170, FRI],
  [220, SAT],
]);
const camera = keyedCamera([
  [0, WEEK_VIEW],
  [70, WEEK_VIEW],
  [84, { focus: FRI, zoom: 1.6 }],
  [112, { focus: FRI, zoom: 45 }],
  [132, { focus: FRI, zoom: 45 }],
  [164, WEEK_VIEW],
  [225, WEEK_VIEW],
  [238, { focus: SAT, zoom: 1.6 }],
  [266, { focus: SAT, zoom: 45 }],
]);
const dive = (f: number) =>
  Math.max(
    interpolate(f, [94, 116, 130, 152], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(f, [248, 270], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );

export const WeekDemo: FC = () => {
  const frame = useCurrentFrame();
  const playheadAt = (f: number) => ({ x: xOf(clock(f), camera(f)), y: STRIP_Y });
  return (
    <SessionFlips clock={clock} from={0} to={300} origin={playheadAt}>
      <AbsoluteFill>
        <WeekTimeline
          camera={camera(frame)}
          y={STRIP_Y}
          playhead={clock(frame)}
          reveal={interpolate(frame, [0, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
          style={{ opacity: interpolate(dive(frame), [0.3, 0.8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}
        />
        <Dive progress={dive(frame)} anchor={playheadAt(frame)} target={{ x: 960, y: 540, width: 1440, height: 900 }}>
          <Screen label={frame < 200 ? "Friday 14:30 ET · the Borrow screen" : "Saturday 11:00 ET · the Borrow screen"} />
        </Dive>
      </AbsoluteFill>
    </SessionFlips>
  );
};

const Screen: FC<{ label: string }> = ({ label }) => {
  const tone = useTone();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", border: `2px dashed ${tone.hairline}` }}>
      <div style={{ fontFamily: font.mono, fontSize: 32, color: tone.muted }}>{label}</div>
    </AbsoluteFill>
  );
};
