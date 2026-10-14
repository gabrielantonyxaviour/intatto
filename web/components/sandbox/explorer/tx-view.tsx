"use client"

import Link from "next/link"
import { useMemo, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { formatEther, formatGwei, isHash, type Hex } from "viem"
import { CircleCheckIcon, CircleXIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatTokenAmount } from "@/components/ui/web3/format"
import { RelativeTime, ShortHash } from "../display"
import { useIntatto } from "@/lib/chain"
import { decodeCall, decodeLogs, knownAddresses, nameOf } from "./decode"

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b py-3 last:border-b-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm">{children}</dd>
    </div>
  )
}

function Addr({ value, name }: { value: string | null | undefined; name: string | null }) {
  if (!value) return <span className="text-muted-foreground">Contract creation</span>
  return (
    <span className="grid gap-0.5">
      {name ? <span className="font-medium">{name}</span> : null}
      <ShortHash value={value} name="address" />
    </span>
  )
}

/** One fork transaction, read from the session's RPC: receipt, block, decoded call and events. */
export function TxView({ hash }: { hash: string }) {
  const { hydrated, sandbox, publicClient, chainId } = useIntatto()
  const valid = isHash(hash)
  const known = useMemo(() => (sandbox ? knownAddresses(sandbox) : null), [sandbox])

  const q = useQuery({
    queryKey: ["fork-tx", chainId, hash],
    enabled: hydrated && !!sandbox && valid,
    retry: 1,
    queryFn: async () => {
      const [tx, receipt] = await Promise.all([
        publicClient.getTransaction({ hash: hash as Hex }),
        publicClient.getTransactionReceipt({ hash: hash as Hex }),
      ])
      const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber })
      return { tx, receipt, block }
    },
  })

  if (!hydrated) return <Skeleton className="h-64" />
  if (!sandbox) {
    return (
      <Alert variant="info">
        <AlertTitle>No sandbox session in this browser</AlertTitle>
        <AlertDescription><p>
          This explorer reads the fork your sandbox session runs. <Link className="underline underline-offset-4" href="/sandbox">Start a session</Link> first.
        </p></AlertDescription>
      </Alert>
    )
  }
  if (!valid) return <Alert variant="destructive"><AlertTitle>That is not a transaction hash</AlertTitle><AlertDescription className="font-mono break-all">{hash}</AlertDescription></Alert>
  if (q.isPending) return <Skeleton className="h-96" />
  if (q.isError || !q.data || !known) {
    return (
      <Alert variant="destructive">
        <AlertTitle>This fork has no transaction with that hash</AlertTitle>
        <AlertDescription>It may belong to another session, or this session&apos;s chain has stopped.</AlertDescription>
      </Alert>
    )
  }

  const { tx, receipt, block } = q.data
  const ok = receipt.status === "success"
  const call = decodeCall(known, tx.to, tx.input)
  const logs = decodeLogs(known, receipt.logs)
  const forked = Number(receipt.blockNumber) - sandbox.forkBlock

  return (
    <div className="grid gap-6" data-testid="fork-tx">
      <Card>
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={ok ? "success-light" : "destructive-light"}>
              {ok ? <CircleCheckIcon aria-hidden /> : <CircleXIcon aria-hidden />}
              {ok ? "Success" : "Reverted"}
            </Badge>
            {call ? <Badge variant="outline" className="font-mono">{call.fn}()</Badge> : null}
          </div>
          <CardTitle className="flex flex-wrap items-center gap-2 font-mono text-base break-all">
            <ShortHash value={tx.hash} name="transaction hash" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <Row label="Block">
              <Link href={`/sandbox/explorer#block-${receipt.blockNumber}`} className="font-mono underline underline-offset-4">
                {receipt.blockNumber.toString()}
              </Link>
              <span className="text-muted-foreground"> · {forked} blocks after the fork of X Layer block {sandbox.forkBlock.toLocaleString("en-US")}</span>
            </Row>
            <Row label="Block hash">{block.hash ? <ShortHash value={block.hash} /> : "Pending"}</Row>
            <Row label="Parent hash"><ShortHash value={block.parentHash} /></Row>
            <Row label="Chain time"><RelativeTime timestamp={block.timestamp} /></Row>
            <Row label="From"><Addr value={tx.from} name={nameOf(known, tx.from)} /></Row>
            <Row label="To"><Addr value={tx.to} name={nameOf(known, tx.to)} /></Row>
            <Row label="Value"><span title={`${formatEther(tx.value)} OKB`} className="tabular-nums">{formatTokenAmount(tx.value, 18, { maxFractionDigits: 4 })} OKB</span></Row>
            <Row label="Gas used">{receipt.gasUsed.toLocaleString("en-US")} at <span title={`${formatGwei(receipt.effectiveGasPrice)} gwei`}>{formatTokenAmount(receipt.effectiveGasPrice, 9, { maxFractionDigits: 4 })} gwei</span></Row>
            <Row label="Nonce · position">{tx.nonce} · index {receipt.transactionIndex} in its block</Row>
            <Row label="Chain">Sandbox chain {sandbox.chainId}, a fork of X Layer mainnet (196)</Row>
          </dl>
        </CardContent>
      </Card>

      {call ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Call: <span className="font-mono">{call.fn}</span></CardTitle></CardHeader>
          <CardContent>
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">Decoded arguments & raw input</summary>
              <dl>{call.args.map((a) => <Row key={a.name} label={a.name}><span className="break-all font-mono">{a.value}</span></Row>)}</dl>
              <p className="mt-2 font-mono break-all">{tx.input}</p>
            </details>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle className="text-base">Events ({logs.length})</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {logs.length === 0 ? <p className="text-sm text-muted-foreground">This transaction emitted no events.</p> : null}
          {logs.map((l) => (
            <div key={l.index} className="grid gap-2 rounded-md border p-3" data-testid="fork-tx-log">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-xs text-muted-foreground">#{l.index}</span>
                <span className="font-medium">{l.event ?? "Unknown event"}</span>
                <span className="text-sm text-muted-foreground">{l.contract ?? l.address}</span>
              </div>
              <details className="min-w-0">
                <summary className="cursor-pointer text-xs text-muted-foreground">Event values</summary>
              {l.args.length ? (
                <dl className="mt-2 grid gap-1 text-xs">
                  {l.args.map((a) => (
                    <div key={a.name} className="grid gap-x-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                      <dt className="text-muted-foreground">{a.name}</dt>
                      <dd className="font-mono break-all">{nameOf(known, a.value) ? `${nameOf(known, a.value)} · ${a.value}` : a.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="font-mono text-xs break-all text-muted-foreground">{l.topics.join(" ")} {l.data}</p>
              )}
              </details>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
