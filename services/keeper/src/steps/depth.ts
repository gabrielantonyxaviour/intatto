/**
 * Depth cap: QuoterV2 sells of the wrapper for USDG at fixed sizes. The largest size whose average price stays
 * within depthSlippageBps of the smallest size's price sets the cap (its USDG out × haircut) and the CLOSED
 * liquidation slice (its USDG out × sliceBps). Posted when it moved more than capChangeBps or is older than
 * capMaxAgeSec.
 */
import { formatUnits, type Address } from "viem"
import { XLAYER } from "@intatto/config/xlayer"
import type { MarketDeployment } from "@intatto/config/deployments"
import { depthCapRegistryAbi, poolAbi, quoterV2Abi } from "../abi.ts"
import { diffBpsCeil, read, revertName, sendCall, simulate, withRetry } from "../chain.ts"
import type { CycleOptions, StepContext } from "../context.ts"
import { getJson, setJson } from "../types.ts"

export type DepthSample = { amountIn: bigint; out: bigint | null }
export type DepthCap = { amountIn: bigint; out: bigint; cap: bigint; slice: bigint; avgPriceE6: bigint; basePriceE6: bigint }
type PostedCap = { cap: string; slice: string; at: number }

/** Pure: the cap and slice from QuoterV2 samples (smallest size first); null when the smallest sell fails. */
export function capFromSamples(samples: DepthSample[], o: Pick<CycleOptions, "depthSlippageBps" | "capHaircutBps" | "sliceBps">): DepthCap | null {
  const base = samples[0]
  if (!base || base.out === null || base.out === 0n) return null
  const price = (s: { amountIn: bigint; out: bigint }) => (s.out * 10n ** 18n) / s.amountIn // USDG (6 dec) per share
  const basePrice = price({ amountIn: base.amountIn, out: base.out })
  let best = { amountIn: base.amountIn, out: base.out }
  for (const s of samples) {
    if (s.out === null) continue
    const p = price({ amountIn: s.amountIn, out: s.out })
    if (p * 10_000n >= basePrice * BigInt(10_000 - o.depthSlippageBps) && s.amountIn > best.amountIn) best = { amountIn: s.amountIn, out: s.out }
  }
  return {
    ...best,
    cap: (best.out * BigInt(o.capHaircutBps)) / 10_000n,
    slice: (best.out * BigInt(o.sliceBps)) / 10_000n,
    avgPriceE6: price(best),
    basePriceE6: basePrice,
  }
}

export async function sampleDepth(ctx: StepContext, m: MarketDeployment): Promise<DepthSample[]> {
  const fee = await read<number>(ctx, { address: m.pool as Address, abi: poolAbi, functionName: "fee" })
  const samples: DepthSample[] = []
  for (const amountIn of ctx.o.depthSizes) {
    try {
      const { result } = await withRetry(() =>
        ctx.publicClient.simulateContract({
          address: XLAYER.quoterV2,
          abi: quoterV2Abi,
          functionName: "quoteExactInputSingle",
          args: [{ tokenIn: m.wrapper as Address, tokenOut: ctx.deployment.usdg as Address, amountIn, fee, sqrtPriceLimitX96: 0n }],
        }),
      )
      samples.push({ amountIn, out: result[0] })
    } catch (e) {
      // A size the pool cannot fill reverts inside the quoter; any other failure is an RPC problem.
      if (revertName(e) === null && !/revert/i.test(e instanceof Error ? e.message : "")) throw e
      samples.push({ amountIn, out: null })
    }
  }
  return samples
}

export async function postDepthCap(ctx: StepContext, m: MarketDeployment) {
  const samples = await sampleDepth(ctx, m)
  const cap = capFromSamples(samples, ctx.o)
  if (!cap || cap.cap === 0n) {
    await ctx.log({ market: m.symbol, kind: "skipped", detail: "depth cap not posted: QuoterV2 could not fill the smallest wrapper sell" })
    return
  }
  const key = `cap:${m.symbol}`
  const last = await getJson<PostedCap>(ctx.state, key)
  const changed = !last || BigInt(last.cap) === 0n || diffBpsCeil(cap.cap, BigInt(last.cap)) > BigInt(ctx.o.capChangeBps)
  if (!changed && last && ctx.t - last.at < ctx.o.capMaxAgeSec) return

  const call = { address: ctx.deployment.depthCaps as Address, abi: depthCapRegistryAbi, functionName: "post", args: [m.market as Address, cap.cap, cap.slice] }
  await simulate(ctx, call)
  const { hash } = await sendCall(ctx, call)
  await setJson(ctx.state, key, { cap: cap.cap.toString(), slice: cap.slice.toString(), at: ctx.t } satisfies PostedCap)
  const usdg = (v: bigint) => Number(formatUnits(v, 6)).toLocaleString("en-US", { maximumFractionDigits: 2 })
  await ctx.log({
    market: m.symbol,
    kind: "cap",
    detail:
      `posted depth cap ${usdg(cap.cap)} USDG, slice ${usdg(cap.slice)} USDG: selling ${formatUnits(cap.amountIn, 18)} ` +
      `w${m.symbol} returns ${usdg(cap.out)} USDG at ${usdg(cap.avgPriceE6)}/share vs ${usdg(cap.basePriceE6)} at the smallest size`,
    data: { capUsdg: cap.cap.toString(), sliceUsdg: cap.slice.toString(), sizeShares: formatUnits(cap.amountIn, 18), outUsdg: cap.out.toString() },
    txHash: hash,
  })
}
