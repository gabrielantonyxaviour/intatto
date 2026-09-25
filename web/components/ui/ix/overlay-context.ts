"use client"

import { createContext, useContext } from "react"

/** Internal guard shared by sheets and transaction reviews, including through portals. */
export const IxOverlayContext = createContext(false)
export function useAssertRootOverlay() {
  if (useContext(IxOverlayContext)) throw new Error("IX sheets and review dialogs must not be nested. Close the current overlay first.")
}
