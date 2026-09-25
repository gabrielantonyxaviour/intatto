import type { Side } from "./rpc"

export type CheckId = "blocks" | "bytecode" | "state" | "intatto"

export type CheckStatus = "running" | "pass" | "fail" | "unreachable" | "refused" | "skipped"

export type Outcome<E> =
  | { status: "running" }
  | { status: "pass" | "fail"; evidence: E; finishedAt: number }
  | { status: "unreachable"; side: Side; url: string; message: string; finishedAt: number }
  /** The RPC answered a read with a JSON-RPC error (not a revert): it is up, but would not serve this read. */
  | { status: "refused"; side: Side; url: string; message: string; code: number | null; method: string | null; finishedAt: number }
  | { status: "skipped"; reason: string }

/** What the page was asked to check: which RPC, at which fork block, and which Intatto addresses. */
export type ProofInputs = {
  sandboxRpc: string
  rpcSource: "session" | "query"
  /** Null until known: from the session, `?block=`, or the RPC's own anvil_metadata. */
  forkBlock: bigint | null
  blockSource: "session" | "query" | null
  sessionId: string | null
  apiUrl: string | null
  deployment: import("@intatto/config/deployments").Deployment | null
}
