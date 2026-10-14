import type { FC } from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame } from "remotion";
import type { BeatProps } from "../stage";
import { beat } from "../script";
import { ToneProvider } from "../tone";
import { ScratchCaptions } from "../ui/Caption";
import { HonestyLabel } from "../ui/Chip";
import { Answer, NUMBER_AT } from "./Answer";
import { Chat } from "./Chat";
import { Entry, Field } from "./Field";
import { layout } from "./layout";
import { after, DURATION, T } from "./look";
import { Service } from "./Service";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const inOut = Easing.inOut(Easing.cubic);

/** Zoom into the number that matters as it lands, then pull back for the rows; a slow drift otherwise. */
const useCamera = () => {
  const frame = useCurrentFrame();
  const a = layout(T.answerAt + 30).answer;
  const origin = `${a.x + NUMBER_AT.x}px ${a.y + NUMBER_AT.y}px`;
  // In as the number lands; back out as the rows start (or after a short hold, if he names them straight away).
  const inAt = T.answerAt + 4;
  const held = after(inAt + 22, T.rows[0] - 10);
  const push = interpolate(frame, [inAt, inAt + 22, held, held + 24], [1, 1.14, 1.14, 1], { ...clamp, easing: inOut });
  const drift = interpolate(frame, [T.cardIn, DURATION], [1, 1.025], clamp);
  return { scale: push * drift, origin };
};

/**
 * Beat 10 · OKX AI (22 s). The energy switch: out of the film's white, a dive into OKX AI's violet, and a luminous
 * world where Intatto is agent 13907. Its registration folds into a tool an agent can use; someone asks how much
 * a wallet can borrow, the agent calls the A2MCP service, and the real answer (credit.json) lands row by row on
 * the words that name them. Real data only; the chat itself is illustrative and says so.
 */
export const Beat10: FC<BeatProps> = ({ scratchCaptions }) => {
  const frame = useCurrentFrame();
  const cam = useCamera();
  return (
    <AbsoluteFill>
      <Field />
      <AbsoluteFill style={{ scale: String(cam.scale), transformOrigin: cam.origin }}>
        <Service />
        <Chat />
        <Answer />
      </AbsoluteFill>
      <ToneProvider tone="dark">
        <Sequence from={T.dockAt} layout="none" name="Honesty line">
          <HonestyLabel kinds={["LIVE"]} from={10} text="X Layer mainnet · Illustrative chat, real API response" style={{ color: "rgba(255,255,255,0.5)" }} />
        </Sequence>
      </ToneProvider>
      <Entry />
      <ToneProvider tone={frame < T.dive + 16 ? "light" : "dark"}>
        <ScratchCaptions vo={beat(10).vo} show={scratchCaptions} />
      </ToneProvider>
    </AbsoluteFill>
  );
};
