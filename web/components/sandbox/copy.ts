/**
 * Intatto's own words for the sandbox: every control is named after what it does and the fork method under it,
 * with one line on what to look at next and where.
 */
import type { Session } from "@intatto/config/session"
import type { AdminRequest, ScenarioName, WarpId } from "./api"

export type ScreenLink = { href: string; label: string }

export const SCREENS = {
  market: { href: "/", label: "Market" },
  borrow: { href: "/borrow", label: "Borrow" },
  lend: { href: "/lend", label: "Lend" },
  risk: { href: "/risk", label: "Risk console" },
} as const satisfies Record<string, ScreenLink>

export type WarpControl = { id: WarpId; label: string; busy: string; method: string; next: string; look: ScreenLink }

export const WARPS: WarpControl[] = [
  {
    id: "saturday",
    label: "Jump to Saturday",
    busy: "Jumping to Saturday…",
    method: "evm_setNextBlockTimestamp + evm_mine to Saturday, 12 hours after the Friday 20:00 ET close, then the keeper posts CLOSED",
    next: "New borrowing is capped at 30% of collateral value and falls toward 20% over 64 hours. Liquidation still starts at 65%.",
    look: SCREENS.borrow,
  },
  {
    id: "monday",
    label: "Jump to Monday open",
    busy: "Jumping to Monday open…",
    method: "evm_setNextBlockTimestamp + evm_mine to Monday 09:31 ET, then the keeper posts OPEN and a fresh price",
    next: "Regular US hours: new borrowing can reach 50% of collateral value again.",
    look: SCREENS.market,
  },
  {
    id: "hour",
    label: "+1 hour",
    busy: "Moving the clock 1 hour…",
    method: "evm_setNextBlockTimestamp + evm_mine at chain time + 3,600 s, then a keeper tick",
    next: "The session follows the calendar: it may move between OPEN, EXTENDED and CLOSED.",
    look: SCREENS.market,
  },
]

export type ScenarioControl = {
  name: ScenarioName
  title: string
  label: string
  busy: string
  /** What the data is, in words (never presented as more than it is). */
  provenance: string
  source: string
  method: string
  next: string
  look: ScreenLink
  /** How long it runs on the server, when it is more than a few seconds. */
  duration?: string
  followUp?: boolean
}

export const SCENARIOS: ScenarioControl[] = [
  {
    name: "gap-2025-01",
    title: "January 2025 NVDA weekend gap",
    label: "Replay the January 2025 gap",
    busy: "Replaying the January 2025 gap…",
    provenance: "CFD counterfactual: prices, not historical X Layer liquidity",
    source: "Dukascopy NVDA.US-USD minute bars, 24 and 27 January 2025",
    method: "Opens a scenario borrower just under the 50% weekday limit, jumps to the weekend, then Monday opens about 12.5% lower and falls about 5% more by the close (evm_setNextBlockTimestamp, pool swaps, keeper posts)",
    next: "The scenario borrower, opened at the 50% weekday limit, ends near 60% LTV: still under the 65% liquidation threshold. The last ledger entry says how many bounded liquidation slices ran.",
    look: SCREENS.risk,
    duration: "About a minute",
  },
  {
    name: "corporate-action",
    title: "Corporate action: 10-for-1 split",
    label: "Schedule a 10-for-1 split",
    busy: "Scheduling the split…",
    provenance: "Issuer multiplier: the current multiplier is real; the 10-for-1 activation is a scenario",
    source: "xStocks public multiplier API for NVDAx on X Layer",
    method: "The issuer's real multiplier updater (impersonated on the fork) schedules multiplier ×10 in 20 minutes; the keeper posts the pending action",
    next: "NVDAx borrowing and liquidation pause until the keeper resolves it; repay stays open.",
    look: SCREENS.borrow,
  },
  {
    name: "corporate-action-activate",
    title: "Split activation",
    label: "Activate the split",
    busy: "Activating the split…",
    provenance: "Scenario: follows the scheduled split above (schedules one first if none is pending)",
    source: "Same multiplier data as the split above",
    method: "evm_setNextBlockTimestamp past activation, the keeper posts the post-split quote (price ÷ 10) and resolves the guard",
    next: "The keeper posts the post-split price (÷ 10), the guard resolves and NVDAx borrowing reopens; collateral value should be unchanged across the split.",
    look: SCREENS.market,
    followUp: true,
  },
  {
    name: "synthetic-gap",
    title: "Synthetic gap beyond the reserve",
    label: "Run a synthetic 45% gap",
    busy: "Running the synthetic gap…",
    provenance: "Synthetic: not market data",
    source: "A 45% drop chosen to be larger than the gap reserve",
    method: "Opens a scenario borrower if needed, pushes the pool and the relayed price down 45% in steps, then liquidates",
    next: "The reserve pays first; what it cannot cover is recorded as a lender deficit and the share price falls.",
    look: SCREENS.lend,
    duration: "About 20 seconds",
  },
]

export const RESET = {
  label: "Reset to the session start",
  busy: "Resetting…",
  method: "evm_revert to the snapshot taken right after funding, then a fresh evm_snapshot",
  next: "Every transaction, warp and scenario since the start is discarded; the burner is funded again and the ledger keeps the record.",
} as const

export const START_METHOD =
  "Loads the snapshot into a fresh fork, sets the chain clock to now (evm_setNextBlockTimestamp), has the keeper post the session and a simulated pool-derived price, and funds a new burner from a real X Layer holder (anvil_impersonateAccount + transfer)."

/** F4: chosen fork inputs, kept next to the fork block and the burner balances. */
export const SEED_LABEL =
  "Seeded snapshot: lender funds, the reserve top-up, the borrow cap and the burner balances are chosen amounts on this fork, not organic mainnet activity."

/** F6 on the sandbox page before a session exists (live mode must not be described as the issuer quote). */
export const SANDBOX_PRICE_LABEL =
  "Keeper prices in a session are simulated from the forked pool, and replays can override them. They are not the live issuer quote."

export const SCENARIO_GROUPS: { id: string; title: string; names: ScenarioName[] }[] = [
  { id: "weekend-gap", title: "Weekend gap", names: ["gap-2025-01", "synthetic-gap"] },
  { id: "corporate-action", title: "Corporate action", names: ["corporate-action", "corporate-action-activate"] },
]

/** Method prefixes the public sandbox RPC refuses (services/sandbox/src/rpc-filter.ts). */
export const REFUSED_METHODS = ["anvil_*", "evm_*", "hardhat_*", "debug_*", "trace_*", "eth_sendTransaction", "eth_sign*"]

export const KIND_LABEL: Record<string, string> = {
  deploy: "Deploy",
  fund: "Funding",
  warp: "Time travel",
  keeper: "Keeper",
  actor: "Actor",
  scenario: "Scenario",
  reset: "Reset",
  note: "Note",
}

export type Tone = "success" | "info" | "warning" | "destructive"

export const SESSION_TONE: Record<Session, Tone> = {
  OPEN: "success",
  EXTENDED: "info",
  CLOSED: "warning",
  HALTED: "destructive",
  CORPORATE_ACTION: "destructive",
  UNKNOWN: "destructive",
}

export const SESSION_LIMIT: Record<Session, string> = {
  OPEN: "new loans up to 50% LTV",
  EXTENDED: "new loans up to 40% LTV",
  CLOSED: "new loans 30% → 20% LTV over 64 h",
  HALTED: "no new loans",
  CORPORATE_ACTION: "no new loans",
  UNKNOWN: "no new loans",
}

export function requestLabel(r: AdminRequest): string {
  if (r.kind === "warp") return WARPS.find((w) => w.id === r.target)?.label ?? "Time travel"
  if (r.kind === "scenario") return SCENARIOS.find((s) => s.name === r.name)?.label ?? "Scenario"
  return RESET.label
}
