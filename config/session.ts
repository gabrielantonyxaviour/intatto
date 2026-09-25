/**
 * Market sessions and refusal reasons, mirrored from the contracts so every consumer
 * (keeper, credit API, web) names them the same way.
 */

/** Order matches ISessionRisk.Session in contracts/src/interfaces/ISessionRisk.sol. */
export const SESSIONS = ["UNKNOWN", "OPEN", "EXTENDED", "CLOSED", "HALTED", "CORPORATE_ACTION"] as const
export type Session = (typeof SESSIONS)[number]

export const sessionFromIndex = (i: number): Session => SESSIONS[i] ?? "UNKNOWN"
export const sessionIndex = (s: Session): number => SESSIONS.indexOf(s)

/** Issuer trading periods (api.xstocks.fi trading.currentPeriod) mapped onto our sessions. */
export function sessionFromIssuer(period: string | null | undefined, halted: boolean): Session {
  if (halted) return "HALTED"
  switch (period) {
    case "market":
      return "OPEN"
    case "extended":
    case "overnight":
      return "EXTENDED"
    case "closed":
      return "CLOSED"
    default:
      return "UNKNOWN"
  }
}

/** Custom errors CollateralMarket.borrow can revert with, and what each means to a person. */
export const REFUSALS = {
  UnknownSession: "The market session is unknown or the keeper's last session post is too old, so new borrowing is off.",
  SessionLimit: "This borrow would take the position above the current session's borrowing limit.",
  StalePrice: "The keeper's last price post is older than its liveness limit.",
  PriceOutOfBand: "The relayed price is outside the band around the pool's 30-minute average.",
  CorporateActionPending: "A split or dividend is activating for this stock; borrowing and liquidation are paused.",
  TickerCapReached: "Total debt against this stock would exceed the cap sized from pool exit depth.",
  UsdgOffPeg: "USDG/USD is stale or more than 1% off peg, so new credit is frozen.",
  IssuerPaused: "The token issuer has paused this stock; borrowing and liquidation stop, repay stays open.",
  InsufficientLiquidity: "The vault does not hold enough idle USDG for this amount.",
  Unhealthy: "This withdrawal would leave the position below its borrowing limit.",
} as const
export type RefusalName = keyof typeof REFUSALS
