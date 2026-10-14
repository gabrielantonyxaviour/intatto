import type { CSSProperties, FC, ReactNode } from "react";
import { font } from "../theme";
import { useTone } from "../tone";

export type OdometerProps = {
  /** The real, final value. */
  value: number;
  /** 0 → 1: how far the count has run (drive it with an eased interpolate). Lands exactly on `value` at 1. */
  progress: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  fontSize: number;
  weight?: number;
  color?: string;
  style?: CSSProperties;
};

/**
 * A counter whose digits roll like an odometer; a column rolls to its next digit while the column below carries.
 * JetBrains Mono, tabular, so nothing shifts while it counts. Prefix/suffix and separators stay still.
 */
export const Odometer: FC<OdometerProps> = ({ value, progress, decimals = 0, prefix = "", suffix = "", fontSize, weight = 500, color, style }) => {
  const tone = useTone();
  const scale = 10 ** decimals;
  const target = Math.round(value * scale);
  const now = target * Math.min(1, Math.max(0, progress));
  const digits = String(target).padStart(decimals + 1, "0");
  const n = digits.length;
  const cells: { key: string; node: ReactNode }[] = [];
  for (let i = 0; i < n; i++) {
    const place = n - 1 - i; // 0 = last digit
    // A true odometer: each column shows its digit and rolls to the next only while the column below carries.
    const unit = 10 ** place;
    // It rolls only while the very last step of the lowest column completes (…9 → …10), so it never sits half-rolled.
    const carry = place === 0 ? 0 : Math.min(1, Math.max(0, (now % unit) - (unit - 1)));
    const roll = (Math.floor(now / unit) % 10) + carry;
    // Leading zeros stay hidden until the count reaches them.
    const visible = i === n - 1 - decimals || now >= 10 ** place;
    cells.push({ key: `d${i}`, node: <Digit offset={visible ? roll : 0} hidden={!visible} /> });
    if (decimals > 0 && place === decimals) cells.push({ key: "dot", node: <span>.</span> });
  }
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        fontFamily: font.mono,
        fontWeight: weight,
        fontSize,
        lineHeight: 1,
        letterSpacing: "-0.02em",
        fontVariantNumeric: "tabular-nums",
        color: color ?? tone.ink,
        whiteSpace: "pre",
        ...style,
      }}
    >
      {prefix ? <span>{prefix}</span> : null}
      {cells.map((c) => (
        <span key={c.key} style={{ display: "inline-block" }}>
          {c.node}
        </span>
      ))}
      {suffix ? <span>{suffix}</span> : null}
    </div>
  );
};

const Digit: FC<{ offset: number; hidden: boolean }> = ({ offset, hidden }) => (
  <span style={{ display: "inline-block", height: "1em", overflow: "hidden", verticalAlign: "bottom", opacity: hidden ? 0 : 1 }}>
    <span style={{ display: "flex", flexDirection: "column", translate: `0px ${-offset}em` }}>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, i) => (
        <span key={i} style={{ height: "1em", lineHeight: 1 }}>
          {d}
        </span>
      ))}
    </span>
  </span>
);
