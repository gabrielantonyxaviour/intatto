/**
 * Fork proof (/sandbox/proof): the four checks run in the browser against a real local fork of X Layer and the
 * public X Layer RPC, go green, and each can be driven red, so none is decorative.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createPublicClient, http, keccak256, pad, parseAbi, toHex, type Hex } from "viem"
import { XLAYER, XLAYER_RPC_FALLBACKS } from "@intatto/config/xlayer"
import { startForkHarness, type ForkHarness } from "../fork/harness.ts"
import { REPO } from "../fork/node/deploy.ts"
import { writeArtifactsModule } from "../../web/components/fork-proof/generate-artifacts.ts"
import { test, expect, viewports, expectNoHorizontalScroll } from "./fixtures"

type PwPage = import("@playwright/test").Page
const USDG = XLAYER.usdg as Hex
const FEED = XLAYER.chainlinkUsdgUsd as Hex
const NVDAX = "0xc845b2894dbddd03858fd2d643b4ef725fe0849d" as Hex
const CHECKS = ["blocks", "bytecode", "state", "intatto"] as const
const RUN_TIMEOUT = 240_000

test.describe.configure({ mode: "serial" })

let h: ForkHarness

test.beforeAll(async () => {
  test.setTimeout(300_000)
  h = await startForkHarness()
  // The harness compiled and deployed from contracts/out; ship the same build to the page's check 4.
  writeArtifactsModule()
})

test.afterAll(async () => {
  await h?.stop()
})

async function statuses(page: PwPage) {
  return Object.fromEntries(await Promise.all(CHECKS.map(async (c) => [c, await page.locator(`[data-check="${c}"]`).getAttribute("data-status")])))
}

/** Waits until no check is running, then returns every check's status. */
async function settled(page: PwPage) {
  // The checks render (all "running") once the page hydrates; only then does "none running" mean finished.
  await expect(page.locator("[data-check]")).toHaveCount(4, { timeout: 120_000 })
  await expect(page.locator('[data-check][data-status="running"]')).toHaveCount(0, { timeout: RUN_TIMEOUT })
  return statuses(page)
}

async function rerun(page: PwPage) {
  const button = page.getByRole("button", { name: "Re-run checks" })
  await expect(button).toBeEnabled({ timeout: RUN_TIMEOUT })
  await button.click()
  await expect(page.locator('[data-check][data-status="running"]').first()).toBeVisible()
  return settled(page)
}

const row = (page: PwPage, check: string, id: string) => page.locator(`[data-check="${check}"] [data-row="${id}"]`)

/** Flips one byte of runtime code on the fork only, the way a tampered sandbox would. */
async function flipByte(address: Hex, offset: number) {
  const code = await h.fork.client.getCode({ address })
  if (!code) throw new Error(`no code at ${address}`)
  const at = 2 + offset * 2
  const byte = code.slice(at, at + 2) === "00" ? "01" : "00"
  await h.fork.request("anvil_setCode", [address, `${code.slice(0, at)}${byte}${code.slice(at + 2)}`])
}

test("all four checks pass in the browser, and the shown values equal direct reads", async ({ page, useFork }) => {
  test.setTimeout(420_000)
  const forkBlock = BigInt(h.env.forkBlock)
  const mainnet = createPublicClient({ transport: http(XLAYER_RPC_FALLBACKS[0], { retryCount: 4 }) })
  const mainnetHash = (await mainnet.getBlock({ blockNumber: forkBlock })).hash

  const rpcCalls: string[] = []
  page.on("request", (r) => {
    if (r.method() === "POST") rpcCalls.push(r.url())
  })
  await useFork(page, h.env)
  await page.setViewportSize(viewports.wide)
  await page.goto("/sandbox/proof")
  await expect(page.getByRole("heading", { name: "Fork proof" })).toBeVisible({ timeout: 120_000 })
  expect(await settled(page)).toEqual({ blocks: "pass", bytecode: "pass", state: "pass", intatto: "pass" })

  // Header pins the run: the fork's own RPC, its chain id and block, and the reproduce command.
  await expect(page.locator('[data-slot="sandbox-chain-id"]')).toContainText(String(h.env.chainId))
  await expect(page.locator('[data-slot="fork-block"]')).toHaveText(forkBlock.toLocaleString("en-US"))
  await expect(page.getByText(`anvil --fork-url https://xlayerrpc.okx.com --fork-block-number ${forkBlock} --chain-id 1960196`)).toBeVisible()
  await expect(page.locator('[data-slot="ledger"]')).toContainText("no session API")

  // Check 1: the fork block's hash as X Layer and the fork each report it.
  const forkRow = row(page, "blocks", `block-${forkBlock}`)
  const sandboxHash = (await h.fork.client.getBlock({ blockNumber: forkBlock })).hash
  expect(sandboxHash).toBe(mainnetHash)
  await expect(forkRow).toHaveAttribute("data-equal", "true")
  await expect(forkRow).toContainText(mainnetHash!)

  // Check 2: NVDAx's code hash at the fork block, read directly from the fork.
  const nvdaxCode = await h.fork.client.getCode({ address: NVDAX, blockNumber: forkBlock })
  await expect(row(page, "bytecode", NVDAX)).toContainText(keccak256(nvdaxCode!))
  await expect(page.locator('[data-check="bytecode"] [data-row]')).toHaveCount(14)

  // Check 3: USDG totalSupply at the fork block and its raw storage word.
  const supply = await h.fork.client.readContract({ address: USDG, abi: parseAbi(["function totalSupply() view returns (uint256)"]), functionName: "totalSupply", blockNumber: forkBlock })
  await expect(row(page, "state", "usdg.totalSupply")).toContainText(String(supply))
  await expect(row(page, "state", "u.usdg.supply")).toContainText(pad(toHex(supply)))

  // Check 4: compared with the build artifacts; MarketLens has no immutables, so its hash is the plain code hash.
  await expect(page.locator('[data-check="intatto"] [data-comparison="artifacts"]')).toBeVisible()
  const lensArtifact = JSON.parse(readFileSync(join(REPO, "contracts/out/MarketLens.sol/MarketLens.json"), "utf8")) as { deployedBytecode: { object: Hex } }
  const lensCode = await h.fork.client.getCode({ address: h.deployment.lens as Hex })
  expect(keccak256(lensCode!)).toBe(keccak256(lensArtifact.deployedBytecode.object))
  await expect(row(page, "intatto", "lens")).toContainText(keccak256(lensCode!))
  await expect(page.locator('[data-check="intatto"] [data-row][data-equal="true"]')).toHaveCount(await page.locator('[data-check="intatto"] [data-row]').count())

  // The browser itself called both RPCs; the app server was asked for nothing.
  expect(rpcCalls.some((u) => u.startsWith(h.env.rpcUrl))).toBe(true)
  expect(rpcCalls.some((u) => XLAYER_RPC_FALLBACKS.some((f) => u.startsWith(f)))).toBe(true)
  expect(rpcCalls.filter((u) => u.startsWith("http://127.0.0.1:3100/api"))).toEqual([])

  await expectNoHorizontalScroll(page)
  await page.screenshot({ path: "proof/fork-proof.png", fullPage: true })
  for (const [name, size] of [["768", viewports.medium], ["390", viewports.narrow]] as const) {
    await page.setViewportSize(size)
    await expectNoHorizontalScroll(page)
    await page.screenshot({ path: `proof/fork-proof-${name}.png`, fullPage: true })
  }
})

test("an altered storage slot turns the state check red with old → new, and back", async ({ page, useFork }) => {
  test.setTimeout(420_000)
  await useFork(page, h.env)
  await page.setViewportSize(viewports.wide)
  await page.goto("/sandbox/proof")
  expect((await settled(page)).state).toBe("pass")

  // USDG's totalSupply slot: no sandbox action writes it. Edit it on the fork only.
  const oldWord = (await h.fork.client.getStorageAt({ address: USDG, slot: "0x2" }))!
  const newWord = pad(toHex(BigInt(oldWord) + 1n))
  await h.fork.request("anvil_setStorageAt", [USDG, "0x2", newWord])

  expect(await rerun(page)).toEqual({ blocks: "pass", bytecode: "pass", state: "fail", intatto: "pass" })
  const changed = row(page, "state", "u.usdg.supply")
  await expect(changed).toHaveAttribute("data-equal", "false")
  await expect(changed.locator('[data-side="old"]')).toContainText(oldWord)
  await expect(changed.locator('[data-side="new"]')).toContainText(newWord)
  await expect(page.locator('[data-check="state"] [data-equal="false"]')).toHaveCount(1)
  await expect(page.locator('[data-check="state"] [data-slot="differences"]')).toContainText("Changed since the fork: USDG slot 0x2 (totalSupply)")
  await changed.scrollIntoViewIfNeeded()
  await page.screenshot({ path: "proof/fork-proof-red.png", fullPage: true })

  await h.fork.request("anvil_setStorageAt", [USDG, "0x2", oldWord])
  expect((await rerun(page)).state).toBe("pass")
})

test("replaced code turns the bytecode and Intatto checks red", async ({ page, useFork }) => {
  test.setTimeout(420_000)
  await flipByte(FEED, 50)
  await flipByte(h.deployment.lens as Hex, 100)
  await useFork(page, h.env)
  await page.goto("/sandbox/proof")
  expect(await settled(page)).toEqual({ blocks: "pass", bytecode: "fail", state: "pass", intatto: "fail" })
  await expect(row(page, "bytecode", FEED.toLowerCase())).toHaveAttribute("data-equal", "false")
  await expect(page.locator('[data-check="bytecode"] [data-equal="false"]')).toHaveCount(1)
  await expect(page.locator('[data-check="bytecode"] [data-slot="differences"]')).toContainText("Chainlink USDG/USD proxy")
  const lens = row(page, "intatto", "lens")
  await expect(lens).toHaveAttribute("data-equal", "false")
  await expect(lens).toContainText("byte 100")
})

test("a wrong fork block turns the block-hash check red", async ({ page, useFork }) => {
  test.setTimeout(300_000)
  const claimed = h.env.forkBlock + 1
  await useFork(page, h.env)
  await page.goto(`/sandbox/proof?block=${claimed}`)
  expect((await settled(page)).blocks).toBe("fail")
  // The sandbox mined its own block at fork+1; X Layer has a different one. fork+1−1 is the real fork block.
  await expect(row(page, "blocks", `block-${claimed}`)).toHaveAttribute("data-equal", "false")
  await expect(row(page, "blocks", `block-${claimed - 1}`)).toHaveAttribute("data-equal", "true")
})

test("an unreachable RPC shows that state on every check", async ({ page, useFork }) => {
  test.setTimeout(300_000)
  await useFork(page, h.env)
  await page.goto(`/sandbox/proof?rpc=${encodeURIComponent("http://127.0.0.1:9")}&block=${h.env.forkBlock}`)
  expect(await settled(page)).toEqual({ blocks: "unreachable", bytecode: "unreachable", state: "unreachable", intatto: "unreachable" })
  await expect(page.locator('[data-slot="unreachable"]').first()).toContainText("Could not reach the sandbox RPC")

  await page.route(/xlayerrpc\.okx\.com|xlayer\.drpc\.org|rpc\.xlayer\.tech/, (r) => r.abort("connectionrefused"))
  await page.goto("/sandbox/proof")
  expect(await settled(page)).toEqual({ blocks: "unreachable", bytecode: "unreachable", state: "unreachable", intatto: "unreachable" })
  await expect(page.locator('[data-slot="unreachable"]').first()).toContainText("Could not reach the X Layer RPC")
  await page.setViewportSize(viewports.narrow)
  await expectNoHorizontalScroll(page)
  await page.screenshot({ path: "proof/fork-proof-unreachable-390.png", fullPage: true })
})

