import { cn } from "@/lib/utils"

const SIZE = 5

function hash(address: string): number {
  let h = 2166136261
  for (let i = 0; i < address.length; i++) {
    h ^= address.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function unit(seed: number): () => number {
  let a = seed || 1
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 5×5 mirrored grid. Fills are derived from the address so the same account always draws the same mark. */
function pattern(address: string): { background: string; foreground: string; cells: string } {
  const rand = unit(hash(address.toLowerCase()))
  const hue = Math.floor(rand() * 360)
  const bits: string[] = []
  for (let y = 0; y < SIZE; y++) {
    const row = [rand() > 0.5, rand() > 0.5, rand() > 0.5]
    if (y === 2) row[2] = true
    for (const on of [row[0], row[1], row[2], row[1], row[0]]) bits.push(on ? "1" : "0")
  }
  return {
    background: `hsl(${hue}, 52%, 42%)`,
    foreground: `hsl(${hue}, 35%, 92%)`,
    cells: bits.join(""),
  }
}

export function AddressAvatar({ address, className }: { address: string; className?: string }) {
  const { background, foreground, cells } = pattern(address)
  return (
    <svg
      data-testid="wallet-avatar"
      data-address={address.toLowerCase()}
      data-cells={cells}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={cn("size-5 shrink-0 rounded-full", className)}
      aria-hidden
    >
      <rect width={SIZE} height={SIZE} fill={background} />
      {cells.split("").map((on, i) =>
        on === "1" ? (
          <rect key={i} x={i % SIZE} y={Math.floor(i / SIZE)} width={1} height={1} fill={foreground} />
        ) : null,
      )}
    </svg>
  )
}
