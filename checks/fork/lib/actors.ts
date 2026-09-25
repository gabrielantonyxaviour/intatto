/**
 * Simulated actors on a fork: the funding holder, the keeper and an arbitrageur. Every action is a real
 * transaction against real X Layer contract code, recorded in the ledger. Nothing is ever minted.
 */
import { formatUnits, maxUint256, type Address } from "viem"
import { FORK_FUNDING_HOLDER, TICKERS, XLAYER } from "@intatto/config/xlayer"
import { sessionIndex, type Session } from "@intatto/config/session"
import type { Deployment, MarketDeployment } from "@intatto/config/deployments"
import * as abi from "./abis.ts"
import type { ForkChain } from "./chain.ts"

export const HOLDER = FORK_FUNDING_HOLDER as Address

export type FundAmounts = { okb?: bigint; nvdax?: bigint; spyx?: bigint; usdg?: bigint }

/** Moves existing balances from the real holder to `to` by impersonation (never minting). */
export async function fund(fork: ForkChain, to: Address, amounts: FundAmounts) {
  const t = await fork.chainTime()
  if (amounts.okb) {
    const hash = await fork.send(HOLDER, to, "0x", amounts.okb)
    await fork.ledger.add({ kind: "fund", summary: `${formatUnits(amounts.okb, 18)} OKB from real holder ${HOLDER}`, detail: { to }, txHash: hash, chainTime: t })
  }
  const tokens: [keyof FundAmounts, Address, number, string][] = [
    ["nvdax", TICKERS.NVDAx.token, 18, "NVDAx"],
    ["spyx", TICKERS.SPYx.token, 18, "SPYx"],
    ["usdg", XLAYER.usdg, 6, "USDG"],
  ]
  for (const [key, token, decimals, symbol] of tokens) {
    const amount = amounts[key]
    if (!amount) continue
    const hash = await fork.write(HOLDER, token, abi.erc20, "transfer", [to, amount])
    await fork.ledger.add({
      kind: "fund",
      summary: `${formatUnits(amount, decimals)} ${symbol} transferred from real holder ${HOLDER}`,
      detail: { to, token },
      txHash: hash,
      chainTime: t,
    })
  }
}

/** Keeper posts through the deployed contracts, as the deployment's keeper account. */
export class ForkKeeper {
  constructor(
    private fork: ForkChain,
    private d: Deployment,
  ) {}

  private m(symbol: MarketDeployment["symbol"] = "NVDAx") {
    const found = this.d.markets.find((x) => x.symbol === symbol)
    if (!found) throw new Error(`no ${symbol} market in deployment`)
    return found
  }

  async session(session: Session, periodChangedAt: number) {
    const hash = await this.fork.write(this.d.keeper as Address, this.d.sessionRisk as Address, abi.sessionRisk, "postSession", [
      sessionIndex(session),
      BigInt(periodChangedAt),
    ])
    await this.fork.ledger.add({ kind: "keeper", summary: `keeper posted session ${session}`, detail: { periodChangedAt }, txHash: hash, chainTime: await this.fork.chainTime() })
    return hash
  }

  /** Posts a quote (USD per token, 18 dec). Returns whether the relay accepted it (it records rejections onchain). */
  async price(quoteE18: bigint, symbol: MarketDeployment["symbol"] = "NVDAx", fetchedAt?: number) {
    const now = await this.fork.chainTime()
    const relay = this.m(symbol).priceRelay as Address
    const hash = await this.fork.write(this.d.keeper as Address, relay, abi.priceRelay, "post", [quoteE18, BigInt(fetchedAt ?? now)])
    const [stored] = await this.fork.read<[bigint, bigint]>(relay, abi.priceRelay, "latestPrice")
    const accepted = stored === quoteE18
    await this.fork.ledger.add({
      kind: "keeper",
      summary: `keeper posted ${symbol} quote $${formatUnits(quoteE18, 18)} (${accepted ? "accepted" : "rejected by the relay guards"})`,
      txHash: hash,
      chainTime: now,
    })
    return { hash, accepted }
  }

  async cap(targetUsdg: bigint, sliceUsdg: bigint, symbol: MarketDeployment["symbol"] = "NVDAx") {
    const hash = await this.fork.write(this.d.keeper as Address, this.d.depthCaps as Address, abi.depthCaps, "post", [
      this.m(symbol).market,
      targetUsdg,
      sliceUsdg,
    ])
    await this.fork.ledger.add({ kind: "keeper", summary: `keeper posted ${symbol} depth cap ${formatUnits(targetUsdg, 6)} USDG`, txHash: hash, chainTime: await this.fork.chainTime() })
    return hash
  }

  async action(activationAt: number, expectedMultiplier: bigint, symbol: MarketDeployment["symbol"] = "NVDAx") {
    const guard = this.m(symbol).corporateActionGuard as Address
    const hash = await this.fork.write(this.d.keeper as Address, guard, abi.corporateAction, "postAction", [BigInt(activationAt), expectedMultiplier])
    await this.fork.ledger.add({ kind: "keeper", summary: `keeper posted pending corporate action for ${symbol}`, detail: { activationAt, expectedMultiplier: expectedMultiplier.toString() }, txHash: hash, chainTime: await this.fork.chainTime() })
    return hash
  }

  async liquidate(borrower: Address, symbol: MarketDeployment["symbol"] = "NVDAx") {
    const hash = await this.fork.write(this.d.keeper as Address, this.d.liquidator as Address, abi.liquidator, "liquidate", [this.m(symbol).market, borrower], 3_000_000n)
    await this.fork.ledger.add({ kind: "keeper", summary: `keeper ran a bounded liquidation slice for ${borrower}`, txHash: hash, chainTime: await this.fork.chainTime() })
    return hash
  }
}

/** USDG per whole wrapper share at the pool's spot price (6 decimals as a JS number of USD). */
export async function poolWrapperPrice(fork: ForkChain, symbol: MarketDeployment["symbol"] = "NVDAx"): Promise<number> {
  const t = TICKERS[symbol]
  const [sqrtPriceX96] = await fork.read<[bigint]>(t.pool, abi.pool, "slot0")
  const token0 = (await fork.read<Address>(t.pool, abi.pool, "token0")).toLowerCase()
  const ratio = (Number(sqrtPriceX96) / 2 ** 96) ** 2 // token1 per token0, raw units
  const usdgIsToken0 = token0 === XLAYER.usdg.toLowerCase()
  return usdgIsToken0 ? (1 / ratio) * 1e12 : ratio * 1e12
}

/** The issuer-unit quote (USD per token, 18 dec) consistent with the pool's spot: wrapper price / assets per share. */
export async function poolImpliedQuote(fork: ForkChain, symbol: MarketDeployment["symbol"] = "NVDAx"): Promise<bigint> {
  const t = TICKERS[symbol]
  const perShare = await poolWrapperPrice(fork, symbol)
  const assetsPerShare = await fork.read<bigint>(t.wrapper, abi.wrapper, "convertToAssets", [10n ** 18n])
  const quote = (perShare * 1e18) / Number(assetsPerShare)
  return BigInt(Math.round(quote * 1e6)) * 10n ** 12n
}

/**
 * A simulated arbitrageur (the real holder) sells wrapper shares into the real pool until its spot price falls
 * by `dropBps`, the way issuer arbitrage would move the pool at a reopen. Recorded as a simulated actor.
 */
export async function arbitrageDown(fork: ForkChain, dropBps: number, symbol: MarketDeployment["symbol"] = "NVDAx") {
  const t = TICKERS[symbol]
  const [sqrtPriceX96] = await fork.read<[bigint]>(t.pool, abi.pool, "slot0")
  const token0 = (await fork.read<Address>(t.pool, abi.pool, "token0")).toLowerCase()
  const usdgIsToken0 = token0 === XLAYER.usdg.toLowerCase()
  const factor = Math.sqrt(10_000 / (10_000 - dropBps))
  const limit = usdgIsToken0
    ? (sqrtPriceX96 * BigInt(Math.round(factor * 1e9))) / 10n ** 9n
    : (sqrtPriceX96 * 10n ** 9n) / BigInt(Math.round(factor * 1e9))
  // Keep some of the holder's tokens back so later burner funding in the same session still works.
  const keepBack = 200n * 10n ** 18n
  const tokenBalance = await fork.read<bigint>(t.token, abi.erc20, "balanceOf", [HOLDER])
  const before = await poolWrapperPrice(fork, symbol)
  if (tokenBalance > keepBack) {
    await fork.write(HOLDER, t.token, abi.erc20, "approve", [t.wrapper, maxUint256])
    await fork.write(HOLDER, t.wrapper, abi.wrapper, "deposit", [tokenBalance - keepBack, HOLDER])
  }
  const shares = await fork.read<bigint>(t.wrapper, abi.wrapper, "balanceOf", [HOLDER])
  await fork.write(HOLDER, t.wrapper, abi.erc20, "approve", [XLAYER.swapRouter02, maxUint256])
  const hash = await fork.write(
    HOLDER,
    XLAYER.swapRouter02,
    abi.swapRouter02,
    "exactInputSingle",
    [{ tokenIn: t.wrapper, tokenOut: XLAYER.usdg, fee: t.poolFee, recipient: HOLDER, amountIn: shares, amountOutMinimum: 0n, sqrtPriceLimitX96: limit }],
    12_000_000n,
  )
  const after = await poolWrapperPrice(fork, symbol)
  await fork.ledger.add({
    kind: "actor",
    summary: `simulated arbitrageur (real holder ${HOLDER}) sold w${symbol} into the real pool: $${before.toFixed(2)} → $${after.toFixed(2)}`,
    detail: { dropBps },
    txHash: hash,
    chainTime: await fork.chainTime(),
  })
  return { before, after }
}
