import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ease, enter, font } from "../theme";
import { useTone } from "../tone";
import { Odometer } from "../ui/Odometer";
import { SourceLine } from "../ui/SourceLine";
import { TRACK, type Timeline } from "./track";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const RULE_Y = TRACK.a;
const RULE_W = 760;

/**
 * Shot B. The token's 24/7 line (same place, same weight) contracts into the rule under ~$91.5M; on "you can't
 * borrow against any of it" the number goes inert and "Nowhere to borrow against it" lands with its source.
 */
export const Supply: FC<{ t: Timeline }> = ({ t }) => {
  const frame = useCurrentFrame();
  const tone = useTone();
  if (frame < t.money - 2) return null;
  const c = interpolate(frame, [t.money - 2, t.money + 30], [0, 1], { ...clamp, easing: ease.inOut });
  const inert = enter(frame, t.cant, 22);
  const numK = enter(frame, t.money + 10, 20);
  const labelK = enter(frame, t.money + 26, 18);
  const srcK = enter(frame, t.money + 36, 18);
  const noK = enter(frame, t.cant + 10, 20);
  const noSrcK = enter(frame, t.cant + 22, 18);
  const ink = `color-mix(in srgb, ${tone.ink} ${100 - inert * 62}%, ${tone.bg})`;
  const left = interpolate(c, [0, 1], [TRACK.x0, 960 - RULE_W / 2]);
  const width = interpolate(c, [0, 1], [TRACK.width, RULE_W]);
  const thick = interpolate(c, [0, 1], [14, 5]) * interpolate(inert, [0, 1], [1, 0.4]);
  return (
    <>
      <div style={{ position: "absolute", left, width, top: RULE_Y - thick / 2, height: thick, background: ink }} />
      <div
        style={{
          position: "absolute",
          left: 960,
          top: RULE_Y - 36,
          translate: `-50% ${-100 + (1 - numK) * 18}%`,
          opacity: numK,
        }}
      >
        <Odometer
          value={91.5}
          decimals={1}
          prefix="~$"
          suffix="M"
          fontSize={176}
          color={ink}
          progress={interpolate(frame, [t.money + 8, t.money + 62], [0, 1], { ...clamp, easing: ease.out })}
        />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: RULE_Y + 30, textAlign: "center" }}>
        <div
          style={{
            fontFamily: font.sans,
            fontWeight: 500,
            fontSize: 40,
            letterSpacing: "-0.01em",
            color: ink,
            opacity: labelK,
            translate: `0px ${(1 - labelK) * 14}px`,
          }}
        >
          of tokenized stocks on X Layer
        </div>
        <SourceLine style={{ marginTop: 12, opacity: srcK }}>Crypto Briefing · 12 Sep 2026</SourceLine>
        <div
          style={{
            marginTop: 64,
            fontFamily: font.sans,
            fontWeight: 600,
            fontSize: 52,
            letterSpacing: "-0.02em",
            color: tone.ink,
            opacity: noK,
            translate: `0px ${(1 - noK) * 22}px`,
          }}
        >
          Nowhere to borrow against it
        </div>
        <SourceLine style={{ marginTop: 14, opacity: noSrcK }}>
          Aave on X Layer · getReservesList: 11 assets, 0 stocks · 25 Sep 2026
        </SourceLine>
      </div>
    </>
  );
};
