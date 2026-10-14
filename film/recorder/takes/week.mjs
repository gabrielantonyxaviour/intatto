// Beats 5-7 (+8/9 inserts): one fresh sandbox session filmed across a week, with NO sandbox controls on camera.
// Off camera: start the session, jump to Saturday, run the January 2025 replay. On camera: Friday borrow (OPEN),
// Saturday refusal + repay (CLOSED), the Monday replay views on Risk, the Lend primer.
// Run from the repo root: node film/recorder/takes/week.mjs [friday,saturday,monday-risk,lend-primer]
import { session } from "../rig.mjs"

const SITE = "https://intatto.larinova.com"
const SHOTS = process.env.FILM_SHOTS // optional debug screenshots dir
const only = process.argv[2]?.split(",")
const want = name => !only || only.includes(name)

await session(async f => {
  const { page } = f
  const shot = n => (SHOTS ? page.screenshot({ path: `${SHOTS}/week-${n}.png` }).catch(() => {}) : null)
  const nav = name => page.locator("header, nav").getByRole("link", { name, exact: true }).first()
  const cta = form => page.getByTestId(form).locator('[data-slot="form-cta"] button')
  const ctaText = (form, re) => page.waitForFunction(([form, re]) => new RegExp(re).test(document.querySelector(`[data-testid="${form}"] [data-slot="form-cta"] button`)?.textContent ?? ""), [form, re], { timeout: 90000 })
  const toBorrow = async () => {
    await nav("Borrow").click()
    await page.getByTestId("borrow-screen").waitFor({ timeout: 120000 })
    await page.getByTestId("session-badge").first().waitFor({ timeout: 120000 })
    await page.locator("#borrow-collateral").waitFor({ timeout: 120000 })
    await page.getByTestId("position-panel").waitFor({ timeout: 60000 })
    // Let the fork reads (price, session, balances) settle before anything is filmed.
    await page.waitForFunction(() => !document.querySelector('[data-testid="borrow-screen"] [data-slot="skeleton"], [data-testid="borrow-screen"] .animate-pulse'), null, { timeout: 60000 }).catch(() => {})
    await f.wait(3000)
  }

  // ---- off camera: a fresh session on the fork (it opens at the current chain time: Friday, market open)
  await page.goto(`${SITE}/sandbox`)
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Start a session" && !b.disabled), null, { timeout: 120000 })
  await page.getByRole("button", { name: "Start a session" }).click()
  await page.getByTestId("sandbox-session").waitFor({ timeout: 240000 })
  await page.getByTestId("burner-connection").filter({ hasText: "Connected" }).waitFor({ timeout: 120000 })
  await shot("0-session")
  await toBorrow()
  await f.glide(900, 520, 10)
  await shot("1-friday-ready")

  if (want("friday")) await f.record("friday", async f => {
    f.mark("loaded"); await f.wait(1800)
    f.mark("open"); await f.point(page.getByTestId("session-badge").first(), 900); await f.wait(1500)
    f.mark("limit"); await f.point(page.getByTestId("session-max-ltv").first(), 900, 0.3); await f.wait(1800)
    f.mark("collateral"); await f.type(page.locator("#borrow-collateral"), "4", 180); await f.wait(1600)
    const capText = await page.getByTestId("borrow-capacity").first().textContent()
    const cap = Number((capText ?? "").replace(/[^0-9.]/g, ""))
    const loan = String(Math.max(1, Math.floor(cap * 0.8)))
    f.mark("can-borrow"); await f.point(page.getByTestId("borrow-capacity").first(), 800, 0.3); await f.wait(1600)
    f.mark("loan"); await f.type(page.locator("#borrow-loan"), loan, 180); await f.wait(2400)
    await ctaText("deposit-borrow-form", "^Review$")
    f.mark("review"); await f.click(cta("deposit-borrow-form"), 800)
    const review = page.getByTestId("borrow-review")
    await review.waitFor({ timeout: 60000 }); await f.wait(1500); await shot("2-review")
    const approve = review.getByRole("button", { name: "Approve NVDAx" })
    if (await approve.isVisible({ timeout: 5000 }).catch(() => false)) {
      f.mark("approve"); await f.click(approve, 800)
      await page.locator("[data-sonner-toast]").filter({ hasText: "NVDAx approved" }).waitFor({ timeout: 90000 }).catch(() => {}); await f.wait(900)
    }
    f.mark("deposit"); await f.click(review.getByRole("button", { name: /^Deposit / }), 800)
    await review.getByTestId("review-done-step").filter({ hasText: "Deposited" }).waitFor({ timeout: 90000 }); await f.wait(900)
    f.mark("borrow"); await f.click(review.getByRole("button", { name: /^Borrow / }), 800)
    await review.getByTestId("review-finished").waitFor({ timeout: 90000 })
    f.mark("borrowed"); await f.wait(3000); await shot("3-borrowed")
    f.mark("back"); await f.click(review.getByRole("button", { name: "Back to the form" }), 800); await f.wait(1500)
    f.mark("position"); await f.point(page.getByTestId("position-debt").first(), 900, 0.3); await f.wait(2500)
    f.mark("end")
  })

  // ---- off camera: move the fork's clock to Saturday
  await nav("Sandbox").click()
  const sat = page.getByRole("button", { name: "Jump to Saturday" })
  await sat.waitFor({ timeout: 60000 }); await sat.click()
  await page.getByTestId("action-result").filter({ hasText: "Jump to Saturday: done" }).waitFor({ timeout: 240000 })
  await shot("4-saturday-done")
  await toBorrow()
  await shot("5-saturday-ready")

  if (want("saturday")) await f.record("saturday", async f => {
    f.mark("loaded"); await f.wait(1800)
    f.mark("closed"); await f.point(page.getByTestId("session-badge").first(), 900); await f.wait(1500)
    f.mark("limit"); await f.point(page.getByTestId("session-max-ltv").first(), 900, 0.3); await f.wait(2200)
    f.mark("try-more"); await f.type(page.locator("#borrow-loan"), "10", 200)
    await ctaText("deposit-borrow-form", "Refused")
    f.mark("refused"); await f.point(cta("deposit-borrow-form"), 900); await f.wait(3500); await shot("6-refused")
    f.mark("repay-tab"); await f.click(page.getByRole("tab", { name: "Repay & withdraw" }), 900); await f.wait(1200)
    f.mark("repay-typed"); await f.type(page.locator("#repay-amount"), "100", 180); await f.wait(1800)
    await ctaText("repay-withdraw-form", "^Review$")
    f.mark("repay-review"); await f.click(cta("repay-withdraw-form"), 800)
    const rr = page.getByTestId("repay-review"); await rr.waitFor({ timeout: 60000 }); await f.wait(1200)
    const approve = rr.getByRole("button", { name: "Approve USDG" })
    if (await approve.isVisible({ timeout: 6000 }).catch(() => false)) {
      f.mark("approve-usdg"); await f.click(approve, 800)
      await page.locator("[data-sonner-toast]").filter({ hasText: "USDG approved" }).waitFor({ timeout: 90000 }).catch(() => {}); await f.wait(900)
    }
    f.mark("repay"); await f.click(rr.getByRole("button", { name: /^Repay / }), 800)
    await rr.getByTestId("review-finished").waitFor({ timeout: 90000 })
    f.mark("repaid"); await f.wait(3800); await shot("7-repaid")
    f.mark("end")
  })

  if (!want("monday-risk") && !want("lend-primer")) return
  // ---- off camera: replay the January 2025 weekend on the fork
  await page.keyboard.press("Escape").catch(() => {})
  await nav("Sandbox").click()
  const jan = page.getByTestId("scenario-gap-2025-01")
  await jan.waitFor({ timeout: 60000 })
  await jan.getByRole("button", { name: "Replay the January 2025 gap" }).click()
  await page.getByTestId("action-result").filter({ hasText: "Replay the January 2025 gap: done" }).waitFor({ timeout: 300000 })
  await shot("8-jan-done")
  await nav("Risk").click()
  await page.getByTestId("risk-console").waitFor({ timeout: 90000 }); await f.wait(3500)
  await f.glide(900, 420, 10)

  const riskView = async (name, ms = 3200) => {
    await f.click(page.locator('nav[aria-label="Risk analyses"]').getByText(name, { exact: true }).first(), 800); await f.wait(ms)
  }
  if (want("monday-risk")) await f.record("monday-risk", async f => {
    f.mark("summary"); await f.wait(3000); await shot("9-risk-summary")
    f.mark("loans"); await riskView("Loans near liquidation"); await shot("10-risk-loans")
    f.mark("liquidations"); await riskView("Liquidations"); await shot("11-risk-liqs")
    f.mark("end")
  })

  if (want("lend-primer")) {
    await nav("Lend").click()
    await page.getByTestId("lend-primer").waitFor({ timeout: 90000 }).catch(() => {}); await f.wait(2500)
    await f.record("lend-primer", async f => {
      const primer = page.getByTestId("lend-primer")
      f.mark("primer"); await f.wait(1500); await shot("12-primer")
      f.mark("interest"); await f.point(primer.getByText(/80%/).first(), 900, 0.3); await f.wait(3000)
      f.mark("lose"); await f.point(primer.getByText("Lenders can lose money.").first(), 900, 0.3); await f.wait(3000)
      f.mark("end")
    })
  }
})
