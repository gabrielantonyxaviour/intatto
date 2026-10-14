import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ease, enter, font, GREEN } from "../theme";
import { useTone } from "../tone";
import { midTrim } from "../datakit/format";
import mainnet from "../../../../../deployments/xlayer-mainnet.json";
import fork from "../../motion/data/session-public.json";
import { T, TILE } from "./timeline";

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const market = (list: { symbol: string; market: string }[], s: string) => list.find((m) => m.symbol === s)!.market;

type TileProps = { i: number; at: number; symbol?: string; address?: string; where?: string; whereAt?: number; live?: boolean };

/** One market: its own contract in its own box, drawn on as a closed border. No symbol: the next stock, dashed. */
const Tile: FC<TileProps> = ({ i, at, symbol, address, where, whereAt, live }) => {
  const f = useCurrentFrame();
  const tone = useTone();
  const border = interpolate(f, [at, at + 24], [0, 1], { ...c, easing: ease.inOut });
  const body = enter(f, at + 10, 18);
  const place = whereAt === undefined ? body : enter(f, whereAt, 18);
  return (
    <div style={{ position: "absolute", left: TILE.xs[i], top: TILE.y, width: TILE.w, height: TILE.h }}>
      <svg width={TILE.w} height={TILE.h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {symbol ? (
          <rect x={1.25} y={1.25} width={TILE.w - 2.5} height={TILE.h - 2.5} rx={20} fill="none" stroke={tone.ink} strokeWidth={2.5} pathLength={1} strokeDasharray={`${border} 1`} />
        ) : (
          <rect x={1} y={1} width={TILE.w - 2} height={TILE.h - 2} rx={20} fill="none" stroke={tone.muted} strokeWidth={2} strokeDasharray="10 10" strokeDashoffset={-f * 0.6} opacity={border} />
        )}
      </svg>
      {symbol ? (
        <div style={{ position: "absolute", left: 32, top: 32, right: 32, opacity: body, translate: `0px ${(1 - body) * 12}px` }}>
          <div style={{ fontFamily: font.sans, fontSize: 60, fontWeight: 700, letterSpacing: "-0.035em", color: tone.ink, lineHeight: 1 }}>{symbol}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 28, fontFamily: font.mono, fontSize: 21, color: tone.ink, opacity: place, whiteSpace: "nowrap" }}>
            {live ? <span style={{ width: 10, height: 10, borderRadius: 5, background: GREEN }} /> : null}
            {where}
          </div>
          <div style={{ fontFamily: font.mono, fontSize: 20, color: tone.muted, marginTop: 10 }}>market {midTrim(address ?? "", 6, 4)}</div>
        </div>
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, opacity: body,
          fontFamily: font.sans, fontSize: 26, fontWeight: 500, color: tone.muted, textAlign: "center" }}>
          <div>next stock</div>
          <div style={{ fontFamily: font.mono, fontSize: 20 }}>one deployment away</div>
        </div>
      )}
    </div>
  );
};

/** NVDAx and SPYx on the fork, the next stock one deployment away, and NVDAx live on mainnet. */
export const Tiles: FC = () => (
  <>
    <Tile i={0} at={T.tiles} symbol="NVDAx" address={market(fork.deployment.markets, "NVDAx")} where="Fork of X Layer mainnet" whereAt={T.fork} />
    <Tile i={1} at={T.tiles + 8} symbol="SPYx" address={market(fork.deployment.markets, "SPYx")} where="Fork of X Layer mainnet" whereAt={T.fork + 6} />
    <Tile i={2} at={T.mainnet} symbol="NVDAx" address={market(mainnet.markets, "NVDAx")} where="X Layer mainnet" live />
    <Tile i={3} at={T.next} />
  </>
);
