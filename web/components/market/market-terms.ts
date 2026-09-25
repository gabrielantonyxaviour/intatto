import type { ProtocolParams } from "@/lib/chain"
import type { MarketTerms } from "./copy"

/** The fields this screen's sentences use, taken from one pinned useProtocolParams snapshot. */
export function marketTerms(p: ProtocolParams): MarketTerms {
  return {
    openLtvBps: p.session.openBps,
    extendedLtvBps: p.session.extendedBps,
    closedStartBps: p.session.closedStartBps,
    closedFloorBps: p.session.closedFloorBps,
    closedDecaySeconds: p.session.closedDecayDuration,
    sessionLivenessSeconds: p.session.livenessLimit,
    penaltyBps: p.market.penaltyBps,
    liqOpenFloorBps: p.liquidator.openFloorBps,
    liqClosedFloorBps: p.liquidator.closedFloorBps,
    liqClosedTimeoutFloorBps: p.liquidator.closedTimeoutFloorBps,
    liqClosedTimeoutSeconds: p.liquidator.closedTimeout,
    bandOpenBps: p.relay.bandOpenBps,
    bandOtherBps: p.relay.bandOtherBps,
    maxMoveBps: p.relay.maxMoveBps,
    priceLivenessSeconds: p.relay.priceLiveness,
    pegBps: p.relay.pegBps,
    twapWindowSeconds: p.relay.twapWindow,
  }
}
