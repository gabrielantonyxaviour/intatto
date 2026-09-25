/** Reading and showing compared values: contract calls decoded with their units, raw words decoded by kind. */
import { decodeFunctionResult, encodeFunctionData, getAddress, hexToBigInt, hexToString, type Hex } from "viem"
import { formatNumber, formatTokenAmount, formatUtc } from "@/components/ui/web3/format"
import { call, type BlockRef, type ProofClient } from "./rpc"
import { abi, type CallTarget, type SlotDecode, type Unit } from "./targets"

/** `raw` is what is compared; `shown` is the same value in words and units. */
export type ReadValue = { raw: string; shown: string }

function formatUnit(v: unknown, unit: Unit | undefined): string {
  if (typeof v === "boolean") return String(v)
  if (typeof v !== "bigint") return String(v)
  switch (unit) {
    case "NVDAx":
    case "wNVDAx":
      return `${formatTokenAmount(v, 18, { maxFractionDigits: 6 })} ${unit}`
    case "USDG":
      return `${formatTokenAmount(v, 6, { maxFractionDigits: 6 })} USDG`
    case "usd8":
      return `$${formatTokenAmount(v, 8, { maxFractionDigits: 8 })}`
    case "wad":
      return `${formatTokenAmount(v, 18, { maxFractionDigits: 18 })}×`
    case "time":
      return v === 0n ? "0 (none)" : formatUtc(v)
    default:
      return formatNumber(v)
  }
}

export async function readCall(c: ProofClient, t: CallTarget, block: BlockRef): Promise<ReadValue> {
  const data = encodeFunctionData({ abi, functionName: t.fn, args: (t.args ?? []) as never } as never)
  const res = await call(c, t.address, data, block)
  if (!res.ok) return { raw: "reverted", shown: `reverted (${res.reverted})` }
  const decoded = decodeFunctionResult({ abi, functionName: t.fn, data: res.data } as never) as unknown
  const values = Array.isArray(decoded) ? (decoded as unknown[]) : [decoded]
  return {
    raw: values.map((v) => String(v)).join(", "),
    shown: values.map((v, i) => formatUnit(v, t.units[i])).join(" · "),
  }
}

const ZERO_WORD = `0x${"0".repeat(64)}`

/** Solidity short-string layout: data left-aligned, length × 2 in the last byte. */
function shortString(word: Hex): string {
  const last = parseInt(word.slice(-2), 16)
  if (last % 2 === 1) return "long string (stored elsewhere)"
  const len = last / 2
  return `"${hexToString(`0x${word.slice(2, 2 + len * 2)}` as Hex)}"`
}

export function decodeSlot(word: Hex, kind: SlotDecode): string {
  if (word === ZERO_WORD) return "empty (0)"
  const n = hexToBigInt(word)
  switch (kind) {
    case "address":
      return getAddress(`0x${word.slice(26)}`)
    case "USDG":
      return `${formatTokenAmount(n, 6, { maxFractionDigits: 6 })} USDG`
    case "wad":
      return `${formatTokenAmount(n, 18, { maxFractionDigits: 18 })}×`
    case "NVDAx":
      return `${formatTokenAmount(n, 18, { maxFractionDigits: 6 })} NVDAx`
    case "string":
      return shortString(word)
    case "phase": {
      // Chainlink proxy Phase { uint16 id; address aggregator }: id in the low 2 bytes, aggregator above it.
      const body = word.slice(2)
      const id = parseInt(body.slice(60), 16)
      return `phase ${id}, aggregator ${getAddress(`0x${body.slice(20, 60)}`)}`
    }
    default:
      return formatNumber(n)
  }
}
