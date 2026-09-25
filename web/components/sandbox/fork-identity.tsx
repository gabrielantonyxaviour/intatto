"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { CheckIcon, CopyIcon, ShieldCheckIcon, ShieldXIcon } from "lucide-react"
import { SANDBOX_CHAIN_ID, XLAYER_CHAIN_ID } from "@intatto/config/xlayer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatNumber, formatUtc } from "@/components/ui/web3/format"
import { probeAdminMethod } from "./api"
import { REFUSED_METHODS } from "./copy"

export function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
        } catch {
          setCopied(false)
        }
      }}
    >
      {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
    </Button>
  )
}

function Row({ term, children, testId }: { term: string; children: ReactNode; testId?: string }) {
  return (
    <div className="grid gap-1 border-b py-2.5 last:border-b-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{term}</dt>
      <dd className="min-w-0 text-sm" data-testid={testId}>
        {children}
      </dd>
    </div>
  )
}

type ProbeState = { status: "idle" } | { status: "running" } | { status: "done"; refused: boolean; code?: number; message: string }

/** Sends evm_mine to the public RPC so anyone can see the refusal for themselves. */
function AdminProbe({ rpcUrl }: { rpcUrl: string }) {
  const [state, setState] = useState<ProbeState>({ status: "idle" })
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={state.status === "running"}
        onClick={async () => {
          setState({ status: "running" })
          setState({ status: "done", ...(await probeAdminMethod(rpcUrl, "evm_mine")) })
        }}
      >
        {state.status === "running" ? "Sending evm_mine…" : "Try evm_mine on it"}
      </Button>
      {state.status === "done" ? (
        <span role="status" data-testid="admin-probe" className="inline-flex items-center gap-1.5 text-sm">
          {state.refused ? <ShieldCheckIcon aria-hidden className="size-4 text-success" /> : <ShieldXIcon aria-hidden className="size-4 text-destructive" />}
          {state.refused ? `Refused${state.code !== undefined ? ` (${state.code})` : ""}: ${state.message}` : `Not refused: ${state.message}`}
        </span>
      ) : null}
    </div>
  )
}

export type ForkIdentityProps = {
  chainId: number | undefined
  forkBlock: number | undefined
  snapshotCreatedAt?: string
  markets?: string[]
  /** Present once a session exists: the per-session public RPC. */
  session?: { sessionId: string; rpcUrl: string } | null
  apiUrl: string | null
  loading?: boolean
}

/** The fork's identity first, like a virtual environment's home: parent, chain id, fork block, RPCs. */
export function ForkIdentity({ chainId, forkBlock, snapshotCreatedAt, markets, session, apiUrl, loading }: ForkIdentityProps) {
  return (
    <Card data-testid="fork-identity">
      <CardHeader>
        <CardTitle>
          <h2>Fork of X Layer mainnet</h2>
        </CardTitle>
        <CardDescription>The same contracts, tokens and pool state as X Layer at the fork block, on a chain of its own.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl>
          <Row term="Parent network">X Layer mainnet · chain {XLAYER_CHAIN_ID}</Row>
          <Row term="Sandbox chain id" testId="identity-chain-id">
            {loading ? <Skeleton className="h-4 w-24" /> : <span className="font-mono">{chainId ?? SANDBOX_CHAIN_ID}</span>}
          </Row>
          <Row term="Fork block" testId="identity-fork-block">
            {loading ? (
              <Skeleton className="h-4 w-32" />
            ) : forkBlock !== undefined ? (
              <>
                <span className="font-mono tabular-nums">{formatNumber(forkBlock)}</span>
                {snapshotCreatedAt ? (
                  <span className="text-muted-foreground"> · snapshot built {formatUtc(Date.parse(snapshotCreatedAt) / 1000)}</span>
                ) : null}
              </>
            ) : (
              "–"
            )}
          </Row>
          {markets?.length ? <Row term="Markets">{markets.join(", ")}</Row> : null}
          <Row term="Public RPC" testId="identity-rpc">
            {session ? (
              <>
                <span className="flex min-w-0 items-center gap-2">
                  <code className="min-w-0 break-all font-mono text-xs">{session.rpcUrl}</code>
                  <CopyValue value={session.rpcUrl} label="public RPC URL" />
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Issued for each session when you start one.</span>
            )}
          </Row>
          <Row term="Admin methods">
            <p>
              Refused on the public RPC:{" "}
              {REFUSED_METHODS.map((m) => (
                <Badge key={m} variant="outline" className="mr-1 mb-1 font-mono">
                  {m}
                </Badge>
              ))}
            </p>
            <p className="text-muted-foreground">
              Time travel, scenarios and reset run through the sandbox API below, and each call is written to the activity ledger.
            </p>
            {session ? <AdminProbe rpcUrl={session.rpcUrl} /> : null}
          </Row>
          {session ? (
            <Row term="Session">
              <span className="font-mono break-all">{session.sessionId}</span>
            </Row>
          ) : null}
          <Row term="Sandbox API">
            {apiUrl ? <code className="break-all font-mono text-xs">{apiUrl}</code> : <span className="text-muted-foreground">None for this session.</span>}
          </Row>
        </dl>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/sandbox/proof">Prove this is a real fork</Link>
        </Button>
        <span className="text-xs text-muted-foreground">Block hashes, bytecode and storage compared with X Layer mainnet, in your browser.</span>
      </CardFooter>
    </Card>
  )
}
