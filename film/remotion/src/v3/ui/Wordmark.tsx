import type { CSSProperties, FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ease, font, tracking } from "../theme";
import { useTone } from "../tone";

export type WordmarkProps = {
  text?: string;
  fontSize: number;
  /** Frame the first letter starts rising. */
  start: number;
  /** Frames between letters. */
  stagger?: number;
  /** Frames each letter takes. */
  duration?: number;
  weight?: number;
  style?: CSSProperties;
};

/**
 * Display type that lands letter by letter: each glyph rises out of a mask (bottom → top) with ease-out expo and
 * a slight de-blur. Colours come from the tone.
 */
export const Wordmark: FC<WordmarkProps> = ({ text = "Intatto", fontSize, start, stagger = 2, duration = 22, weight = 700, style }) => {
  const frame = useCurrentFrame();
  const tone = useTone();
  return (
    <div
      style={{
        display: "inline-flex",
        fontFamily: font.sans,
        fontWeight: weight,
        fontSize,
        letterSpacing: tracking.display,
        lineHeight: 1,
        color: tone.ink,
        whiteSpace: "pre",
        ...style,
      }}
    >
      {[...text].map((ch, i) => {
        const k = interpolate(frame, [start + i * stagger, start + i * stagger + duration], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: ease.out,
        });
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", padding: "0.12em 0.02em 0.18em", margin: "-0.12em -0.02em -0.18em" }}>
            <span
              style={{
                display: "inline-block",
                translate: `0px ${(1 - k) * 1.4}em`,
                filter: k > 0 && k < 1 ? `blur(${(1 - k) * 5}px)` : undefined,
              }}
            >
              {ch}
            </span>
          </span>
        );
      })}
    </div>
  );
};
