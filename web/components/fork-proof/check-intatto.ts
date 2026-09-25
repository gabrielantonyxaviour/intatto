/**
 * Check 4: each Intatto contract's runtime code on the sandbox, with immutables masked, equals
 *  - the mainnet deployment's code at the same role (once Intatto is deployed on X Layer), or
 *  - this repo's build artifacts (before that, and always for sandbox-only markets such as SPYx, which have no
 *    mainnet counterpart). Each row says which comparison ran.
 */
import { keccak256, type Hex } from "viem"
import type { Deployment } from "@intatto/config/deployments"
import { ARTIFACTS_COMPILER, INTATTO_ARTIFACTS } from "./artifacts.generated"
import { intattoTargets, type ArtifactName } from "./intatto-contracts"
import { getCode, type ProofClient } from "./rpc"

export type Comparison = "artifacts" | "mainnet"

export type IntattoRow = {
  id: string
  label: string
  contract: ArtifactName
  address: Hex
  /** What this row was compared with. */
  comparedWith: Comparison
  /** In a market the sandbox adds on top of the mainnet deployment (no mainnet counterpart). */
  sandboxOnly: boolean
  /** Mainnet address compared against, when comparedWith is "mainnet". */
  referenceAddress: Hex | null
  size: number
  expectedSize: number
  maskedHash: Hex | null
  expectedMaskedHash: Hex | null
  /** Immutable byte ranges masked on both sides. */
  masked: number
  /** First differing byte offset after masking, when the code differs. */
  firstDiff: number | null
  equal: boolean
}

export type IntattoEvidence = { comparison: Comparison; compiler: string; rows: IntattoRow[]; sandboxOnlyMarkets: string[] }

/** Zeroes every immutable byte range, so code filled in by a constructor compares with the unfilled artifact. */
export function maskImmutables(code: Hex, ranges: readonly (readonly [number, number])[]): Hex {
  const parts: string[] = []
  let at = 0
  const body = code.slice(2)
  for (const [start, length] of ranges) {
    if ((start + length) * 2 > body.length) break
    parts.push(body.slice(at * 2, start * 2), "00".repeat(length))
    at = start + length
  }
  parts.push(body.slice(at * 2))
  return `0x${parts.join("")}` as Hex
}

function firstDifference(a: Hex, b: Hex): number | null {
  const n = Math.min(a.length, b.length)
  for (let i = 2; i < n; i += 2) if (a.slice(i, i + 2) !== b.slice(i, i + 2)) return (i - 2) / 2
  return a.length === b.length ? null : (n - 2) / 2
}

/**
 * `sandboxOnlyHint` (from the session API's /health) labels sandbox-only markets when there is no mainnet deployment
 * to tell; with one, a market is sandbox-only exactly when the mainnet deployment does not have it.
 */
export async function checkIntatto(
  sandbox: ProofClient,
  reference: ProofClient,
  deployment: Deployment,
  live: Deployment | null,
  sandboxOnlyHint: readonly string[] = [],
) {
  const comparison: Comparison = live ? "mainnet" : "artifacts"
  const liveById = new Map(live ? intattoTargets(live).map((t) => [t.id, t.address]) : [])
  const liveMarkets = new Set(live?.markets.map((m) => m.symbol) ?? [])
  const isSandboxOnly = (market: string | null) => market !== null && (live ? !liveMarkets.has(market as never) : sandboxOnlyHint.includes(market))

  const rows = await Promise.all(
    intattoTargets(deployment).map(async (t): Promise<IntattoRow> => {
      const artifact = INTATTO_ARTIFACTS[t.contract]
      const mainnetAddress = (liveById.get(t.id) as Hex | undefined) ?? null
      const sandboxOnly = isSandboxOnly(t.market) || (live !== null && mainnetAddress === null)
      const comparedWith: Comparison = live && mainnetAddress && !sandboxOnly ? "mainnet" : "artifacts"
      const [onSandbox, expectedCode] = await Promise.all([
        getCode(sandbox, t.address, "latest"),
        comparedWith === "mainnet" ? getCode(reference, mainnetAddress!, "latest").then((c) => c.code) : Promise.resolve(artifact.bytecode),
      ])
      const masked = onSandbox.size > 0 ? maskImmutables(onSandbox.code, artifact.immutables) : null
      const expectedMasked = expectedCode.length > 2 ? maskImmutables(expectedCode, artifact.immutables) : null
      const maskedHash = masked ? keccak256(masked) : null
      const expectedMaskedHash = expectedMasked ? keccak256(expectedMasked) : null
      const equal = maskedHash !== null && maskedHash === expectedMaskedHash
      return {
        id: t.id,
        label: t.label,
        contract: t.contract,
        address: t.address,
        comparedWith,
        sandboxOnly,
        referenceAddress: comparedWith === "mainnet" ? mainnetAddress : null,
        size: onSandbox.size,
        expectedSize: (expectedCode.length - 2) / 2,
        maskedHash,
        expectedMaskedHash,
        masked: artifact.immutables.length,
        firstDiff: equal || !masked || !expectedMasked ? null : firstDifference(masked, expectedMasked),
        equal,
      }
    }),
  )
  const sandboxOnlyMarkets = deployment.markets.map((m) => m.symbol).filter((m) => isSandboxOnly(m))
  const pass = rows.length > 0 && rows.every((r) => r.equal)
  return { pass, evidence: { comparison, compiler: ARTIFACTS_COMPILER, rows, sandboxOnlyMarkets } satisfies IntattoEvidence }
}
