/**
 * The sandbox base built on Intatto's LIVE mainnet deployment (Node, build time): forks X Layer a little behind
 * the tip (after the mainnet deployment), keeps the core and the NVDAx market as the real mainnet contracts at
 * their mainnet addresses, impersonates the mainnet operator (owner and keeper) for sandbox-only changes, deploys
 * only the SPYx market on top (contracts/script/DeploySecondMarket.s.sol), then seeds the lender and the reserve
 * and posts the first keeper ticks. Every divergence from mainnet goes to the ledger.
 */
import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, rmSync } from "node:fs"
import { join, resolve } from "node:path"
import { promisify } from "node:util"
import { createPublicClient, fallback, formatUnits, http, maxUint256, parseAbi, type Address } from "viem"
import { marketDeploymentSchema, parseDeployment, type Deployment, type MarketDeployment } from "@intatto/config/deployments"
import { SANDBOX_CHAIN_ID, TICKERS, XLAYER_CHAIN_ID, xlayerRpcUrls } from "@intatto/config/xlayer"
import { relaxUsdgStaleness, SANDBOX_LENDER } from "../../../checks/fork/harness.ts"
import * as abi from "../../../checks/fork/lib/abis.ts"
import { fund, HOLDER } from "../../../checks/fork/lib/actors.ts"
import { ForkChain, Ledger } from "../../../checks/fork/lib/chain.ts"
import { context, keeperTick, type ScenarioContext } from "../../../checks/fork/lib/scenarios.ts"
import { startAnvil, type Anvil } from "../../../checks/fork/node/anvil.ts"
import { REPO } from "../../../checks/fork/node/deploy.ts"

const run = promisify(execFile)
/** Blocks behind the tip to fork, so every public RPC already serves that block's state. */
export const TIP_LAG = 20n
/** The sandbox lender's deposit, and the ticker cap each sandbox market gets so scenario borrowers fit under it. */
const LENDER_USDG = 50_000n * 10n ** 6n
const RESERVE_USDG = 100n * 10n ** 6n
const SANDBOX_CAP_USDG = 50_000n * 10n ** 6n
const OPERATOR_GAS_OKB = 10n ** 18n

const ownership = parseAbi(["function owner() view returns (address)", "function setInitialCap(address market, uint256 cap)"])

export type MainnetBase = {
  anvil: Anvil
  fork: ForkChain
  deployment: Deployment
  ctx: ScenarioContext
  mainnet: { deploymentFile: string; deploymentBlock: number; deployedAt: string; sandboxOnlyMarkets: MarketDeployment["symbol"][] }
}

export async function startMainnetFork(deploymentFile: string): Promise<MainnetBase> {
  const file = resolve(deploymentFile)
  const live = parseDeployment(JSON.parse(readFileSync(file, "utf8")))
  if (live.chainId !== XLAYER_CHAIN_ID) throw new Error(`${deploymentFile} is not an X Layer mainnet deployment (chainId ${live.chainId})`)
  if (live.markets.some((m) => m.symbol === "SPYx")) throw new Error(`${deploymentFile} already has a SPYx market`)
  const operator = live.operator as Address
  const mainnet = createPublicClient({ transport: fallback(xlayerRpcUrls().map((url) => http(url, { retryCount: 2, timeout: 20_000 }))) })
  const forkBlock = (await mainnet.getBlockNumber()) - TIP_LAG
  if (forkBlock <= BigInt(live.block)) throw new Error(`the tip (${forkBlock + TIP_LAG}) is not yet ${TIP_LAG} blocks past the deployment block ${live.block}`)

  const anvil = await startAnvil({ forkBlock: Number(forkBlock) })
  try {
    const fork = new ForkChain(anvil.rpcUrl, anvil.chainId, new Ledger())
    const at = () => fork.chainTime()
    for (const [name, address] of Object.entries({ vault: live.vault, gapReserve: live.gapReserve, depthCaps: live.depthCaps, liquidator: live.liquidator })) {
      const owner = await fork.read<Address>(address as Address, ownership, "owner")
      if (owner.toLowerCase() !== operator.toLowerCase()) throw new Error(`mainnet ${name} is owned by ${owner}, not the operator ${operator}`)
    }
    await fork.ledger.add({
      kind: "note",
      summary: `fork of X Layer mainnet at block ${forkBlock}, after Intatto's mainnet deployment at block ${live.block}: the core contracts and the NVDAx market are the live mainnet contracts at their mainnet addresses`,
      detail: { deploymentBlock: live.block, deployedAt: live.deployedAt, vault: live.vault, nvdaxMarket: live.markets[0].market },
      chainTime: await at(),
    })
    await fork.ledger.add({
      kind: "note",
      summary: `sandbox only: the mainnet keeper/owner ${operator} is impersonated on the fork (owner changes below, and every sandbox keeper post)`,
      detail: { operator, keeper: live.keeper },
      chainTime: await at(),
    })
    await fund(fork, operator, { okb: OPERATOR_GAS_OKB })

    const spyx = await deploySecondMarket(fork, live, operator)
    const deployment = parseDeployment({ ...live, chainId: SANDBOX_CHAIN_ID, markets: [...live.markets, spyx] })
    await fork.ledger.add({
      kind: "deploy",
      summary: `sandbox only: SPYx market deployed on the fork on top of the mainnet core (DeploySecondMarket.s.sol) and wired: vault.addMarket, reserve.setMarket, market.setLiquidator, liquidator.setMarket, caps.setInitialCap ${formatUnits(SANDBOX_CAP_USDG, 6)} USDG`,
      detail: { market: spyx.market, priceRelay: spyx.priceRelay, corporateActionGuard: spyx.corporateActionGuard, deployer: operator },
      chainTime: await at(),
    })
    await relaxUsdgStaleness(fork, deployment, operator)

    const nvda = deployment.markets[0]
    const mainnetCap = await fork.read<bigint>(deployment.depthCaps as Address, abi.depthCaps, "capOf", [nvda.market])
    if (mainnetCap < SANDBOX_CAP_USDG) {
      const hash = await fork.write(operator, deployment.depthCaps as Address, ownership, "setInitialCap", [nvda.market, SANDBOX_CAP_USDG])
      await fork.ledger.add({
        kind: "note",
        summary: `sandbox only: NVDAx ticker cap set from mainnet's ${formatUnits(mainnetCap, 6)} USDG to ${formatUnits(SANDBOX_CAP_USDG, 6)} USDG, sized to the sandbox lender, so scenario borrowers fit under it`,
        detail: { mainnetCapUsdg: formatUnits(mainnetCap, 6) },
        txHash: hash,
        chainTime: await at(),
      })
    }

    await fund(fork, SANDBOX_LENDER, { okb: 10n ** 16n, usdg: LENDER_USDG })
    await fork.write(SANDBOX_LENDER, deployment.usdg as Address, abi.erc20, "approve", [deployment.vault, maxUint256])
    await fork.write(SANDBOX_LENDER, deployment.vault as Address, abi.vault, "deposit", [LENDER_USDG, SANDBOX_LENDER])
    await fork.write(HOLDER, deployment.usdg as Address, abi.erc20, "approve", [deployment.gapReserve, RESERVE_USDG])
    const seed = await fork.write(HOLDER, deployment.gapReserve as Address, abi.reserve, "fund", [RESERVE_USDG])
    const reserve = await fork.read<bigint>(deployment.gapReserve as Address, abi.reserve, "balance")
    await fork.ledger.add({
      kind: "fund",
      summary: `gap reserve topped up with ${formatUnits(RESERVE_USDG, 6)} USDG from real holder (now ${formatUnits(reserve, 6)} USDG with mainnet's seed)`,
      txHash: seed,
      chainTime: await at(),
    })

    const ctx = context(fork, deployment)
    const tick = await keeperTick(ctx)
    if (!tick.accepted) throw new Error("the mainnet NVDAx relay rejected the sandbox keeper's first price post")
    return {
      anvil,
      fork,
      deployment,
      ctx,
      mainnet: { deploymentFile: deploymentFile, deploymentBlock: live.block, deployedAt: live.deployedAt, sandboxOnlyMarkets: ["SPYx"] },
    }
  } catch (e) {
    await anvil.stop()
    throw e
  }
}

/** Runs DeploySecondMarket.s.sol as the impersonated operator (forge --unlocked) and returns the SPYx entry. */
async function deploySecondMarket(fork: ForkChain, live: Deployment, operator: Address): Promise<MarketDeployment> {
  await fork.request("anvil_impersonateAccount", [operator])
  mkdirSync(join(REPO, "contracts", "cache"), { recursive: true })
  const out = join(REPO, "contracts", "cache", `second-market-${randomUUID()}.json`)
  const args = ["script", "script/DeploySecondMarket.s.sol:DeploySecondMarket", "--root", ".", "--rpc-url", fork.rpcUrl, "--broadcast", "--unlocked", "--sender", operator]
  await run("forge", [...args, "--slow", "--skip-simulation", "--gas-estimate-multiplier", "200"], {
    cwd: join(REPO, "contracts"),
    env: {
      ...process.env,
      CORE_VAULT: live.vault,
      CORE_RESERVE: live.gapReserve,
      CORE_SESSION: live.sessionRisk,
      CORE_CAPS: live.depthCaps,
      CORE_LIQUIDATOR: live.liquidator,
      CORE_RATES: live.interestRateModel,
      DEPLOY_KEEPER: live.keeper,
      DEPLOY_INITIAL_CAP_USDG: SANDBOX_CAP_USDG.toString(),
      DEPLOY_OUT: out,
    },
    maxBuffer: 64 * 1024 * 1024,
    timeout: 600_000,
  }).catch((e: { stdout?: string; stderr?: string }) => {
    throw new Error(`DeploySecondMarket failed:\n${(e.stdout ?? "").slice(-1500)}\n${(e.stderr ?? "").slice(-1500)}`)
  })
  const flat = JSON.parse(readFileSync(out, "utf8")) as Record<string, string>
  rmSync(out, { force: true })
  // forge's broadcast log for a throwaway fork is noise in the repo (the script refuses mainnet, so it only logs forks).
  rmSync(join(REPO, "contracts", "broadcast", "DeploySecondMarket.s.sol"), { recursive: true, force: true })
  const t = TICKERS.SPYx
  const spyx = marketDeploymentSchema.parse({
    symbol: "SPYx",
    market: flat["SPYx.market"],
    priceRelay: flat["SPYx.priceRelay"],
    corporateActionGuard: flat["SPYx.corporateActionGuard"],
    token: flat["SPYx.token"],
    wrapper: flat["SPYx.wrapper"],
    pool: flat["SPYx.pool"],
  })
  if (spyx.token.toLowerCase() !== t.token || spyx.wrapper.toLowerCase() !== t.wrapper || spyx.pool.toLowerCase() !== t.pool) {
    throw new Error("DeploySecondMarket wrote SPYx addresses that do not match config/xlayer.ts")
  }
  const code = await fork.client.getCode({ address: spyx.market as Address })
  if (!code || code === "0x") throw new Error(`the SPYx market ${spyx.market} has no code on the fork`)
  return spyx
}
