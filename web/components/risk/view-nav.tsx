"use client"

/**
 * The list of analyses, one view at a time: wrapping links at every width, a side list on wide screens.
 * The URL hash (#prices) mirrors the view, so each analysis can be linked and the back button returns to the previous one.
 */
import { useCallback, useEffect, useState, type MouseEvent } from "react"
import { cn } from "@/lib/utils"

export const VIEWS = [
  { id: "summary", label: "Summary" },
  { id: "prices", label: "Price posts" },
  { id: "shock", label: "Price shock" },
  { id: "loans", label: "Loans near liquidation" },
  { id: "caps", label: "Caps and LTV spread" },
  { id: "overview", label: "Market overview" },
  { id: "sessions", label: "Sessions" },
  { id: "actions", label: "Corporate actions" },
  { id: "liquidations", label: "Liquidations" },
  { id: "keeper", label: "Keeper log" },
  { id: "trust", label: "Trust and bounds" },
] as const

export type ViewId = (typeof VIEWS)[number]["id"]

const isView = (v: string): v is ViewId => VIEWS.some((x) => x.id === v)

function viewFromHash(): ViewId {
  const hash = typeof window === "undefined" ? "" : window.location.hash.slice(1)
  return isView(hash) ? hash : "summary"
}

/**
 * The open analysis. React state is the source of truth; the hash mirrors it through history.pushState, which
 * Next's router records (a bare fragment change would be overwritten by its next URL sync).
 */
export function useView(): [ViewId, (v: ViewId) => void] {
  const [view, setViewState] = useState<ViewId>(viewFromHash)
  useEffect(() => {
    const sync = () => setViewState(viewFromHash())
    window.addEventListener("popstate", sync)
    window.addEventListener("hashchange", sync)
    return () => {
      window.removeEventListener("popstate", sync)
      window.removeEventListener("hashchange", sync)
    }
  }, [])
  const setView = useCallback((v: ViewId) => {
    setViewState(v)
    if (window.location.hash.slice(1) !== v) window.history.pushState(null, "", `#${v}`)
  }, [])
  return [view, setView]
}

export function ViewNav({ view, onChange }: { view: ViewId; onChange: (v: ViewId) => void }) {
  return (
    <nav aria-label="Risk analyses" className="min-w-0 lg:sticky lg:top-20">
      <ul className="flex flex-wrap gap-1 lg:grid">
        {VIEWS.map((v) => (
          <li key={v.id} className="max-w-full">
            <a
              href={`#${v.id}`}
              onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                e.preventDefault()
                onChange(v.id)
              }}
              aria-current={view === v.id ? "page" : undefined}
              className={cn(
                "block max-w-full rounded-md px-3 py-1.5 text-sm break-words transition-colors hover:bg-muted hover:text-foreground",
                view === v.id ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {v.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
