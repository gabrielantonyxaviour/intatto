"use client"

import type { VaultState } from "@/lib/chain"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
      <TableCell className="text-right tabular-nums text-destructive">
        {changeText(d.sharePriceBefore, d.sharePriceAfter)}
      </TableCell>
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

/** Every deficit LendingVault has recognised: when, how much, and the share price before → after. */
export function DeficitsSection({ vault }: { vault: VaultState }) {
  const deficits = useDeficits(vault.deficitCount)
  const count = Number(vault.deficitCount)
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
          <ul className="grid gap-3 md:grid-cols-2 xl:hidden">
            {deficits.data.map((d) => (
              <RowCard key={d.index} d={d} />
            ))}
          </ul>
        </>
      ) : deficits.isError ? (
        <Alert variant="destructive">
          <AlertTitle>The deficit history could not be read</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            The RPC did not answer.
            <Button size="sm" variant="outline" onClick={() => void deficits.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <Skeleton className="h-20 w-full" />
      )}
    </Section>
  )
}
