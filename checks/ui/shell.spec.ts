/**
 * Shell header: the chain badge stays visible with no wallet, and a sandbox session shows the fork
 * badge, the burner avatar and the account menu that ends the session.
 */
import { mkdirSync } from "node:fs"
import type { Page } from "@playwright/test"
import { test, expect, viewports, expectNoHorizontalScroll } from "./fixtures"
import { startForkHarness, type ForkHarness } from "../fork/harness.ts"
import { shortAddress } from "../../web/components/ui/web3/format.ts"

test.use({ trace: "off" })

const WIDTHS = [
  ["390", viewports.narrow, false],
  ["768", viewports.medium, true],
  ["1440", viewports.wide, true],
] as const

async function expectBadge(page: Page, mode: "live" | "sandbox", stem: string) {
  const long = mode === "live" ? "X Layer mainnet" : "X Layer mainnet fork"
  const short = mode === "live" ? "X Layer" : "Fork"
  const badge = page.locator("header").getByTestId("chain-badge")
  await expect(badge).toHaveAttribute("data-mode", mode)
  for (const [label, size, wide] of WIDTHS) {
    await page.setViewportSize(size)
    await expectNoHorizontalScroll(page)
    const longLabel = badge.getByTestId("chain-badge-long")
    const shortLabel = badge.getByTestId("chain-badge-short")
    if (wide) {
      await expect(longLabel).toBeVisible()
      await expect(longLabel).toHaveText(long)
      await expect(shortLabel).toBeHidden()
    } else {
      await expect(shortLabel).toBeVisible()
      await expect(shortLabel).toHaveText(short)
      await expect(longLabel).toBeHidden()
    }
    await page.screenshot({ path: `proof/${stem}-${label}.png` })
  }
}

test("live mode shows X Layer mainnet with no wallet", async ({ page }) => {
  test.setTimeout(180_000)
  mkdirSync("proof", { recursive: true })
  await page.setViewportSize(viewports.wide)
  await page.goto("/")
  await expect(page.locator("header").getByTestId("chain-badge")).toBeVisible({ timeout: 120_000 })
  await expect(page.getByTestId("market-not-deployed").or(page.getByTestId("headline-stats"))).toBeVisible({ timeout: 120_000 })
  await expect(page.getByTestId("wallet-menu")).toHaveCount(0)
  await expect(page.locator("header").getByRole("button", { name: "Connect wallet" })).toBeVisible()
  await expect(page.locator("header").getByRole("button", { name: "Connect wallet" })).toHaveAttribute("data-variant", "default")
  await expectBadge(page, "live", "shell-live")
  await page.setViewportSize(viewports.narrow)
  await expect(page.locator("header").getByRole("button", { name: "Connect" })).toBeVisible()
  await expectNoHorizontalScroll(page)
})

test.describe("sandbox shell", () => {
  let h: ForkHarness

  test.beforeAll(async () => {
    test.setTimeout(300_000)
    h = await startForkHarness()
    mkdirSync("proof", { recursive: true })
  })

  test.afterAll(async () => {
    await h?.stop()
  })

  test("fork badge, avatar, and end session returns to live", async ({ page, useFork }) => {
    test.setTimeout(300_000)
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"])
    await useFork(page, h.env)
    await page.setViewportSize(viewports.wide)
    await page.goto("/")

    const menu = page.getByTestId("wallet-menu")
    await expect(menu).toBeVisible({ timeout: 120_000 })
    await expect(page.getByTestId("headline-stats").or(page.getByTestId("market-load-error"))).toBeVisible({ timeout: 180_000 })
    await expect(menu).not.toHaveAttribute("data-slot", "button")
    await expect(page.getByTestId("wallet-address")).toHaveText(shortAddress(h.env.burnerAddress))
    const avatar = page.getByTestId("wallet-avatar")
    await expect(avatar).toHaveAttribute("data-address", h.env.burnerAddress.toLowerCase())
    const cells = await avatar.getAttribute("data-cells")
    expect(cells).toHaveLength(25)
    expect(cells).toContain("1")

    await expectBadge(page, "sandbox", "shell-sandbox")

    await page.reload()
    await expect(page.getByTestId("wallet-avatar")).toHaveAttribute("data-cells", cells!, { timeout: 120_000 })

    const copy = page.getByRole("menuitem", { name: "Copy address" })
    const end = page.getByRole("menuitem", { name: "End sandbox session" })
    await page.setViewportSize(viewports.narrow)
    await menu.click()
    await expect(copy).toBeVisible()
    await expect(end).toBeVisible()
    await expect(page.getByRole("menuitem", { name: "View on OKLink" })).toHaveCount(0)
    await expect(page.getByRole("menuitem", { name: "Switch wallet" })).toHaveCount(0)
    await expect(page.getByRole("menuitem", { name: "Disconnect" })).toHaveCount(0)
    await expectNoHorizontalScroll(page)
    await page.screenshot({ path: "proof/shell-sandbox-menu-390.png" })
    await copy.click({ timeout: 15_000 })
    await expect(page.getByText("Address copied")).toBeVisible()
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(h.env.burnerAddress)
    await expect(copy).toHaveCount(0)

    await page.setViewportSize(viewports.wide)
    await menu.click()
    await expect(end).toBeVisible()
    await page.screenshot({ path: "proof/shell-sandbox-menu-1440.png" })
    await end.click({ timeout: 15_000 })

    const badge = page.locator("header").getByTestId("chain-badge")
    await expect(badge).toHaveAttribute("data-mode", "live", { timeout: 30_000 })
    await expect(badge.getByTestId("chain-badge-long")).toHaveText("X Layer mainnet")
    await expect(page.locator('[data-slot="sandbox-banner"]')).toHaveCount(0)
    await expect(page.getByTestId("wallet-menu")).toHaveCount(0)
    await expect(page.locator("header").getByRole("button", { name: "Connect wallet" })).toBeVisible()
    await expect.poll(() => page.evaluate(() => localStorage.getItem("intatto:sandbox"))).toBeNull()
    await expectNoHorizontalScroll(page)
    await page.screenshot({ path: "proof/shell-ended-1440.png" })
  })
})
