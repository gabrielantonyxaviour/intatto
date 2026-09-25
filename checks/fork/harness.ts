/**
 * The shared fork harness every later check stands on (Node only): starts anvil forked from X Layer at a
 * pinned block, deploys Intatto, seeds a lender, the reserve and a funded burner from real holders, posts a
 * session and a price as the keeper, and hands back everything a check needs.
 */
import { maxUint256, type Address, type Hex } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import type { Deployment } from "@intatto/config/deployments"
import { forkEnv, type ForkEnv } from "../lib/fork-env.ts"
import * as abi from "./lib/abis.ts"
import { ForkChain, Ledger } from "./lib/chain.ts"
import { fund, HOLDER } from "./lib/actors.ts"
import { context, keeperTick, type ScenarioContext } from "./lib/scenarios.ts"
import { startAnvil, type Anvil } from "./node/anvil.ts"
import { deployToFork, DEV } from "./node/deploy.ts"

export type ForkHarness = {
  anvil: Anvil
  fork: ForkChain
  deployment: Deployment
  ctx: ScenarioContext
  env: ForkEnv
  stop: () => Promise<void>
}

export type HarnessOptions = {
  spyx?: boolean
  /** USDG the sandbox lender deposits into the vault (6 dec). */
  lenderUsdg?: bigint
  /** USDG seeded into the gap reserve (6 dec). */
  reserveUsdg?: bigint
  burner?: { okb: bigint; nvdax: bigint; usdg: bigint }
  forkBlock?: number
}

/** The sandbox's seed lender: an address with no key, driven by impersonation on the fork only. */
export const SANDBOX_LENDER: Address = "0x0000000000000000000000000000000000001e00"

/**
 * Sandbox-only parameter change, written to the ledger: the forked Chainlink USDG/USD feed cannot update in
 * simulated time, so its staleness limit is widened to 30 days. The 1% peg band is still enforced.
 */
export async function relaxUsdgStaleness(fork: ForkChain, d: Deployment, owner: Address) {
  for (const m of d.markets) {
    const hash = await fork.write(owner, m.priceRelay as Address, [
      { type: "function", name: "setUsdgLimits", stateMutability: "nonpayable", inputs: [{ type: "uint256" }, { type: "uint256" }], outputs: [] },
    ] as const, "setUsdgLimits", [30n * 86_400n, 100n])
    await fork.ledger.add({
      kind: "note",
      summary: `sandbox only: ${m.symbol} relay USDG/USD staleness limit widened to 30 days (the forked feed cannot update in simulated time); peg band still 1%`,
      txHash: hash,
      chainTime: await fork.chainTime(),
    })
  }
}

export async function startForkHarness(opts: HarnessOptions = {}): Promise<ForkHarness> {
  const anvil = await startAnvil({ forkBlock: opts.forkBlock })
  try {
    const fork = new ForkChain(anvil.rpcUrl, anvil.chainId, new Ledger())
    const deployment = await deployToFork(anvil.rpcUrl, { spyx: opts.spyx })
    await fork.ledger.add({ kind: "deploy", summary: `Intatto deployed on the fork at block ${anvil.forkBlock}`, chainTime: await fork.chainTime() })
    await relaxUsdgStaleness(fork, deployment, DEV.deployer.address)

    const ctx = context(fork, deployment)
    const lenderUsdg = opts.lenderUsdg ?? 50_000n * 10n ** 6n
    const reserveUsdg = opts.reserveUsdg ?? 100n * 10n ** 6n
    await fund(fork, SANDBOX_LENDER, { okb: 10n ** 16n, usdg: lenderUsdg })
    await fork.write(SANDBOX_LENDER, deployment.usdg as Address, abi.erc20, "approve", [deployment.vault, maxUint256])
    await fork.write(SANDBOX_LENDER, deployment.vault as Address, abi.vault, "deposit", [lenderUsdg, SANDBOX_LENDER])
    await fork.write(HOLDER, deployment.usdg as Address, abi.erc20, "approve", [deployment.gapReserve, reserveUsdg])
    const seedHash = await fork.write(HOLDER, deployment.gapReserve as Address, abi.reserve, "fund", [reserveUsdg])
    await fork.ledger.add({ kind: "fund", summary: `gap reserve seeded with ${Number(reserveUsdg) / 1e6} USDG from real holder`, txHash: seedHash, chainTime: await fork.chainTime() })

    const tick = await keeperTick(ctx)
    if (!tick.accepted) throw new Error("the relay rejected the harness's first price post")

    const burnerKey: Hex = generatePrivateKey()
    const burnerAddress = privateKeyToAccount(burnerKey).address
    const b = opts.burner ?? { okb: 10n ** 17n, nvdax: 10n * 10n ** 18n, usdg: 1_000n * 10n ** 6n }
    await fund(fork, burnerAddress, b)

    const env = forkEnv({ rpcUrl: anvil.rpcUrl, chainId: anvil.chainId, forkBlock: anvil.forkBlock, deployment, burnerKey })
    return { anvil, fork, deployment, ctx, env, stop: anvil.stop }
  } catch (e) {
    await anvil.stop()
    throw e
  }
}

export { DEV, HOLDER }
