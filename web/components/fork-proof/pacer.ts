/**
 * Request pacing for the fork proof's RPC clients.
 *
 * - The public X Layer RPC allows about 7 requests a second per IP and answers a 429 without CORS headers (the
 *   browser then reports a CORS failure), so the reference side stays well under that.
 * - anvil 1.7 can deadlock when several reads tagged with a block at or before the fork block are in flight at
 *   once, so the sandbox runs those one at a time; reads at "latest" may overlap.
 */
export type Schedule = <T>(fn: () => Promise<T>) => Promise<T>

/** At most `perSecond` requests started in any second and `concurrent` in flight. */
export function pacer(perSecond: number, concurrent: number): Schedule {
  let active = 0
  let started: number[] = []
  const queue: (() => void)[] = []
  const pump = () => {
    while (active < concurrent && queue.length > 0) {
      const now = Date.now()
      started = started.filter((t) => now - t < 1000)
      if (started.length >= perSecond) {
        setTimeout(pump, 1000 - (now - started[0]!) + 5)
        return
      }
      active++
      started.push(now)
      queue.shift()!()
    }
  }
  return async (fn) => {
    await new Promise<void>((resolve) => {
      queue.push(resolve)
      pump()
    })
    try {
      return await fn()
    } finally {
      active--
      pump()
    }
  }
}

/** Rate limits, dropped connections and timeouts are worth retrying; a revert or a refused method is an answer. */
export const RETRYABLE = /rate|limit|too many|429|failed to fetch|network|timed? ?out|took too long|socket|50[234]/i

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Thrown into a superseded run's pending reads so a re-run does not compete with the run it replaced. */
export class Cancelled extends Error {
  constructor() {
    super("superseded by a newer run")
  }
}
