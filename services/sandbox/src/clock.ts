/** Sandbox time targets on top of the shared US-equity calendar (checks/fork/lib/clock.ts). Portable. */
import { calendarSession, mondayOpenAfter, nextWeekendClose, DAY, MINUTE } from "../../../checks/fork/lib/clock.ts"

/** How far past the snapshot a session's clock may start: with warps, the forked USDG/USD feed must stay within 30 days. */
export const MAX_CLOCK_LEAD = 14 * DAY
/** The longest single `{ seconds }` warp the API accepts. */
export const MAX_WARP_SECONDS = 7 * DAY

/** The Monday 09:30 ET regular open after the current (or next) weekend. */
export function nextMondayOpen(unix: number): number {
  const now = calendarSession(unix)
  const close = now.session === "CLOSED" ? now.periodChangedAt : nextWeekendClose(unix)
  const open = mondayOpenAfter(close)
  return open > unix ? open : mondayOpenAfter(nextWeekendClose(unix))
}

export const iso = (unix: number) => new Date(unix * 1000).toISOString().replace(".000Z", "Z")

export function human(seconds: number): string {
  if (seconds % DAY === 0) return `${seconds / DAY} day${seconds === DAY ? "" : "s"}`
  if (seconds % 3600 === 0) return `${seconds / 3600} hour${seconds === 3600 ? "" : "s"}`
  if (seconds % MINUTE === 0) return `${seconds / MINUTE} minute${seconds === MINUTE ? "" : "s"}`
  return `${seconds} seconds`
}
