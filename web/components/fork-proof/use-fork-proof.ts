"use client"

/** Runs the four fork-proof checks in this browser and keeps each one's outcome as it lands. */
import { useCallback, useEffect, useRef, useState } from "react"
import { XLAYER_CHAIN_ID } from "@intatto/config/xlayer"
import { LIVE_RPC_URLS, liveDeployment } from "@/lib/chain"
import { checkBlocks, type BlocksEvidence } from "./check-blocks"
import { checkBytecode, type BytecodeEvidence } from "./check-bytecode"
import { checkIntatto, type IntattoEvidence } from "./check-intatto"
import { checkState, type StateEvidence } from "./check-state"
import { fetchLedger, type LedgerState } from "./ledger"
import { Cancelled } from "./pacer"
import { chainId, pickReference, proofClient, reportedForkBlock, RpcUnreachable, type ProofClient, type ReferencePick } from "./rpc"
import type { CheckId, Outcome, ProofInputs } from "./types"

export type Checks = {
  blocks: Outcome<BlocksEvidence>
  bytecode: Outcome<BytecodeEvidence>
  state: Outcome<StateEvidence>
  intatto: Outcome<IntattoEvidence>
}

export type ProofRun = {
  id: number
  startedAt: number
  sandboxChainId: number | null
  sandboxError: string | null
  reference: ReferencePick | null
  forkBlock: bigint | null
  blockSource: ProofInputs["blockSource"] | "rpc"
  rpcForkBlock: bigint | null
  ledger: LedgerState
  checks: Checks
}

type Patch = (p: Partial<ProofRun> | ((r: ProofRun) => Partial<ProofRun>)) => void

const RUNNING = { status: "running" } as const
const CHECK_IDS: CheckId[] = ["blocks", "bytecode", "state", "intatto"]

function initial(id: number, inputs: ProofInputs): ProofRun {
  return {
    id,
    startedAt: Date.now(),
    sandboxChainId: null,
    sandboxError: null,
    reference: null,
    forkBlock: inputs.forkBlock,
    blockSource: inputs.blockSource,
    rpcForkBlock: null,
    ledger: { status: "loading" },
    checks: { blocks: RUNNING, bytecode: RUNNING, state: RUNNING, intatto: RUNNING },
  }
}

const every = <O extends Outcome<never>>(o: O): Partial<ProofRun> => ({ checks: { blocks: o, bytecode: o, state: o, intatto: o } })

async function settle<E>(fn: () => Promise<{ pass: boolean; evidence: E }>): Promise<Outcome<E>> {
  try {
    const { pass, evidence } = await fn()
    return { status: pass ? "pass" : "fail", evidence, finishedAt: Date.now() }
  } catch (e) {
    if (e instanceof Cancelled) return RUNNING
    if (e instanceof RpcUnreachable) return { status: "unreachable", side: e.side, url: e.url, message: e.message, finishedAt: Date.now() }
    return { status: "unreachable", side: "sandbox", url: "", message: e instanceof Error ? e.message : String(e), finishedAt: Date.now() }
  }
}

async function runChecks(inputs: ProofInputs, alive: () => boolean, patch: Patch) {
  const setCheck = <K extends CheckId>(k: K, o: Checks[K]) => patch((r) => ({ checks: { ...r.checks, [k]: o } }))
  const sandbox = proofClient("sandbox", inputs.sandboxRpc, alive)
  const ledgerP = fetchLedger(inputs.apiUrl, inputs.sessionId).then((ledger) => (patch({ ledger }), ledger))
  const [reference, sandboxId, rpcForkBlock] = await Promise.all([
    pickReference(LIVE_RPC_URLS, XLAYER_CHAIN_ID, alive),
    chainId(sandbox).then(
      (n) => ({ n, error: null }),
      (e: unknown) => {
        if (e instanceof Cancelled) throw e
        return { n: null, error: e instanceof Error ? e.message : String(e) }
      },
    ),
    reportedForkBlock(sandbox),
  ])
  const forkBlock = inputs.forkBlock ?? rpcForkBlock
  patch({
    reference,
    sandboxChainId: sandboxId.n,
    sandboxError: sandboxId.error,
    rpcForkBlock,
    forkBlock,
    blockSource: inputs.forkBlock !== null ? inputs.blockSource : rpcForkBlock !== null ? "rpc" : null,
  })

  if (forkBlock === null) {
    return patch(every({ status: "skipped", reason: "The fork block is unknown: add ?block=<number> or open this page from a sandbox session." }))
  }
  if (!reference.client) {
    const message = `no public X Layer RPC answered: ${reference.tried.map((t) => `${t.url} (${t.note})`).join("; ")}`
    return patch(every({ status: "unreachable", side: "reference", url: "", message, finishedAt: Date.now() }))
  }
  const ref: ProofClient = reference.client
  const deployment = inputs.deployment
  await Promise.all([
    settle(() => checkBlocks(sandbox, ref, forkBlock)).then((o) => setCheck("blocks", o)),
    settle(() => checkBytecode(sandbox, ref, forkBlock)).then((o) => setCheck("bytecode", o)),
    ledgerP.then((ledger) => settle(() => checkState(sandbox, ref, forkBlock, ledger))).then((o) => setCheck("state", o)),
    (deployment
      ? settle(() => checkIntatto(sandbox, ref, deployment, liveDeployment))
      : Promise.resolve<Checks["intatto"]>({
          status: "skipped",
          reason: "No Intatto addresses are known for this RPC. Open this page from a sandbox session to check Intatto's contracts.",
        })
    ).then((o) => setCheck("intatto", o)),
  ])
}

export function useForkProof(inputs: ProofInputs) {
  const [run, setRun] = useState<ProofRun>(() => initial(0, inputs))
  const current = useRef(0)

  const start = useCallback(async () => {
    const id = ++current.current
    const alive = () => current.current === id
    const patch: Patch = (p) => setRun((r) => (r.id !== id ? r : { ...r, ...(typeof p === "function" ? p(r) : p) }))
    setRun(initial(id, inputs))
    try {
      await runChecks(inputs, alive, patch)
    } catch (e) {
      // A superseded run just stops; anything else lands on every check still waiting.
      if (e instanceof Cancelled || !alive()) return
      const message = e instanceof Error ? e.message : String(e)
      patch((r) => {
        const checks = { ...r.checks }
        for (const k of CHECK_IDS) {
          if (checks[k].status === "running") checks[k] = { status: "unreachable", side: "sandbox", url: inputs.sandboxRpc, message, finishedAt: Date.now() }
        }
        return { checks }
      })
    }
  }, [inputs])

  useEffect(() => {
    void start()
    // Leaving the page (or React's dev double-mount) supersedes the run so its queued reads stop.
    return () => {
      current.current++
    }
  }, [start])

  const running = Object.values(run.checks).some((c) => c.status === "running")
  return { run, rerun: start, running }
}
