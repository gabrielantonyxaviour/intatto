"use client"

import { useEffect, useState } from "react"
import type { VaultState } from "@/lib/chain"
import { EvidenceSheet, type EvidenceState } from "@/components/ui/ix"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AddressDisplay, formatUtc } from "@/components/ui/web3"
import { changeText, sharePriceNumber, usdg } from "./lend-format"
import { Section } from "./overview-section"
import { SummaryRow } from "./summary-row"
import { useDeficits, type DeficitRow } from "./use-lend-reads"

function Row({ d }: { d: DeficitRow }) {
  return (
    <TableRow data-testid="deficit-row">
      <TableCell className="tabular-nums">
        <span className="text-muted-foreground">{d.index + 1}.</span> {formatUtc(d.at)}
      </TableCell>
      <TableCell>
        <AddressDisplay address={d.borrower} copy={false} />
      </TableCell>
      <TableCell data-testid="deficit-amount" className="text-right tabular-nums">
        {usdg(d.amount, 6)}
      </TableCell>
      <TableCell data-testid="deficit-price" className="text-right tabular-nums">
        {sharePriceNumber(d.sharePriceBefore)} → {sharePriceNumber(d.sharePriceAfter)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-destructive">{changeText(d.sharePriceBefore, d.sharePriceAfter)}</TableCell>
    </TableRow>
  )
}

function RowCard({ d }: { d: DeficitRow }) {
  return (
    <li data-testid="deficit-card" className="rounded-lg border p-3">
      <dl className="grid gap-2">
        <SummaryRow label={`Deficit ${d.index + 1}`}>{formatUtc(d.at)}</SummaryRow>
        <SummaryRow label="Written off" testId="deficit-card-amount">
          {usdg(d.amount, 6)}
        </SummaryRow>
        <SummaryRow label="Share price (USDG)" testId="deficit-card-price">
          {sharePriceNumber(d.sharePriceBefore)} → {sharePriceNumber(d.sharePriceAfter)}
        </SummaryRow>
        <SummaryRow label="Change">
          <span className="text-destructive">{changeText(d.sharePriceBefore, d.sharePriceAfter)}</span>
        </SummaryRow>
        <SummaryRow label="Borrower">
          <AddressDisplay address={d.borrower} copy={false} />
        </SummaryRow>
      </dl>
    </li>
  )
}

/** The deficit total stays inline. History opens in one sheet. */
export function DeficitsSection({ vault }: { vault: VaultState }) {
  const deficits = useDeficits(vault.deficitCount)
  const count = Number(vault.deficitCount)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const sync = () => {
      if (window.location.hash === "#deficits") setOpen(true)
    }
    sync()
    window.addEventListener("hashchange", sync)
    return () => window.removeEventListener("hashchange", sync)
  }, [])
  const state: EvidenceState = count === 0 ? "ready" : deficits.isError ? "unavailable" : deficits.data ? "ready" : "fetching"
  return (
    <Section id="deficits" title="Recognised deficits">
      <dl className="grid gap-2 sm:grid-cols-2 sm:gap-x-8">
        <SummaryRow label="Deficits recognised" className="border-b pb-2" testId="deficit-count">
          {count}
        </SummaryRow>
        <SummaryRow label="Total written off" className="border-b pb-2" testId="deficit-total">
          {usdg(vault.totalDeficit, 6)}
        </SummaryRow>
      </dl>
      <EvidenceSheet
        title="Deficits"
        triggerLabel="Deficits"
        summary="LendingVault deficit history"
        state={state}
        open={open}
        onOpenChange={setOpen}
        testId="lend-deficits-sheet"
        evidenceFor="deficits"
        statusMessage="The deficit history could not be read from the vault."
        onRetry={() => void deficits.refetch()}
      >
        {count === 0 ? (
          <p data-testid="deficits-empty" className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No deficits recognised. Every liquidation so far was covered by its collateral or the gap reserve.
          </p>
        ) : deficits.data ? (
          <>
            <div className="hidden xl:block" data-testid="deficits-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Borrower</TableHead>
                    <TableHead className="text-right">Written off</TableHead>
                    <TableHead className="text-right">Share price (USDG)</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deficits.data.map((d) => (
                    <Row key={d.index} d={d} />
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="grid gap-3 xl:hidden">
              {deficits.data.map((d) => (
                <RowCard key={d.index} d={d} />
              ))}
            </ul>
          </>
        ) : null}
      </EvidenceSheet>
    </Section>
  )
}
