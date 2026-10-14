import type { CSSProperties, FC, ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import { enter, font, GREEN } from "../theme";
import { useTone } from "../tone";
import { MAINNET_CONTRACTS } from "./data";

/** World layout of the two sides (world px; the camera shows a side at zoom 1, so these sizes read 1:1 at 1080p). */
export const SIDE = { width: 1120, inner: 640, top: -300 } as const;
export const MAINNET_X = -(SIDE.inner + SIDE.width); // left edge of the mainnet side
export const FORK_X = SIDE.inner; // left edge of the fork side
/** Where the fork's week strip sits (world px): centre and width. */
export const STRIP_SLOT = { x: FORK_X + SIDE.width / 2, y: 150, width: 1000 };

const Rise: FC<{ at: number; style?: CSSProperties; children: ReactNode }> = ({ at, style, children }) => {
  const frame = useCurrentFrame();
  const k = enter(frame, at, 20);
  return <div style={{ opacity: k, translate: `0px ${(1 - k) * 16}px`, ...style }}>{children}</div>;
};

const Header: FC<{ at: number; title: string; sub: string; live?: boolean }> = ({ at, title, sub, live }) => {
  const tone = useTone();
  return (
    <Rise at={at}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: font.sans, fontWeight: 600, fontSize: 48, letterSpacing: "-0.03em", color: tone.ink }}>
        {live ? <span style={{ width: 16, height: 16, borderRadius: 8, background: GREEN, flex: "none" }} /> : null}
        {title}
      </div>
      <div style={{ fontFamily: font.mono, fontSize: 24, color: tone.muted, marginTop: 10 }}>{sub}</div>
    </Rise>
  );
};

/** Left: Intatto on X Layer mainnet, its contracts (deployments/xlayer-mainnet.json) and the live borrow. */
export const MainnetSide: FC<{ at: number }> = ({ at }) => {
  const tone = useTone();
  return (
    <div style={{ position: "absolute", left: MAINNET_X, top: SIDE.top, width: SIDE.width }}>
      <Header at={at} title="X Layer mainnet" sub="chain 196 · deployed at block 71,562,056" live />
      <div style={{ marginTop: 34, borderTop: `2px solid ${tone.hairline}` }}>
        {MAINNET_CONTRACTS.map((c, i) => (
          <Rise key={c.name} at={at + 10 + i * 5} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", height: 64, borderBottom: `1.5px solid ${tone.hairline}`, paddingTop: 14, boxSizing: "border-box" }}>
            <span style={{ fontFamily: font.sans, fontSize: 28, fontWeight: 500, color: tone.muted }}>{c.name}</span>
            <span style={{ fontFamily: font.mono, fontSize: 36, color: tone.ink }}>{c.short}</span>
          </Rise>
        ))}
      </div>
      <Rise at={at + 36} style={{ marginTop: 34 }}>
        <div style={{ fontFamily: font.sans, fontSize: 28, fontWeight: 500, color: tone.muted }}>Live borrow · 0x7F23…a415</div>
        <div style={{ fontFamily: font.mono, fontSize: 40, color: tone.ink, marginTop: 8 }}>0.0048 NVDAx → 0.40 USDG</div>
        <div style={{ fontFamily: font.mono, fontSize: 24, color: tone.muted, marginTop: 8 }}>tx 0xa933…0f45 · block 71,562,308</div>
      </Rise>
    </div>
  );
};

/** Right: the sandbox fork, forked at block 71,563,431 on chain 1960196; its week strip is drawn by the scene. */
export const ForkSide: FC<{ at: number; url: number }> = ({ at, url }) => {
  const tone = useTone();
  return (
    <div style={{ position: "absolute", left: FORK_X, top: SIDE.top, width: SIDE.width }}>
      <Header at={at} title="Fork of X Layer mainnet" sub="chain 1960196 · same contracts, same state" />
      <Rise at={at + 10} style={{ marginTop: 34, paddingTop: 20, borderTop: `2px solid ${tone.hairline}` }}>
        <div style={{ fontFamily: font.sans, fontSize: 28, fontWeight: 500, color: tone.muted }}>Forked at block</div>
        <div style={{ fontFamily: font.mono, fontSize: 96, lineHeight: 1.1, letterSpacing: "-0.02em", color: tone.ink }}>71,563,431</div>
      </Rise>
      <Rise at={url} style={{ position: "absolute", top: 560, fontFamily: font.mono, fontSize: 28, color: tone.muted }}>
        intatto.larinova.com/sandbox
      </Rise>
    </div>
  );
};
