import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ease, enter, font } from "../theme";
import { useTone } from "../tone";
import credit from "../../motion/data/credit.json";
import { G, T } from "./timeline";

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const W = credit.payload.wallet;
/** okx-ai/README.md "Paid mode (x402)": amount 10000 USDG units (0.01 USDG), exact scheme, eip155:196. Not wired. */
const PRICE_USDG = 10000 / 1e6;

/**
 * The trunk of the split becomes an agent's request to the credit API; the answer is an x402 challenge (HTTP 402,
 * 0.01 USDG per query in USDG on X Layer). Paid mode is built and tested, and switched off: queries are free today.
 */
export const X402: FC = () => {
  const f = useCurrentFrame();
  const tone = useTone();
  const line = interpolate(f, [T.request[0] + 2, T.request[1]], [0, 1], { ...c, easing: ease.inOut });
  const req = interpolate(f, [T.request[0] + 6, T.challenge - 2], [0, 1], { ...c, easing: ease.inOut });
  const reqK = interpolate(f, [T.request[0] + 6, T.request[0] + 14, T.challenge - 6, T.challenge], [0, 1, 1, 0], c);
  const card = enter(f, T.challenge, 20);
  const sw = enter(f, T.off, 20);
  const out = interpolate(f, [T.tiles - 14, T.tiles + 2], [1, 0], c);
  const ends = enter(f, T.request[0] + 2, 18);
  if (f < T.request[0] - 2 || out <= 0) return null;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: out }}>
      <div style={{ position: "absolute", left: G.source.x, top: G.source.y - 1, width: (G.upper.x - G.source.x) * line, height: 2, background: tone.ink }} />
      <div style={{ position: "absolute", left: G.source.x - 40, top: G.source.y - 96, opacity: ends, fontFamily: font.sans, fontSize: 30, fontWeight: 600, color: tone.ink, letterSpacing: "-0.02em" }}>
        An agent
      </div>
      <div style={{ position: "absolute", left: G.upper.x, top: G.source.y - 96, translate: "-100% 0px", opacity: ends, fontFamily: font.sans, fontSize: 30, fontWeight: 600, color: tone.ink, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
        Intatto credit API
      </div>
      <div style={{ position: "absolute", left: G.source.x + (G.upper.x - G.source.x - 460) * req, top: G.source.y - 26, height: 52, padding: "0 22px", display: "flex", alignItems: "center",
        borderRadius: 26, border: `2px solid ${tone.ink}`, background: tone.bg, opacity: reqK, fontFamily: font.mono, fontSize: 22, color: tone.ink, whiteSpace: "nowrap" }}>
        GET /api/credit · {W.slice(0, 6)}…{W.slice(-4)}
      </div>

      <div style={{ position: "absolute", left: (G.source.x + G.upper.x) / 2, top: G.source.y + 60, translate: `-50% ${(1 - card) * 18}px`, opacity: card, textAlign: "center", whiteSpace: "nowrap" }}>
        <div style={{ fontFamily: font.mono, fontSize: 56, color: tone.ink, letterSpacing: "-0.02em" }}>402 Payment Required</div>
        <div style={{ fontFamily: font.sans, fontSize: 30, fontWeight: 500, color: tone.ink, marginTop: 12 }}>{PRICE_USDG.toFixed(2)} USDG per query, paid with x402</div>
      </div>

      <div style={{ position: "absolute", left: (G.source.x + G.upper.x) / 2, top: G.source.y + 250, translate: `-50% ${(1 - sw) * 14}px`, opacity: sw, display: "flex", alignItems: "center", gap: 18, whiteSpace: "nowrap" }}>
        <div style={{ width: 76, height: 40, borderRadius: 20, background: tone.hairline, position: "relative" }}>
          <div style={{ position: "absolute", left: 4, top: 4, width: 32, height: 32, borderRadius: 16, background: tone.bg, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }} />
        </div>
        <div style={{ fontFamily: font.sans, fontSize: 28, fontWeight: 500, color: tone.muted }}>Paid mode is built and switched off: queries are free today</div>
      </div>
    </div>
  );
};
