// Beats 4 and 10 inserts, live X Layer mainnet, read-only demo wallet (it refuses every signature).
// Off camera: open Borrow and connect. On camera: the live position and its Contracts sheet; then the Agents
// credit call for the demo wallet with its Response details.
// Run from the repo root: node film/recorder/takes/mainnet.mjs [mainnet-position,agents-credit]
import { session, READ_ONLY_WALLET, DEMO_WALLET } from "../rig.mjs"

const SITE = "https://intatto.larinova.com"
const only = process.argv[2]?.split(",")
const want = name => !only || only.includes(name)

await session(async f => {
  const { page } = f

  if (want("mainnet-position")) {
    await page.goto(`${SITE}/borrow`)
    await page.getByRole("button", { name: /Connect wallet/ }).first().click({ timeout: 60000 })
    await page.getByRole("menuitem", { name: /Browser wallet/ }).click()
    const panel = page.getByTestId("position-panel")
    await panel.getByText("Health factor").waitFor({ timeout: 90000 })
    await page.getByTestId("position-liq-price").first().waitFor({ timeout: 60000 })
    await f.wait(3000); await f.glide(1000, 640, 10)

    await f.record("mainnet-position", async f => {
      f.mark("loaded"); await f.wait(1800)
      f.mark("collateral"); await f.point(panel.getByText("Collateral", { exact: true }).first(), 900, 0.2); await f.wait(1300)
      f.mark("debt"); await f.point(page.getByTestId("position-debt").first(), 700, 0.5); await f.wait(1300)
      f.mark("ltv"); await f.point(page.getByTestId("position-ltv").first(), 700, 0.5); await f.wait(1300)
      f.mark("liq-price"); await f.point(page.getByTestId("position-liq-price").first(), 700, 0.5); await f.wait(1800)
      f.mark("contracts"); await f.click(page.getByRole("button", { name: "Contracts", exact: true }).first(), 900)
      await page.getByRole("dialog").first().waitFor({ timeout: 30000 }); await f.wait(3800)
      await page.keyboard.press("Escape"); await f.wait(1200)
      f.mark("end")
    })
  }

  if (want("agents-credit")) {
    await page.goto(`${SITE}/agents`)
    await page.getByText("Intatto credit and health").first().waitFor({ timeout: 60000 })
    await f.wait(2500); await f.glide(720, 520, 10)

    await f.record("agents-credit", async f => {
      f.mark("loaded"); await f.wait(1600)
      f.mark("listing"); await f.point(page.getByText("OKX AI listing: under review (agent #13907)").first(), 900, 0.3); await f.wait(2200)
      f.mark("try-it"); await f.click(page.getByRole("link", { name: "Try it", exact: true }).first(), 800)
      const wallet = page.getByLabel("Wallet", { exact: true })
      await wallet.waitFor({ timeout: 60000 }); await f.wait(1000)
      f.mark("type-wallet"); await f.type(wallet, DEMO_WALLET, 30); await f.wait(700)
      f.mark("submit"); await f.click(page.getByRole("button", { name: "Try it", exact: true }), 800)
      await page.getByTestId("credit-capacity").waitFor({ timeout: 60000 })
      f.mark("report"); await f.wait(1500)
      for (const id of ["credit-session", "credit-capacity"]) { await f.point(page.getByTestId(id), 650, 0.3); await f.wait(1300) }
      f.mark("details"); await f.click(page.getByRole("button", { name: "Response details", exact: true }), 800)
      await page.getByTestId("response-details").waitFor({ timeout: 30000 }); await f.wait(3800)
      await page.keyboard.press("Escape"); await f.wait(1000)
      f.mark("end")
    })
  }
}, { init: [READ_ONLY_WALLET()] })
