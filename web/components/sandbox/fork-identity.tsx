"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { ShieldCheckIcon, ShieldXIcon } from "lucide-react"
import { SANDBOX_CHAIN_ID, XLAYER_CHAIN_ID } from "@intatto/config/xlayer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CopyButton, EvidenceSheet } from "@/components/ui/ix"
import { formatNumber, formatUtc } from "@/components/ui/web3/format"
import { probeAdminMethod } from "./api"
import { REFUSED_METHODS, SEED_LABEL } from "./copy"

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

function Fact({ term, children, testId }: { term: string; children: ReactNode; testId?: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="min-w-0 text-sm" data-testid={testId}>
        {children}
      </dd>
    </div>
  )
}

export type ForkFactsProps = {
  chainId: number | undefined
  forkBlock: number | undefined
  snapshotCreatedAt?: string
  markets?: string[]
  session?: { sessionId: string; rpcUrl: string } | null
  apiUrl?: string | null
  loading?: boolean
  /** Visible price-source line. Sandbox wording, never the live issuer-quote label. */
  priceNote: string
  /** How a session is created; shown in Session details, not on the compact strip. */
  startMethod?: string
}

/** Fork block, chain id, seed and price source. These stay on the page, not inside Session details. */
export function CompactFacts({ chainId, forkBlock, loading, priceNote }: ForkFactsProps) {
  return (
    <div className="grid gap-2">
      <dl className="grid gap-3 sm:grid-cols-3">
        <Fact term="Parent network">X Layer mainnet · {XLAYER_CHAIN_ID}</Fact>
        <Fact term="Fork block">
          {loading ? <Skeleton className="h-4 w-28" /> : forkBlock !== undefined ? <span className="font-mono tabular-nums" data-testid="identity-fork-block">{formatNumber(forkBlock)}</span> : <span data-testid="identity-fork-block">–</span>}
        </Fact>
        <Fact term="Sandbox chain id">
          {loading ? <Skeleton className="h-4 w-24" /> : <span className="font-mono" data-testid="identity-chain-id">{chainId ?? SANDBOX_CHAIN_ID}</span>}
        </Fact>
      </dl>
      <p className="text-sm text-muted-foreground" data-testid="seed-snapshot">
        {SEED_LABEL}
      </p>
      <p className="text-sm" data-testid="sandbox-price-source">
        {priceNote}
      </p>
    </div>
  )
}

function DetailRow({ term, children, testId }: { term: string; children: ReactNode; testId?: string }) {
  return (
    <div className="grid gap-1 border-b py-2.5 last:border-b-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{term}</dt>
      <dd className="min-w-0 text-sm break-words" data-testid={testId}>
        {children}
      </dd>
    </div>
  )
}

/** RPC, API, chain configuration and the public-RPC refusal probe. No burner secret. */
export function SessionDetailsBody({ chainId, forkBlock, snapshotCreatedAt, markets, session, apiUrl, loading, startMethod }: ForkFactsProps) {
  return (
    <dl>
      <DetailRow term="Parent network">X Layer mainnet · chain {XLAYER_CHAIN_ID}</DetailRow>
      <DetailRow term="Sandbox chain id">{loading ? "…" : (chainId ?? SANDBOX_CHAIN_ID)}</DetailRow>
      <DetailRow term="Fork block">
        {forkBlock !== undefined ? formatNumber(forkBlock) : "–"}
        {snapshotCreatedAt ? <span className="text-muted-foreground"> · snapshot built {formatUtc(Date.parse(snapshotCreatedAt) / 1000)}</span> : null}
      </DetailRow>
      <DetailRow term="State sync">Off. The fork stays at the fork block; later X Layer blocks never reach it.</DetailRow>
      {markets?.length ? <DetailRow term="Markets">{markets.join(", ")}</DetailRow> : null}
      <DetailRow term="Public RPC" testId="identity-rpc">
        {session ? (
          <span className="grid gap-2">
            <code className="break-all font-mono text-xs">{session.rpcUrl}</code>
            <CopyButton name="public RPC URL" value={session.rpcUrl} />
          </span>
        ) : (
          <span className="text-muted-foreground">Issued for each session when you start one.</span>
        )}
      </DetailRow>
      <DetailRow term="Admin methods">
        <p>
          Refused on the public RPC:{" "}
          {REFUSED_METHODS.map((m) => (
            <Badge key={m} variant="outline" className="mr-1 mb-1 font-mono">
              {m}
            </Badge>
          ))}
        </p>
        <p className="text-muted-foreground">Time travel, scenarios and reset run through the sandbox API, and each call is written to the ledger.</p>
        {session ? <AdminProbe rpcUrl={session.rpcUrl} /> : null}
      </DetailRow>
      {session ? (
        <DetailRow term="Session">
          <span className="grid gap-2">
            <span className="font-mono break-all">{session.sessionId}</span>
            <CopyButton name="session id" value={session.sessionId} />
          </span>
        </DetailRow>
      ) : null}
      <DetailRow term="Sandbox API">
        {apiUrl ? <code className="break-all font-mono text-xs">{apiUrl}</code> : <span className="text-muted-foreground">None for this session.</span>}
      </DetailRow>
      {startMethod ? <DetailRow term="How a session starts">{startMethod}</DetailRow> : null}
    </dl>
  )
}

export function SessionDetailsSheet(props: ForkFactsProps) {
  return (
    <EvidenceSheet
      title="Session details"
      summary="Chain configuration, public RPC and sandbox API. The burner key stays in this browser and is not shown here."
      state="ready"
      triggerLabel="Session details"
      testId="session-details"
    >
      <SessionDetailsBody {...props} />
    </EvidenceSheet>
  )
}

export function ProveForkLink() {
  return (
    <Button asChild variant="outline">
      <Link href="/sandbox/proof">Prove this is a real fork</Link>
    </Button>
  )
}
