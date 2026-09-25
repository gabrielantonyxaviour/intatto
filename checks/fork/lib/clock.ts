/**
 * US equity calendar helpers for scenarios (UTC). The regular session is 13:30–20:00 UTC in US daylight time
 * (14:30–21:00 in standard time); the weekend runs from Friday's 20:00 ET close to Sunday's 20:00 ET reopen of
 * issuer overnight trading.
 */

const HOUR = 3600
const DAY = 86_400

/** New York offset from UTC in hours for a given UTC time (-4 in daylight time, -5 otherwise). */
export function nyOffsetHours(unix: number): number {
  const d = new Date(unix * 1000)
  const year = d.getUTCFullYear()
  const secondSundayMarch = nthSunday(year, 2, 2) + 7 * HOUR // 02:00 ET = 07:00 UTC
  const firstSundayNov = nthSunday(year, 10, 1) + 6 * HOUR // 02:00 EDT = 06:00 UTC
  return unix >= secondSundayMarch && unix < firstSundayNov ? -4 : -5
}

function nthSunday(year: number, month: number, n: number): number {
  const first = Date.UTC(year, month, 1) / 1000
  const dow = new Date(first * 1000).getUTCDay()
  return first + (((7 - dow) % 7) + 7 * (n - 1)) * DAY
}

/** The next Friday 20:00 ET (the weekend close) strictly after `unix`. */
export function nextWeekendClose(unix: number): number {
  for (let t = Math.floor(unix / DAY) * DAY; ; t += DAY) {
    const d = new Date(t * 1000)
    if (d.getUTCDay() !== 5) continue
    const close = t + (20 - nyOffsetHours(t + 12 * HOUR)) * HOUR // Friday 20:00 ET in UTC
    if (close > unix) return close
  }
}

/** The Monday 09:30 ET regular open after a weekend close. */
export function mondayOpenAfter(weekendClose: number): number {
  // Friday 20:00 ET is Saturday 00:00 or 01:00 UTC, so Monday is two UTC days after that Saturday.
  const monday = Math.floor(weekendClose / DAY) * DAY + 2 * DAY
  return monday + Math.round((9.5 - nyOffsetHours(monday + 12 * HOUR)) * HOUR)
}

/**
 * The session in force at `unix` by the US calendar, and when its period began, the way the keeper maps the
 * issuer's periods: regular hours OPEN; pre-market, after-hours and overnight EXTENDED; the weekend CLOSED.
 * Exchange holidays are ignored in simulated time.
 */
export function calendarSession(unix: number): { session: "OPEN" | "EXTENDED" | "CLOSED"; periodChangedAt: number } {
  const close = nextWeekendClose(unix - 7 * DAY)
  let lastClose = close
  while (nextWeekendClose(lastClose) <= unix) lastClose = nextWeekendClose(lastClose)
  const reopen = lastClose + 2 * DAY // Sunday 20:00 ET
  if (unix >= lastClose && unix < reopen) return { session: "CLOSED", periodChangedAt: lastClose }
  const off = nyOffsetHours(unix)
  const nyDayStart = Math.floor((unix + off * HOUR) / DAY) * DAY - off * HOUR // 00:00 ET in UTC
  const et = (unix - nyDayStart) / HOUR
  const at = (h: number) => nyDayStart + Math.round(h * HOUR)
  if (et >= 9.5 && et < 16) return { session: "OPEN", periodChangedAt: at(9.5) }
  if (et >= 4 && et < 9.5) return { session: "EXTENDED", periodChangedAt: at(4) }
  if (et >= 16 && et < 20) return { session: "EXTENDED", periodChangedAt: at(16) }
  return { session: "EXTENDED", periodChangedAt: et >= 20 ? at(20) : at(-4) }
}

/** The start of the next regular session (09:30 ET on a weekday) at or after `unix`; `unix` itself when OPEN. */
export function nextOpen(unix: number): number {
  if (calendarSession(unix).session === "OPEN") return unix
  for (let day = Math.floor(unix / DAY) * DAY; ; day += DAY) {
    const dow = new Date((day + 12 * HOUR) * 1000).getUTCDay()
    if (dow === 0 || dow === 6) continue
    const open = day + Math.round((9.5 - nyOffsetHours(day + 12 * HOUR)) * HOUR)
    if (open > unix) return open
  }
}

export const MINUTE = 60
export { HOUR, DAY }
