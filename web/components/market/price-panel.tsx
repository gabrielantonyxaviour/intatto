"use client"

import Link from "next/link"
import { useIntatto, usePriceProvenance, type MarketSymbol, type MarketState } from "@/lib/chain"
import { EvidenceSheet, type EvidenceState } from "@/components/ui/ix"
import { ExplorerLink } from "@/components/ui/web3/explorer-link"
import { priceBoundLines, type MarketTerms } from "./copy"
import { usePricePosts, type PricePost } from "./use-price-posts"
import { bps, formatUtc, usdPrice } from "./format"

function sheetState(pending: boolean, failed: boolean, count: number): EvidenceState {
  if (pending) return "fetching"
  if (failed) return "unavailable"
  if (count === 0) return "empty"
  return "ready"
}

function PostRows({ posts, mode }: { posts: PricePost[]; mode: "price" | "keeper" }) {
  return (
    <ol data-testid={mode === "price" ? "price-posts" : "keeper-records"} className="grid gap-2 text-sm">
      {posts.map((p) => (
        <li key={`${mode}-${p.txHash}`} className="grid gap-0.5 border-t pt-2 first:border-t-0 first:pt-0">
          <span className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="tabular-nums">{formatUtc(p.fetchedAt)}</span>
            {mode === "price" ? <span className="font-medium tabular-nums">{usdPrice(p.quoteE18)}</span> : <span>Accepted</span>}
          </span>
          <span className="text-xs text-muted-foreground">
            {mode === "price" ? (
              <>
                Accepted · {bps(p.deviationBps)} from TWAP · moved {bps(p.moveBps)}
              </>
            ) : (
              <>
                {usdPrice(p.quoteE18)} · {bps(p.deviationBps)} from TWAP · moved {bps(p.moveBps)} · block {p.blockNumber.toString()}
              </>
            )}
          </span>
          <ExplorerLink hash={p.txHash} className="text-xs text-muted-foreground" />
        </li>
      ))}
    </ol>
  )
}

/** Accepted price history and keeper post records, each one click, with the source named on the sheet. */
export function PriceEvidence({ symbol, state: s, terms }: { symbol: MarketSymbol; state: MarketState; terms: MarketTerms | undefined }) {
  const posts = usePricePosts(symbol, s.fetchedAt)
  const source = usePriceProvenance()
  const { deployment } = useIntatto()
  const pending = !posts.isError && !posts.data
  const failed = posts.isError
  const rows = failed ? [] : (posts.data?.posts ?? [])
  const partial = Boolean(deployment && posts.data && posts.data.scannedFrom > BigInt(deployment.block))
  const state: EvidenceState = pending ? "fetching" : failed ? "unavailable" : rows.length === 0 ? "empty" : partial ? "partial" : sheetState(false, false, rows.length)
  const poolNote = symbol === "SPYx" ? " This sheet is the SPYx market and its wSPYx/USDG pool, not the NVDAx pool." : ""
  return (
    <div className="flex flex-wrap gap-2">
      <EvidenceSheet
        title={`${symbol} price history`}
        triggerLabel="View price history"
        summary={`${source.short}. PriceRelayAdapter PricePosted logs.`}
        asOf={posts.data ? `Scanned from block ${posts.data.scannedFrom.toString()}` : undefined}
        state={state}
        onRetry={() => void posts.refetch()}
        evidenceFor="price-history"
        testId="price-history-sheet"
      >
        <div className="grid gap-3 text-sm">
          <p>{source.detail}{poolNote}</p>
          {terms ? (
            <ul className="grid list-disc gap-1 pl-5">
              {priceBoundLines(terms, symbol).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          <PostRows posts={rows} mode="price" />
        </div>
      </EvidenceSheet>
      <EvidenceSheet
        title={`${symbol} keeper records`}
        triggerLabel="View keeper records"
        summary="Accepted PricePosted logs from the active relay. Rejected posts are not in this list."
        asOf={posts.data ? `Scanned from block ${posts.data.scannedFrom.toString()}` : undefined}
        state={state}
        onRetry={() => void posts.refetch()}
        evidenceFor="keeper-records"
        testId="keeper-records-sheet"
      >
        <PostRows posts={rows} mode="keeper" />
      </EvidenceSheet>
      <p className="w-full text-sm text-muted-foreground">
        The relayed price next to the pool TWAP over time is on{" "}
        <Link href="/risk" data-testid="price-risk-link" className="font-medium text-foreground underline underline-offset-4">
          the Risk page
        </Link>
        .
      </p>
    </div>
  )
}
