/**
 * Check 2: every external contract Intatto touches runs, on the sandbox now, the same runtime code X Layer had at
 * the fork block. Implementations, proxy admins, the feed's aggregator and the Aave pool are resolved onchain on
 * each side (X Layer at the fork block, the sandbox now), so a swapped implementation shows as a different address.
 * The sandbox is read at its latest block: one started from a state snapshot cannot serve state at the fork block.
 */
import { decodeFunctionResult, encodeFunctionData, getAddress, type Hex } from "viem"
import { call, getCode, getSlot, type BlockRef, type ProofClient } from "./rpc"
import {
  AAVE_POOL_ADDRESSES_PROVIDER,
  EIP1967_ADMIN,
  EIP1967_IMPLEMENTATION,
  NVDAX,
  POOL,
  USDG,
  USDG_USD,
  WNVDAX,
  abi,
} from "./targets"

type Resolve = (c: ProofClient, block: BlockRef) => Promise<Hex | null>

const nonZero = (a: string): Hex | null => (/^0x0{40}$/i.test(a) ? null : (getAddress(a) as Hex))

const fromSlot = (address: Hex, slot: Hex): Resolve => async (c, b) => nonZero(`0x${(await getSlot(c, address, slot, b)).slice(26)}`)

const fromCall = (address: Hex, fn: "aggregator" | "getPool"): Resolve => async (c, b) => {
  const res = await call(c, address, encodeFunctionData({ abi, functionName: fn }), b)
  if (!res.ok || res.data === "0x") return null
  return nonZero(decodeFunctionResult({ abi, functionName: fn, data: res.data }) as string)
}

type Target = { label: string; how: string; address?: Hex; resolve?: Resolve; parent?: string }

const TARGETS: Target[] = [
  { label: "NVDAx", how: "issuer token (proxy)", address: NVDAX },
  { label: "NVDAx implementation", how: "EIP-1967 implementation slot of NVDAx", resolve: fromSlot(NVDAX, EIP1967_IMPLEMENTATION) },
  { label: "NVDAx proxy admin", how: "EIP-1967 admin slot of NVDAx", resolve: fromSlot(NVDAX, EIP1967_ADMIN) },
  { label: "wNVDAx", how: "issuer ERC-4626 wrapper (proxy)", address: WNVDAX },
  { label: "wNVDAx implementation", how: "EIP-1967 implementation slot of wNVDAx", resolve: fromSlot(WNVDAX, EIP1967_IMPLEMENTATION) },
  { label: "wNVDAx proxy admin", how: "EIP-1967 admin slot of wNVDAx", resolve: fromSlot(WNVDAX, EIP1967_ADMIN) },
  { label: "wNVDAx/USDG pool", how: "Uniswap v3 pool, 0.05% fee", address: POOL },
  { label: "USDG", how: "stablecoin (proxy)", address: USDG },
  { label: "USDG implementation", how: "EIP-1967 implementation slot of USDG", resolve: fromSlot(USDG, EIP1967_IMPLEMENTATION) },
  { label: "Chainlink USDG/USD proxy", how: "price feed proxy", address: USDG_USD },
  { label: "Chainlink USDG/USD aggregator", how: "aggregator() of the feed proxy", resolve: fromCall(USDG_USD, "aggregator") },
  { label: "Aave v3 PoolAddressesProvider", how: "from the Aave address book (AaveV3XLayer)", address: AAVE_POOL_ADDRESSES_PROVIDER },
  { label: "Aave v3 Pool", how: "getPool() of the PoolAddressesProvider", resolve: fromCall(AAVE_POOL_ADDRESSES_PROVIDER, "getPool") },
  { label: "Aave v3 Pool implementation", how: "EIP-1967 implementation slot of the Aave v3 Pool", parent: "Aave v3 Pool" },
]

export type CodeSummary = { hash: Hex | null; size: number }

export type CodeRow = {
  label: string
  how: string
  address: Hex
  /** Set when the sandbox now resolves this address differently from X Layer at the fork block. */
  sandboxResolved: Hex | null
  reference: CodeSummary
  sandboxNow: CodeSummary
  equal: boolean
}

export type BytecodeEvidence = { rows: CodeRow[]; omitted: { label: string; reason: string }[] }

export async function checkBytecode(sandbox: ProofClient, reference: ProofClient, forkBlock: bigint) {
  const resolved = new Map<string, { address: Hex | null; sandbox: Hex | null }>()
  const resolveBoth = async (label: string, fn: Resolve) => {
    const [r, s] = await Promise.all([fn(reference, forkBlock), fn(sandbox, "latest")])
    resolved.set(label, { address: r, sandbox: s })
  }
  await Promise.all(TARGETS.filter((t) => t.resolve).map((t) => resolveBoth(t.label, t.resolve!)))
  for (const t of TARGETS.filter((x) => x.parent)) {
    const parent = resolved.get(t.parent!)?.address
    if (parent) await resolveBoth(t.label, fromSlot(parent, EIP1967_IMPLEMENTATION))
    else resolved.set(t.label, { address: null, sandbox: null })
  }

  const omitted: BytecodeEvidence["omitted"] = []
  const work = TARGETS.flatMap((t) => {
    if (t.address) return [{ t, address: t.address, sandboxResolved: null as Hex | null }]
    const r = resolved.get(t.label)
    if (!r?.address) {
      omitted.push({ label: t.label, reason: `${t.how} is empty on X Layer at block ${forkBlock}` })
      return []
    }
    const differs = (r.sandbox ?? "").toLowerCase() !== r.address.toLowerCase()
    return [{ t, address: r.address, sandboxResolved: differs ? (r.sandbox ?? ("0x" as Hex)) : null }]
  })

  const summary = ({ hash, size }: CodeSummary): CodeSummary => ({ hash, size })
  const rows = await Promise.all(
    work.map(async ({ t, address, sandboxResolved }): Promise<CodeRow> => {
      const [ref, now] = await Promise.all([getCode(reference, address, forkBlock), getCode(sandbox, address, "latest")])
      const equal = ref.hash !== null && ref.hash === now.hash && sandboxResolved === null
      return { label: t.label, how: t.how, address, sandboxResolved, reference: summary(ref), sandboxNow: summary(now), equal }
    }),
  )
  return { pass: rows.length > 0 && rows.every((r) => r.equal), evidence: { rows, omitted } satisfies BytecodeEvidence }
}
