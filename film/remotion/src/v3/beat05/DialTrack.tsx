import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { LimitBar } from "../dial/LimitBar";
import { clockLabel, maxLtvAt, sessionAt, smoothedLtv, WEEKEND_START } from "../dial/session";
import { SessionDial } from "../dial/SessionDial";
import { enter, font, leave, size } from "../theme";
import { useTone } from "../tone";
import { SourceLine } from "../ui/SourceLine";
import { keyed } from "../uibeats/camera";
import { clock, DIAL, T } from "./shots";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");

/**
 * The session dial through beat 5: centre stage at Friday 07:01 ET with the time left to the weekend ticking,
 * parked in the corner while the sandbox shows, back to centre for the spin to Saturday (the page's own button
 * becomes the clock), then parked again, reading SAT 08:00 ET for the rest of the beat.
 */
export const DialTrack: FC = () => {
  const frame = useCurrentFrame();
  const tone = useTone();
  const at = (k: "x" | "y" | "size") => keyed(frame, DIAL.map(([f, p]) => [f, p[k]] as const));
  const x = at("x");
  const y = at("y");
  const px = at("size");
  const et = clock(frame);
  // Big-dial detail (hours ring and centre labels) belongs to large sizes; the corner dial gets its own tag.
  const detail = interpolate(px, [300, 440], [0, 1], clamp);
  const tag = interpolate(px, [200, 280], [1, 0], clamp) * enter(frame, 84, 16);
  const reveal = enter(frame, 0, 34);

  // Intro: time left until the weekend's CLOSED period (Fri 20:00 ET), ticking in real seconds.
  const left = Math.max(0, (WEEKEND_START - et) * 60);
  const countdown = `${pad(left / 3600)}:${pad((left % 3600) / 60)}:${pad(left % 60)}`;
  const intro = enter(frame, 16, 20) * leave(frame, 56, 14);

  // The limit bar rides with the spin.
  const bar = enter(frame, T.click + 40, 16) * leave(frame, T.settle, 14);
  const barLtv = smoothedLtv(clock, frame);

  return (
    <>
      <SessionDial etMinutes={et} size={px} x={x} y={y} reveal={reveal} hours={false} labels={false} />
      {detail > 0.001 ? (
        <SessionDial etMinutes={et} size={px} x={x} y={y} reveal={reveal} style={{ opacity: detail }} />
      ) : null}

      <div
        style={{
          position: "absolute",
          left: x - 160,
          width: 320,
          top: y + px * 0.62,
          textAlign: "center",
          opacity: tag,
        }}
      >
        <div style={{ fontFamily: font.mono, fontSize: 24, color: tone.ink, fontVariantNumeric: "tabular-nums" }}>{clockLabel(et)}</div>
        <div style={{ fontFamily: font.sans, fontWeight: 600, fontSize: 17, letterSpacing: "0.14em", color: tone.muted, marginTop: 6 }}>
          {sessionAt(et)}
        </div>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 800, textAlign: "center", opacity: intro, translate: `0px ${(1 - enter(frame, 16, 20)) * 14}px` }}>
        <div style={{ fontFamily: font.mono, fontSize: size.data, color: tone.ink, fontVariantNumeric: "tabular-nums" }}>{countdown}</div>
        <div style={{ fontFamily: font.sans, fontSize: size.label, fontWeight: 500, color: tone.muted, marginTop: 8 }}>
          until the weekend close, FRI 20:00 ET
        </div>
      </div>

      {bar > 0.001 ? (
        <div style={{ position: "absolute", inset: 0, opacity: leave(frame, T.settle, 14) }}>
          <LimitBar ltv={barLtv} value={maxLtvAt(et)} x={1170} y={290} height={420} reveal={enter(frame, T.click + 40, 16)} />
        </div>
      ) : null}
      <SourceLine
        style={{
          position: "absolute",
          left: 720 - 300,
          width: 600,
          textAlign: "center",
          top: 860,
          opacity: enter(frame, T.spin[1] - 2, 16) * leave(frame, T.settle, 12),
        }}
      >
        sandbox chain time · Sat 26 Sep 2026 12:00 UTC
      </SourceLine>
    </>
  );
};
