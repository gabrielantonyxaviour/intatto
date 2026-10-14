"use client"

import Link from "next/link"
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { ExternalLinkIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatUtc, shortAddress } from "@/components/ui/web3/format"
import { useIntatto } from "@/lib/chain"
import { decodeCall, knownAddresses, nameOf } from "./decode"

const SHOWN = 30

/** The session's chain, newest block first, down to the X Layer mainnet block it was forked from. */
export function BlocksView() {
  const { hydrated, sandbox, publicClient, chainId } = useIntatto()
  const known = useMemo(() => (sandbox ? knownAddresses(sandbox) : null), [sandbox])

  const q = useQuery({
    queryKey: ["fork-blocks", chainId],
    enabled: hydrated && !!sandbox,
    refetchInterval: 10_000,
    queryFn: async () => {
      const latest = await publicClient.getBlockNumber()
      const floor = BigInt(sandbox!.forkBlock)
      const from = latest - BigInt(SHOWN) + 1n > floor ? latest - BigInt(SHOWN) + 1n : floor
      const numbers: bigint[] = []
      for (let n = latest; n >= from; n--) numbers.push(n)
      return Promise.all(numbers.map((blockNumber) => publicClient.getBlock({ blockNumber, includeTransactions: true })))
    },
  })

  if (!hydrated) return <Skeleton className="h-64" />
  if (!sandbox) {
    return (
      <Alert variant="info">
        <AlertTitle>No sandbox session in this browser</AlertTitle>
        <AlertDescription>
          <Link className="underline underline-offset-4" href="/sandbox">Start a session</Link> to explore its chain.
        </AlertDescription>
      </Alert>
    )
  }
  if (q.isPending) return <Skeleton className="h-96" />
  if (q.isError || !known) return <Alert variant="destructive"><AlertTitle>Could not read this session&apos;s chain</AlertTitle><AlertDescription>The session may have expired. Start a new one on Sandbox.</AlertDescription></Alert>

  return (
    <div className="grid gap-3" data-testid="fork-blocks">
      {q.data.map((b) => {
        const isFork = Number(b.number) === sandbox.forkBlock
        return (
          <Card key={b.hash} id={`block-${b.number}`} className="scroll-mt-24 target:ring-2 target:ring-primary">
            <CardContent className="grid gap-2 py-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-base font-semibold">#{b.number?.toString()}</span>
                <span className="text-sm text-muted-foreground">{formatUtc(b.timestamp)}</span>
                <span className="text-sm text-muted-foreground">{b.transactions.length} tx</span>
                {isFork ? <Badge variant="info-light">Forked from X Layer mainnet</Badge> : null}
              </div>
              <dl className="grid gap-1 text-xs">
                <div className="grid gap-x-3 sm:grid-cols-[96px_minmax(0,1fr)]"><dt className="text-muted-foreground">Hash</dt><dd className="font-mono break-all">{b.hash}</dd></div>
                <div className="grid gap-x-3 sm:grid-cols-[96px_minmax(0,1fr)]"><dt className="text-muted-foreground">Parent</dt><dd className="font-mono break-all">{b.parentHash}</dd></div>
              </dl>
              {isFork ? (
                <a
                  href={`https://www.oklink.com/x-layer/block/${b.number}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-sm underline underline-offset-4"
                >
                  Compare this block hash on OKLink <ExternalLinkIcon aria-hidden className="size-3" />
                </a>
              ) : null}
              {!isFork && b.transactions.length ? (
                <ul className="grid gap-1">
                  {b.transactions.map((tx) => {
                    if (typeof tx === "string") return null
                    const call = decodeCall(known, tx.to, tx.input)
                    return (
                      <li key={tx.hash} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                        <Link href={`/sandbox/tx/${tx.hash}`} className="font-mono underline underline-offset-4">
                          {shortAddress(tx.hash, 8)}
                        </Link>
                        <span className="font-mono text-xs">{call ? `${call.fn}()` : "call"}</span>
                        <span className="text-muted-foreground">
                          {nameOf(known, tx.from) ?? shortAddress(tx.from)} → {nameOf(known, tx.to) ?? (tx.to ? shortAddress(tx.to) : "new contract")}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
