/** Runs contracts/script/Deploy.s.sol against a local fork with anvil's first dev account (Node only). */
import { execFile } from "node:child_process"
import { mkdirSync, readFileSync, rmSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { join, resolve } from "node:path"
import { promisify } from "node:util"
import type { Deployment } from "@intatto/config/deployments"
import { deploymentFromFlat } from "../lib/deployment.ts"

const run = promisify(execFile)
export const REPO = resolve(import.meta.dirname, "..", "..", "..")

/** Anvil's well-known dev accounts (public test keys, funded only on local forks). */
export const DEV = {
  deployer: {
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    key: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  },
  keeper: {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    key: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  },
} as const

export async function deployToFork(rpcUrl: string, opts: { spyx?: boolean; keeper?: string } = {}): Promise<Deployment> {
  // forge may only write inside paths foundry.toml grants: contracts/cache is one (and gitignored).
  mkdirSync(join(REPO, "contracts", "cache"), { recursive: true })
  const out = join(REPO, "contracts", "cache", `deploy-${randomUUID()}.json`)
  await run(
    "forge",
    ["script", "script/Deploy.s.sol:Deploy", "--root", ".", "--rpc-url", rpcUrl, "--broadcast", "--private-key", DEV.deployer.key, "--slow", "--skip-simulation"],
    {
      cwd: join(REPO, "contracts"),
      env: {
        ...process.env,
        DEPLOY_KEEPER: opts.keeper ?? DEV.keeper.address,
        DEPLOY_OUT: out,
        DEPLOY_SPYX: opts.spyx ? "true" : "false",
      },
      maxBuffer: 64 * 1024 * 1024,
      timeout: 600_000,
    },
  ).catch((e: { stdout?: string; stderr?: string }) => {
    throw new Error(`forge script failed:\n${(e.stdout ?? "").slice(-1500)}\n${(e.stderr ?? "").slice(-1500)}`)
  })
  const deployment = deploymentFromFlat(JSON.parse(readFileSync(out, "utf8")))
  rmSync(out, { force: true })
  return deployment
}
