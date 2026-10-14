import type { FC } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ease, enter, font } from "../theme";
import { useTone } from "../tone";
import { T } from "./timeline";

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** contracts/src/ChainlinkV10Adapter.sol: the v10 (tokenized asset) report fields it reads, and the verifier proxy. */
const FIELDS = [
  { name: "price", type: "int192" },
  { name: "marketStatus", type: "uint32", note: "2 = market open" },
  { name: "currentMultiplier", type: "int192", note: "splits and dividends" },
  { name: "newMultiplier", type: "int192" },
  { name: "activationDateTime", type: "uint32" },
  { name: "expiresAt", type: "uint32" },
] as const;
const VERIFIER = "0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7";

/**
 * Inside one keeper post: the production path. A Chainlink Data Streams report (v10, tokenized assets) whose
 * signature the X Layer verifier proxy checks onchain before its price is used. Built and unit-tested; not live.
 * On the wash ground, so the post visibly grows into a disc and shrinks back.
 */
export const Report: FC = () => {
  const f = useCurrentFrame();
  const tone = useTone();
  const t0 = T.report;
  const head = enter(f, t0, 20);
  const sub = enter(f, t0 + 8, 20);
  const flow = interpolate(f, [T.verify - 30, T.verify], [0, 1], { ...c, easing: ease.inOut });
  return (
    <AbsoluteFill style={{ background: tone.wash }}>
      <div style={{ position: "absolute", left: 200, top: 250, opacity: head, translate: `0px ${(1 - head) * 20}px` }}>
        <div style={{ fontFamily: font.mono, fontSize: 22, letterSpacing: "0.04em", color: tone.muted }}>FOR PRODUCTION</div>
        <div style={{ fontFamily: font.sans, fontSize: 72, fontWeight: 700, letterSpacing: "-0.035em", color: tone.ink, marginTop: 14, lineHeight: 1.02 }}>
          Chainlink<br />Data Streams
        </div>
        <div style={{ fontFamily: font.sans, fontSize: 28, fontWeight: 500, color: tone.muted, marginTop: 20, opacity: sub }}>
          Tokenized-asset report, schema v10
        </div>
      </div>

      <div style={{ position: "absolute", left: 1000, top: 244, width: 720 }}>
        {FIELDS.map((r, i) => {
          const k = enter(f, t0 + 16 + i * 6, 18);
          return (
            <div key={r.name} style={{ display: "flex", alignItems: "baseline", gap: 20, height: 62, borderBottom: `1.5px solid ${tone.hairline}`,
              opacity: k, translate: `${(1 - k) * 24}px 0px` }}>
              <span style={{ fontFamily: font.mono, fontSize: 28, color: tone.ink, width: 330 }}>{r.name}</span>
              <span style={{ fontFamily: font.mono, fontSize: 22, color: tone.muted, width: 110 }}>{r.type}</span>
              {"note" in r ? <span style={{ fontFamily: font.sans, fontSize: 22, color: tone.muted }}>{r.note}</span> : null}
            </div>
          );
        })}
      </div>

      {/* the report goes through the verifier proxy on X Layer before its price counts */}
      <div style={{ position: "absolute", left: 1000, top: 700, width: 720, height: 2, background: tone.hairline }}>
        <div style={{ width: `${flow * 100}%`, height: 2, background: tone.ink }} />
      </div>
      <div style={{ position: "absolute", left: 1000, top: 724, opacity: enter(f, T.verify - 34, 18) }}>
        <div>
          <div style={{ fontFamily: font.sans, fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em", color: tone.ink }}>Checks the report signature onchain</div>
          <div style={{ fontFamily: font.mono, fontSize: 20, color: tone.muted, marginTop: 4 }}>
            via VerifierProxy · X Layer mainnet · {VERIFIER.slice(0, 6)}…{VERIFIER.slice(-4)}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
