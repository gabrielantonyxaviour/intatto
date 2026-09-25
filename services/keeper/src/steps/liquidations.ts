/**
 * Liquidation scan: borrowers are discovered from the market's Borrowed events, scanned forward from a stored
 * cursor in ≤100-block chunks (bounded per cycle); each liquidatable borrower gets one BoundedLiquidator slice
 * per cycle. A slice that would only wait again (its waiting clock already runs) is not sent.
 */
import { formatUnits, getAddress, getAbiItem, type Address } from "viem"
import type { MarketDeployment } from "@intatto/config/deployments"
import { boundedLiquidatorAbi, collateralMarketAbi } from "../abi.ts"
import { inBatches, read, revertName, sendCall, simulate, shortError, withRetry } from "../chain.ts"
import type { StepContext } from "../context.ts"
import { getJson, setJson } from "../types.ts"

const borrowedEvent = getAbiItem({ abi: collateralMarketAbi, name: "Borrowed" })

/** Scans Borrowed logs from the stored cursor; returns every known borrower. */
export async function discoverBorrowers(ctx: StepContext, m: MarketDeployment): Promise<{ borrowers: Address[]; scannedTo: bigint; chunks: number }> {
  const cursorKey = `cursor:${m.symbol}`
  const borrowersKey = `borrowers:${m.symbol}`
  const stored = await ctx.state.get(cursorKey)
  let cursor = stored !== null ? BigInt(stored) : BigInt(ctx.deployment.block) - 1n
  const known = new Set(await getJson<Address[]>(ctx.state, borrowersKey) ?? [])
  const before = known.size
  const latest = await withRetry(() => ctx.publicClient.getBlockNumber())
  let chunks = 0
  while (cursor < latest && chunks < ctx.o.maxLogChunksPerCycle) {
    const fromBlock = cursor + 1n
    const toBlock = fromBlock + ctx.o.logChunkBlocks - 1n < latest ? fromBlock + ctx.o.logChunkBlocks - 1n : latest
    const logs = await withRetry(() => ctx.publicClient.getLogs({ address: m.market as Address, event: borrowedEvent, fromBlock, toBlock }))
    for (const l of logs) if (l.args.user) known.add(getAddress(l.args.user))
    cursor = toBlock
    chunks++
  }
  if (known.size !== before) await setJson(ctx.state, borrowersKey, [...known])
  if (chunks > 0) await ctx.state.set(cursorKey, cursor.toString())
  return { borrowers: [...known], scannedTo: cursor, chunks }
}

export async function liquidateUnhealthy(ctx: StepContext, m: MarketDeployment) {
  const { borrowers } = await discoverBorrowers(ctx, m)
  if (borrowers.length === 0) return
  const market = { address: m.market as Address, abi: collateralMarketAbi }
  const checked = borrowers.slice(0, ctx.o.maxBorrowersPerCycle)
  const flags = await inBatches(checked, 20, async (who) => {
    const debt = await read<bigint>(ctx, { ...market, functionName: "debtOf", args: [who] })
    return debt > 0n && (await read<boolean>(ctx, { ...market, functionName: "isLiquidatable", args: [who] }))
  })
  const unhealthy = checked.filter((_, i) => flags[i]).slice(0, ctx.o.maxLiquidationsPerCycle)

  const liquidator = { address: ctx.deployment.liquidator as Address, abi: boundedLiquidatorAbi }
  for (const who of unhealthy) {
    try {
      const plan = await read<{ waiting: boolean; session: number; floorPrice: bigint }>(ctx, { ...liquidator, functionName: "previewSlice", args: [m.market, who] })
      if (plan.waiting) {
        const since = await read<bigint>(ctx, { ...liquidator, functionName: "waitingSince", args: [m.market, who] })
        if (since !== 0n) continue
      }
      const call = { ...liquidator, functionName: "liquidate", args: [m.market as Address, who] }
      const [sharesSold, proceeds] = await simulate<[bigint, bigint]>(ctx, call)
      const { hash } = await sendCall(ctx, call)
      await ctx.log({
        market: m.symbol,
        kind: "liquidation",
        detail:
          sharesSold === 0n
            ? `liquidation slice for ${who} is waiting: the pool cannot fill at the floor; the waiting clock started`
            : `liquidated a slice of ${who}: ${formatUnits(sharesSold, 18)} w${m.symbol} sold for ${formatUnits(proceeds, 6)} USDG`,
        data: { borrower: who, sharesSold: sharesSold.toString(), proceeds: proceeds.toString() },
        txHash: hash,
      })
    } catch (e) {
      const reason = revertName(e)
      await ctx.log({
        market: m.symbol,
        kind: "skipped",
        detail: reason ? `liquidation of ${who} not sent: the liquidator refuses with ${reason}` : `liquidation of ${who} failed: ${shortError(e)}`,
        data: { borrower: who, reason: reason ?? "rpc" },
      })
    }
  }
}
