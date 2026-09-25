"use client"

import { useCallback, useState, useSyncExternalStore } from "react"

/** Bump the version when the primer's terms change, so every lender reads them again. */
export const LEND_TERMS_KEY = "intatto:lend-terms:v1"
const CHANGE_EVENT = "intatto:lend-terms-change"

function read(): boolean {
  try {
    return window.localStorage.getItem(LEND_TERMS_KEY) === "accepted"
  } catch {
    return false
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === LEND_TERMS_KEY) onChange()
  }
  window.addEventListener("storage", onStorage)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

/**
 * Whether this browser accepted the lending terms. Stored in localStorage; when storage is blocked the
 * acceptance lasts until the page reloads.
 */
export function useLendTerms() {
  const stored = useSyncExternalStore(subscribe, read, () => false)
  const [memory, setMemory] = useState(false)

  const accept = useCallback(() => {
    setMemory(true)
    try {
      window.localStorage.setItem(LEND_TERMS_KEY, "accepted")
      window.dispatchEvent(new Event(CHANGE_EVENT))
    } catch {
      // storage blocked: the in-memory acceptance above covers this visit
    }
  }, [])

  return { accepted: stored || memory, accept }
}
