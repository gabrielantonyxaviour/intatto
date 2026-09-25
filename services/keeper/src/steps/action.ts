/**
 * Pending corporate actions. Every multiplier schedule the keeper sees before activation is posted once to the
 * ticker's CorporateActionGuard via postAction(activationAt, expectedMultiplier), which stores the pre-action
 * multiplier and price for the guard's full continuity check. The token's own onchain schedule wins over the
 * issuer API: its multiplier is exact, while the API's is a float the guard's equality check could miss.
 */
import { formatUnits, type Address } from "viem"
import type { MarketDeployment } from "@intatto/config/deployments"
import { corporateActionGuardAbi, xstockAbi } from "../abi.ts"
import { read, sendCall, simulate } from "../chain.ts"
import type { StepContext } from "../context.ts"
import type { PendingAction } from "../issuer-parse.ts"
import { getJson, setJson } from "../types.ts"

type Target = { activationAt: number; expected: bigint; source: "onchain" | "issuer API"; reason: string | null }
type Posted = { activationAt: number; expected: string }

const MAX_UINT64 = 2n ** 64n - 1n

export async function onchainSchedule(ctx: StepContext, m: MarketDeployment): Promise<Target | null> {
  const token = { address: m.token as Address, abi: xstockAbi }
  const [newMultiplier, activation] = await Promise.all([
    read<bigint>(ctx, { ...token, functionName: "newMultiplier" }),
    read<bigint>(ctx, { ...token, functionName: "newMultiplierActivationTime" }),
  ])
  if (newMultiplier === 0n || activation <= BigInt(ctx.chainTime) || activation > MAX_UINT64) return null
  return { activationAt: Number(activation), expected: newMultiplier, source: "onchain", reason: null }
}

/** Posts the pending action once per (activationAt, expectedMultiplier); `fromIssuer` is the API's view. */
export async function postPendingAction(ctx: StepContext, m: MarketDeployment, fromIssuer: PendingAction | undefined) {
  const onchain = await onchainSchedule(ctx, m)
  const target: Target | null =
    onchain ??
    (fromIssuer ? { activationAt: fromIssuer.activationAt, expected: fromIssuer.expectedMultiplierE18, source: "issuer API", reason: fromIssuer.reason } : null)
  // postAction needs activationAt strictly after the block it lands in.
  if (!target || target.activationAt <= ctx.chainTime + 1) return

  const key = `action:${m.symbol}`
  const posted = await getJson<Posted>(ctx.state, key)
  if (posted && posted.activationAt === target.activationAt && posted.expected === target.expected.toString()) return

  const guard = { address: m.corporateActionGuard as Address, abi: corporateActionGuardAbi }
  const current = await read<{ activationAt: bigint; expectedMultiplier: bigint; active: boolean }>(ctx, { ...guard, functionName: "pendingAction" })
  const call = { ...guard, functionName: "postAction", args: [BigInt(target.activationAt), target.expected] }
  await simulate(ctx, call)
  const { hash } = await sendCall(ctx, call)
  await setJson(ctx.state, key, { activationAt: target.activationAt, expected: target.expected.toString() } satisfies Posted)
  const replaced = current.active && (Number(current.activationAt) !== target.activationAt || current.expectedMultiplier !== target.expected)
  await ctx.log({
    market: m.symbol,
    kind: "action",
    detail:
      `posted pending corporate action from the ${target.source}: multiplier → ${formatUnits(target.expected, 18)} at ` +
      `${new Date(target.activationAt * 1000).toISOString()}${target.reason ? ` (${target.reason})` : ""}${replaced ? "; replaced the previous pending action" : ""}`,
    data: { activationAt: target.activationAt, expectedMultiplierE18: target.expected.toString(), source: target.source },
    txHash: hash,
  })
}
