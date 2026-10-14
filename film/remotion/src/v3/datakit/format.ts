/** Fixed decimals with thousands separators, tabular-safe. `fmt(2037.58, 2)` → "2,037.58". */
export const fmt = (n: number, decimals: number) => {
  const [int, dec] = Math.abs(n).toFixed(decimals).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${n < 0 ? "−" : ""}${grouped}${dec ? `.${dec}` : ""}`;
};

/** A signed percentage with a true minus sign. */
export const pct = (n: number, decimals: number) => `${n > 0 ? "+" : ""}${fmt(n, decimals)}%`;

/** "0x39cd860e…81371c039": head and tail kept, middle elided. */
export const midTrim = (hex: string, head = 10, tail = 8) =>
  hex.length <= head + tail + 1 ? hex : `${hex.slice(0, head)}…${hex.slice(-tail)}`;
