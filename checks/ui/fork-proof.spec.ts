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
/** Aave v3 Pool on X Layer: covered by check 2, never called by check 3, so tampering with it shows in check 2 alone. */
const AAVE_POOL = "0xe3f3caefdd7180f884c01e57f65df979af84f116" as Hex
const NVDAX = "0xc845b2894dbddd03858fd2d643b4ef725fe0849d" as Hex
const RUN_TIMEOUT = 240_000

test.describe.configure({ mode: "serial" })

let h: ForkHarness

test.beforeAll(async () => {
  test.setTimeout(300_000)
  // SPYx too, as the hosted sandbox has it: a market with no mainnet counterpart.
  h = await startForkHarness({ spyx: true })
  // The harness compiled and deployed from contracts/out; ship the same build to the page's check 4.
  writeArtifactsModule()
})

test.afterAll(async () => {
  await h?.stop()
})

/**
 * Waits until the page shows all four checks with none running, read in one snapshot (a dev-server reload can
 * briefly show no checks at all, which must not count as finished), and returns every check's status.
 */
async function settled(page: PwPage) {
  let result: Record<string, string | null> | null = null
  await expect
    .poll(
      async () => {
        result = await page
          .evaluate(() => {
            const els = [...document.querySelectorAll("[data-check]")]
            if (els.length !== 4 || els.some((e) => e.getAttribute("data-status") === "running")) return null
            return Object.fromEntries(els.map((e) => [e.getAttribute("data-check"), e.getAttribute("data-status")]))
          })
          .catch(() => null)
        return result !== null
      },
      { timeout: RUN_TIMEOUT, intervals: [500] },
    )
    .toBe(true)
  return result!
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
  // The harness funded the burner from the real holder: that balance moved, is listed apart, and fails nothing.
  await expect(row(page, "state", "m.holder")).toHaveAttribute("data-equal", "false")
  await expect(page.locator('[data-check="state"] [data-slot="differences"]')).toHaveCount(0)

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
  // The raw slot and the totalSupply() call that reads it both moved, and nothing else.
  await expect(page.locator('[data-check="state"] [data-slot="differences"] li')).toHaveText([
    "Changed since the fork: USDG totalSupply()",
    "Changed since the fork: USDG slot 0x2 (totalSupply)",
  ])
  await expect(row(page, "state", "usdg.totalSupply").locator('[data-side="new"]')).toContainText(String(BigInt(newWord)))
  await changed.scrollIntoViewIfNeeded()
  await page.screenshot({ path: "proof/fork-proof-red.png", fullPage: true })

  await h.fork.request("anvil_setStorageAt", [USDG, "0x2", oldWord])
  expect((await rerun(page)).state).toBe("pass")
})

test("check 4 compares mainnet contracts with mainnet and sandbox-only markets with the build", async () => {
  test.setTimeout(180_000)
  // The same module the page runs. The fork plays both sides: "mainnet" is the harness deployment without SPYx.
  const { checkIntatto } = await import("../../web/components/fork-proof/check-intatto.ts")
  const { proofClient } = await import("../../web/components/fork-proof/rpc.ts")
  const sandbox = proofClient("sandbox", h.env.rpcUrl)
  const reference = proofClient("reference", h.env.rpcUrl)
  const live = { ...h.deployment, markets: h.deployment.markets.filter((m) => m.symbol === "NVDAx") }
  expect(h.deployment.markets.map((m) => m.symbol)).toEqual(["NVDAx", "SPYx"])

  const mainnet = await checkIntatto(sandbox, reference, h.deployment, live)
  expect(mainnet.pass).toBe(true)
  expect(mainnet.evidence.comparison).toBe("mainnet")
  expect(mainnet.evidence.sandboxOnlyMarkets).toEqual(["SPYx"])
  for (const r of mainnet.evidence.rows) {
    const spyx = r.id.startsWith("SPYx.")
    expect([r.id, r.comparedWith, r.sandboxOnly, r.equal]).toEqual([r.id, spyx ? "artifacts" : "mainnet", spyx, true])
    if (!spyx) expect(r.referenceAddress).toBe(r.address)
  }

  // No mainnet deployment configured: everything against the build; the session API's hint only labels SPYx.
  const build = await checkIntatto(sandbox, reference, h.deployment, null, ["SPYx"])
  expect(build.pass).toBe(true)
  expect(build.evidence.rows.every((r) => r.comparedWith === "artifacts" && r.sandboxOnly === r.id.startsWith("SPYx."))).toBe(true)

  // A mainnet contract whose code differs from the sandbox's is caught in mainnet mode too.
  const tampered = await checkIntatto(sandbox, reference, h.deployment, { ...live, vault: h.deployment.gapReserve })
  expect(tampered.pass).toBe(false)
  expect(tampered.evidence.rows.find((r) => r.id === "vault")!.equal).toBe(false)
})

test("replaced code turns the bytecode and Intatto checks red", async ({ page, useFork }) => {
  test.setTimeout(420_000)
  await flipByte(AAVE_POOL, 50)
  await flipByte(h.deployment.lens as Hex, 100)
  await useFork(page, h.env)
  await page.goto("/sandbox/proof")
  expect(await settled(page)).toEqual({ blocks: "pass", bytecode: "fail", state: "pass", intatto: "fail" })
  await expect(row(page, "bytecode", AAVE_POOL)).toHaveAttribute("data-equal", "false")
  await expect(page.locator('[data-check="bytecode"] [data-equal="false"]')).toHaveCount(1)
  await expect(page.locator('[data-check="bytecode"] [data-slot="differences"]')).toContainText("Aave v3 Pool (0x")
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


test("a read the RPC answers with a JSON-RPC error shows as refused, not unreachable", async ({ page, useFork }) => {
  test.setTimeout(300_000)
  // Like the hosted sandbox's BlockOutOfRangeError (-32602): the RPC is up but will not serve these reads.
  const origin = new URL(h.env.rpcUrl).origin
  await page.route(
    (url) => url.origin === origin,
    async (route) => {
      const body = route.request().postDataJSON() as { id?: number; method?: string } | null
      if (!body || !["eth_getCode", "eth_getStorageAt", "eth_call"].includes(body.method ?? "")) return route.continue()
      await route.fulfill({
        status: 200,
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { code: -32602, message: "BlockOutOfRangeError: block height is 1 but requested was 2" } }),
      })
    },
  )
  await useFork(page, h.env)
  await page.goto("/sandbox/proof")
  expect(await settled(page)).toEqual({ blocks: "pass", bytecode: "refused", state: "refused", intatto: "refused" })
  const refused = page.locator('[data-check="bytecode"] [data-slot="refused"]')
  await expect(refused).toContainText("The sandbox RPC refused a read")
  await expect(refused).toContainText("JSON-RPC error -32602")
  await expect(page.locator('[data-slot="unreachable"]')).toHaveCount(0)
})
