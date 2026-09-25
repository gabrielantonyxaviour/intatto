/**
 * Check 4: each Intatto contract's runtime code on the sandbox, with immutables masked, equals
 *  - the mainnet deployment's code at the same role (once Intatto is deployed on X Layer), or
 *  - this repo's build artifacts (before that), and the page says which comparison ran.
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
  /** Mainnet address compared against, in "mainnet" mode. */
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

export type IntattoEvidence = { comparison: Comparison; compiler: string; rows: IntattoRow[]; missing: string[] }

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

export async function checkIntatto(sandbox: ProofClient, reference: ProofClient, deployment: Deployment, live: Deployment | null) {
  const comparison: Comparison = live ? "mainnet" : "artifacts"
  const liveById = new Map(live ? intattoTargets(live).map((t) => [t.id, t.address]) : [])
  const missing: string[] = []

  const rows = await Promise.all(
    intattoTargets(deployment).map(async (t): Promise<IntattoRow | null> => {
      const artifact = INTATTO_ARTIFACTS[t.contract]
      const referenceAddress = comparison === "mainnet" ? ((liveById.get(t.id) as Hex | undefined) ?? null) : null
      if (comparison === "mainnet" && !referenceAddress) {
        missing.push(`${t.label}: no address in the mainnet deployment`)
        return null
      }
      const [onSandbox, expectedCode] = await Promise.all([
        getCode(sandbox, t.address, "latest"),
        comparison === "mainnet" ? getCode(reference, referenceAddress!, "latest").then((c) => c.code) : Promise.resolve(artifact.bytecode),
      ])
      const hasCode = onSandbox.size > 0
      const masked = hasCode ? maskImmutables(onSandbox.code, artifact.immutables) : null
      const expectedMasked = expectedCode.length > 2 ? maskImmutables(expectedCode, artifact.immutables) : null
      const maskedHash = masked ? keccak256(masked) : null
      const expectedMaskedHash = expectedMasked ? keccak256(expectedMasked) : null
      const equal = maskedHash !== null && maskedHash === expectedMaskedHash
      return {
        id: t.id,
        label: t.label,
        contract: t.contract,
        address: t.address,
        referenceAddress,
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
  const present = rows.filter((r): r is IntattoRow => r !== null)
  const pass = present.length > 0 && present.every((r) => r.equal) && missing.length === 0
  return { pass, evidence: { comparison, compiler: ARTIFACTS_COMPILER, rows: present, missing } satisfies IntattoEvidence }
}
