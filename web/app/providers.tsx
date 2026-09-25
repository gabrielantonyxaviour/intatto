"use client"

import type { ReactNode } from "react"
import { IntattoChainProvider } from "@/lib/chain"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <IntattoChainProvider>
      <TooltipProvider>
        {children}
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </IntattoChainProvider>
  )
}
