"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import type { LedgerEntry } from "./api"
import type { Admin } from "./admin-controls"

type Progress = { done: number[]; pending?: number; resetAt?: string }
const EVENT = "intatto:demo-progress"
const key = (id: string) => `intatto:demo:${id}`
function read(id: string): Progress {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key(id)) ?? "null")
    if (value && typeof value === "object" && "done" in value && Array.isArray(value.done)) {
      const p = value as Record<string, unknown>
      return {
        done: [...new Set(value.done.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= 5))],
        pending: p.pending === 1 || p.pending === 3 ? p.pending : undefined,
        resetAt: typeof p.resetAt === "string" ? p.resetAt : undefined,
      }
    }
  } catch { /* Progress is optional when browser storage is unavailable. */ }
  return { done: [] }
}

/** Only navigation visits and successful admin outcomes count; a running replay is never complete. */
export function useDemoProgress(sessionId: string, admin: Admin, entries?: LedgerEntry[]) {
  const pathname = usePathname()
  const [progress, setProgress] = useState<Progress>(() => read(sessionId))
  const update = useCallback((change: (p: Progress) => Progress) => {
    setProgress((current) => {
      const next = change(current)
      try { localStorage.setItem(key(sessionId), JSON.stringify(next)) } catch { /* In-memory fallback. */ }
      return next
    })
  }, [sessionId])

  useEffect(() => {
    const sync = () => setProgress(read(sessionId))
    window.addEventListener(EVENT, sync)
    window.addEventListener("storage", sync)
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync) }
  }, [sessionId])
  useEffect(() => {
    if (pathname === "/borrow" && progress.pending) {
      update((p) => p.pending ? ({ ...p, done: [...new Set([...p.done, p.pending])], pending: undefined }) : p)
    }
  }, [pathname, progress.pending, update])
  useEffect(() => {
    if (!entries) return
    const resetIndex = entries.findLastIndex((e) => e.kind === "reset")
    const resetAt = entries[resetIndex]?.at
    const recent = entries.slice(resetIndex + 1)
    const derived: number[] = []
    if (recent.some((e) => e.kind === "warp" && /Saturday|weekend/i.test(e.summary))) derived.push(2)
    if (recent.some((e) => e.kind === "scenario" && e.summary.startsWith("gap replay finished:"))) derived.push(4)
    if (recent.some((e) => e.kind === "scenario" && e.summary.startsWith("synthetic gap finished:"))) derived.push(5)
    update((p) => ({ resetAt, pending: resetAt === p.resetAt ? p.pending : undefined,
      done: [...new Set([...(resetAt === p.resetAt ? p.done : []), ...derived])] }))
  }, [entries, update])
  useEffect(() => {
    if (!admin.isSuccess || !admin.variables) return
    const r = admin.variables
    const step = r.kind === "warp" && r.target === "saturday" ? 2
      : r.kind === "scenario" && r.name === "gap-2025-01" ? 4
      : r.kind === "scenario" && r.name === "synthetic-gap" ? 5 : null
    if (step) update((p) => ({ ...p, done: [...new Set([...p.done, step])] }))
  }, [admin.isSuccess, admin.data, admin.variables, update])

  const visit = (step: number) => {
    const next = { ...progress, pending: step }
    try { localStorage.setItem(key(sessionId), JSON.stringify(next)) } catch { /* Optional progress only. */ }
    setProgress(next)
    window.dispatchEvent(new Event(EVENT))
  }
  const next = [1, 2, 3, 4, 5].find((n) => !progress.done.includes(n)) ?? 5
  return { done: progress.done, next, visit, complete: progress.done.length === 5 }
}
