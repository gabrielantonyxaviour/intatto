/**
 * What the fork proof compares: the external X Layer contracts Intatto depends on, the state read at the
 * fork block, and the raw storage slots no sandbox action ever writes.
 */
import { parseAbi, type Hex } from "viem"
import { FORK_FUNDING_HOLDER, TICKERS, XLAYER } from "@intatto/config/xlayer"

export const NVDAX = TICKERS.NVDAx.token as Hex
export const WNVDAX = TICKERS.NVDAx.wrapper as Hex
export const POOL = TICKERS.NVDAx.pool as Hex
export const USDG = XLAYER.usdg as Hex
export const USDG_USD = XLAYER.chainlinkUsdgUsd as Hex
export const HOLDER = FORK_FUNDING_HOLDER as Hex

/**
 * Aave v3 on X Layer, from the aave-dao address book (AaveV3XLayer.POOL_ADDRESSES_PROVIDER). The pool itself is
 * never hard-coded: it is read onchain from the provider's getPool() at the fork block.
 */
export const AAVE_POOL_ADDRESSES_PROVIDER = "0xdFf435BCcf782f11187D3a4454d96702eD78e092" as Hex

/** keccak256("eip1967.proxy.implementation") - 1 */
export const EIP1967_IMPLEMENTATION = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as Hex
/** keccak256("eip1967.proxy.admin") - 1 */
export const EIP1967_ADMIN = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103" as Hex

export const abi = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function getCurrentMultiplier() view returns (uint256 currentMultiplier, uint256 periodsPassed, uint256 currentMultiplierNonce)",
  "function multiplier() view returns (uint256)",
  "function newMultiplier() view returns (uint256)",
  "function newMultiplierActivationTime() view returns (uint256)",
  "function convertToAssets(uint256) view returns (uint256)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function liquidity() view returns (uint128)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function aggregator() view returns (address)",
  "function getPool() view returns (address)",
])
export type FnName = (typeof abi)[number]["name"]

/** How a raw 32-byte word is shown next to its hex. */
export type SlotDecode = "address" | "uint" | "wad" | "USDG" | "NVDAx" | "string" | "phase"

/** Display units for returned values. */
export type Unit = "NVDAx" | "wNVDAx" | "USDG" | "usd8" | "wad" | "uint" | "int" | "time" | "bool"

export type SlotTarget = { id: string; contract: string; address: Hex; slot: Hex; name: string; decode: SlotDecode }

export type CallTarget = {
  id: string
  contract: string
  address: Hex
  fn: FnName
  args?: readonly unknown[]
  label: string
  /** Units for each returned value, in order. */
  units: Unit[]
}

const s = (n: number) => `0x${n.toString(16)}` as Hex

/*
 * Check 3 reads the sandbox at its latest block and X Layer at the fork block. (A sandbox started from a state
 * snapshot cannot serve state AT the fork block, so "now" is the only sandbox state every sandbox can show.)
 */

/** Check 3a, contract calls no sandbox action can move: the sandbox moves balances but never mints, and nothing updates the feed. */
export const UNCHANGED_CALLS: CallTarget[] = [
  { id: "usdg.totalSupply", contract: "USDG", address: USDG, fn: "totalSupply", label: "totalSupply()", units: ["USDG"] },
  { id: "feed.latest", contract: "Chainlink USDG/USD", address: USDG_USD, fn: "latestRoundData", label: "latestRoundData()", units: ["uint", "usd8", "time", "time", "uint"] },
]

/**
 * Check 3a, raw storage no sandbox action writes: proxy implementations and admins, total supplies (funding moves
 * balances, never mints), the token's name and the feed's aggregator and owner. Any difference means the sandbox
 * state was edited outside its recorded actions.
 */
export const UNCHANGED_SLOTS: SlotTarget[] = [
  { id: "u.nvdax.impl", contract: "NVDAx", address: NVDAX, slot: EIP1967_IMPLEMENTATION, name: "EIP-1967 implementation", decode: "address" },
  { id: "u.nvdax.admin", contract: "NVDAx", address: NVDAX, slot: EIP1967_ADMIN, name: "EIP-1967 admin", decode: "address" },
  { id: "u.nvdax.name", contract: "NVDAx", address: NVDAX, slot: s(104), name: "name", decode: "string" },
  { id: "u.nvdax.supply", contract: "NVDAx", address: NVDAX, slot: s(264), name: "total supply before the multiplier", decode: "NVDAx" },
  { id: "u.wnvdax.impl", contract: "wNVDAx", address: WNVDAX, slot: EIP1967_IMPLEMENTATION, name: "EIP-1967 implementation", decode: "address" },
  { id: "u.wnvdax.admin", contract: "wNVDAx", address: WNVDAX, slot: EIP1967_ADMIN, name: "EIP-1967 admin", decode: "address" },
  { id: "u.usdg.impl", contract: "USDG", address: USDG, slot: EIP1967_IMPLEMENTATION, name: "EIP-1967 implementation", decode: "address" },
  { id: "u.usdg.supply", contract: "USDG", address: USDG, slot: s(2), name: "totalSupply", decode: "USDG" },
  { id: "u.feed.phase", contract: "Chainlink USDG/USD", address: USDG_USD, slot: s(2), name: "current phase (id and aggregator)", decode: "phase" },
  { id: "u.feed.owner", contract: "Chainlink USDG/USD", address: USDG_USD, slot: s(0), name: "owner", decode: "address" },
]

/**
 * Check 3b: values ordinary sandbox use moves, listed apart and never counted as a failure. Each shows the ledger
 * entries whose summary matches `explainedBy`.
 */
export type MovingTarget = CallTarget & { explainedBy: RegExp; why: string }

const MULTIPLIER = /multiplier|corporate|warp|weekend|monday|saturday|past the/i
const FUNDING = /NVDAx transferred from real holder|arbitrag|sold wNVDAx/i
const WRAPPING = /wrap|collateral|opened|sold w|arbitrag|liquidat/i
const TRADING = /sold w|arbitrag|swap|liquidat|pool/i
const MULTIPLIER_WHY = "The issuer's multiplier accrues its fee as time passes (so time warps move it) and the corporate-action scenario schedules a new one."

export const MOVING: MovingTarget[] = [
  { id: "m.holder", contract: "NVDAx", address: NVDAX, fn: "balanceOf", args: [HOLDER], label: `balanceOf(real holder ${HOLDER})`, units: ["NVDAx"], explainedBy: FUNDING, why: "Every session funds its burner with NVDAx from this real holder." },
  { id: "m.totalSupply", contract: "NVDAx", address: NVDAX, fn: "totalSupply", label: "totalSupply()", units: ["NVDAx"], explainedBy: MULTIPLIER, why: `Total supply is the raw supply times the multiplier. ${MULTIPLIER_WHY}` },
  { id: "m.multiplier", contract: "NVDAx", address: NVDAX, fn: "getCurrentMultiplier", label: "getCurrentMultiplier()", units: ["wad", "uint", "uint"], explainedBy: MULTIPLIER, why: MULTIPLIER_WHY },
  { id: "m.newMultiplier", contract: "NVDAx", address: NVDAX, fn: "newMultiplier", label: "newMultiplier()", units: ["wad"], explainedBy: MULTIPLIER, why: MULTIPLIER_WHY },
  { id: "m.activation", contract: "NVDAx", address: NVDAX, fn: "newMultiplierActivationTime", label: "newMultiplierActivationTime()", units: ["time"], explainedBy: MULTIPLIER, why: MULTIPLIER_WHY },
  { id: "m.convert", contract: "wNVDAx", address: WNVDAX, fn: "convertToAssets", args: [10n ** 18n], label: "convertToAssets(1e18)", units: ["NVDAx"], explainedBy: MULTIPLIER, why: `One wrapper share is worth more NVDAx as the multiplier changes. ${MULTIPLIER_WHY}` },
  { id: "m.wrapperSupply", contract: "wNVDAx", address: WNVDAX, fn: "totalSupply", label: "totalSupply()", units: ["wNVDAx"], explainedBy: WRAPPING, why: "Any wrap or unwrap changes this, including a borrower adding collateral." },
  { id: "m.slot0", contract: "wNVDAx/USDG pool", address: POOL, fn: "slot0", label: "slot0()", units: ["uint", "int", "uint", "uint", "uint", "uint", "bool"], explainedBy: TRADING, why: "Any swap in the pool changes this, including liquidation slices." },
  { id: "m.liquidity", contract: "wNVDAx/USDG pool", address: POOL, fn: "liquidity", label: "liquidity()", units: ["uint"], explainedBy: TRADING, why: "A swap that crosses a tick changes the active liquidity." },
]
