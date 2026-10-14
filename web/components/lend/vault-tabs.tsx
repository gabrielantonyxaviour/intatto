"use client"

import { useEffect } from "react"
import type { VaultState } from "@/lib/chain"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AllocationSection } from "./allocation-section"
import { DeficitsSection } from "./deficits-section"
import { OverviewSection } from "./overview-section"
import { RatesSection } from "./rates-section"
import { RiskSection } from "./risk-section"
import type { LendMarket } from "./use-lend-reads"

const SECTIONS = ["overview", "allocation", "rates", "risk", "deficits"] as const

export function VaultTabs({ vault, markets, value, onValueChange }: {
  vault: VaultState
  markets: LendMarket[]
  value: string
  onValueChange: (value: string) => void
}) {
  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash.slice(1)
      if (SECTIONS.some((section) => section === hash)) onValueChange(hash)
    }
    sync()
    window.addEventListener("hashchange", sync)
    return () => window.removeEventListener("hashchange", sync)
  }, [onValueChange])

  const bodies = {
    overview: <OverviewSection vault={vault} />,
    allocation: <AllocationSection vault={vault} markets={markets} />,
    rates: <RatesSection vault={vault} />,
    risk: <RiskSection vault={vault} markets={markets} />,
    deficits: <DeficitsSection vault={vault} />,
  }
  return (
    <Tabs id="vault-sections" value={value} onValueChange={onValueChange}
      className="min-w-0 scroll-mt-24 gap-6 lg:col-start-1 lg:row-start-2">
      <TabsList variant="line" aria-label="Vault sections" className="w-full justify-start border-b px-0 pb-2">
        {SECTIONS.map((section) => (
          <TabsTrigger key={section} value={section} className="px-1 text-xs capitalize sm:px-3 sm:text-sm">
            {section}
          </TabsTrigger>
        ))}
      </TabsList>
      {SECTIONS.map((section) => (
        <TabsContent key={section} value={section} forceMount hidden={value !== section} className="min-w-0">
          {bodies[section]}
        </TabsContent>
      ))}
    </Tabs>
  )
}
