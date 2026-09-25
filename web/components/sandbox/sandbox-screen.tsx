"use client"

import { useMemo } from "react"
import { privateKeyToAccount } from "viem/accounts"
import { InfoIcon, TriangleAlertIcon } from "lucide-react"
import { liveDeployment, useIntatto, type SandboxSession } from "@/lib/chain"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { isSessionGone, SandboxApiError } from "./api"
import { ActionOutcome, ResetControl, TimeTravel } from "./admin-controls"
import { ForkIdentity } from "./fork-identity"
import { LedgerTable } from "./ledger-table"
import { Scenarios } from "./scenarios"
import { SessionStatus } from "./session-status"
import { StartSession } from "./start-session"
import { ApiUnavailable, ControlsSkeleton, NoApi, RpcProblem, SessionGone } from "./states"
import { useAdminAction, useApiBase, useHealth, useLatestBlock, useLedger, useRpcChainId, useSessionInfo, type ApiBase } from "./use-sandbox"

const message = (e: unknown) => (e instanceof Error ? e.message.split("\n")[0]! : String(e))

/** No session yet: the fork's identity (from the service's health) and the creation form. */
function NoSessionView({ api }: { api: ApiBase }) {
  const health = useHealth(api.base)
  return (
    <>
      {!liveDeployment ? (
        <Alert variant="info" data-testid="sandbox-live-note">
          <InfoIcon aria-hidden />
          <AlertTitle>Intatto is not deployed on X Layer mainnet yet</AlertTitle>
          <AlertDescription>The sandbox is where to try it: the same contracts on a fork of X Layer, with a funded throwaway wallet.</AlertDescription>
        </Alert>
      ) : null}
      <ForkIdentity
        chainId={health.data?.chainId}
        forkBlock={health.data?.forkBlock}
        snapshotCreatedAt={health.data?.snapshotCreatedAt}
        markets={health.data?.markets}
        apiUrl={api.base}
        loading={health.isPending && !health.isError}
      />
      {health.isError ? <ApiUnavailable base={api.base} message={message(health.error)} onRetry={() => health.refetch()} /> : null}
      <StartSession base={api.base} health={health.data} />
    </>
  )
}

function goneReason(status: string | undefined, error: unknown): "expired" | "failed" | "missing" | null {
  if (status === "expired") return "expired"
  if (status === "failed") return "failed"
  if (isSessionGone(error)) {
    const e = error as SandboxApiError
    return e.status === 404 || e.code === "invalid_session_id" ? "missing" : e.code === "session_failed" ? "failed" : "expired"
  }
  return null
}

/** A stored session: its identity, the burner and chain state, the admin controls and the ledger. */
function SessionView({ api, sandbox }: { api: ApiBase; sandbox: SandboxSession }) {
  const base = api.base
  const info = useSessionInfo(base, sandbox.sessionId)
  const gone = goneReason(info.data?.status, info.error)
  const ledger = useLedger(base, sandbox.sessionId)
  const admin = useAdminAction(base, sandbox.sessionId)
  const rpcChain = useRpcChainId()
  const block = useLatestBlock()
  const burner = useMemo(() => privateKeyToAccount(sandbox.burnerKey).address, [sandbox.burnerKey])

  const wrongNetwork = rpcChain.data !== undefined && rpcChain.data !== sandbox.chainId
  const rpcDown = !gone && (rpcChain.isError || block.isError)
  const apiDown = Boolean(base) && info.isError && !gone

  return (
    <>
      <ForkIdentity
        chainId={sandbox.chainId}
        forkBlock={sandbox.forkBlock}
        session={{ sessionId: sandbox.sessionId, rpcUrl: sandbox.rpcUrl }}
        apiUrl={base}
      />
      {apiDown ? <ApiUnavailable base={base} message={message(info.error)} onRetry={() => info.refetch()} /> : null}
      {wrongNetwork ? (
        <RpcProblem
          kind="wrong-network"
          detail={`The RPC answers as chain ${rpcChain.data}, but this session is chain ${sandbox.chainId}. Balances and actions here would not match the session.`}
          onRetry={() => rpcChain.refetch()}
        />
      ) : rpcDown ? (
        <RpcProblem
          kind="unreachable"
          detail={message(rpcChain.error ?? block.error)}
          onRetry={() => {
            void rpcChain.refetch()
            void block.refetch()
          }}
        />
      ) : null}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <aside className="grid gap-4 lg:sticky lg:top-20 lg:order-2" aria-label="Session">
          <ActionOutcome admin={admin} />
          <SessionStatus burner={burner} lastActiveAt={info.data?.lastActiveAt} idleMinutes={info.data?.expiresAfterIdleMinutes} stopped={Boolean(gone)} />
        </aside>
        <div className="grid min-w-0 gap-6 lg:order-1">
          {!base ? (
            <NoApi />
          ) : gone ? (
            <SessionGone base={base} reason={gone} />
          ) : info.isPending ? (
            <ControlsSkeleton />
          ) : (
            <>
              <TimeTravel admin={admin} />
              <Scenarios admin={admin} />
              <ResetControl admin={admin} />
            </>
          )}
        </div>
      </div>
      {base ? <LedgerTable ledger={ledger} /> : null}
    </>
  )
}

/** The sandbox screen (pg_sandbox): identity → start → burner → time travel → scenarios → reset → ledger. */
export function SandboxScreen() {
  const { sandbox } = useIntatto()
  const api = useApiBase()
  return (
    <div className="grid gap-6" data-testid="sandbox-screen" data-mode={sandbox ? "session" : "none"}>
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold">Sandbox</h1>
        <p className="max-w-3xl text-muted-foreground">
          Prove the weekend and corporate-action behaviour yourself on a fork of X Layer mainnet: move the clock, replay a gap, and watch
          every screen follow. No real money moves.
        </p>
      </header>
      {api.overrideInvalid ? (
        <Alert variant="warning" data-testid="sandbox-bad-override">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>The api parameter is not an http(s) URL</AlertTitle>
          <AlertDescription>
            <p className="break-all">
              Ignored &ldquo;{api.override}&rdquo;; using {api.base}.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}
      {sandbox ? <SessionView key={sandbox.sessionId} api={api} sandbox={sandbox} /> : <NoSessionView api={api} />}
    </div>
  )
}
