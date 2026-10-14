// Beat 3: the demo wallet's live position on X Layer mainnet (read-only wallet: nothing is signed).
import { take, READ_ONLY_WALLET } from "../rig.mjs"
await take("borrow-mainnet", async f => {
  const { page } = f
  await page.goto("https://intatto.larinova.com/borrow")
  await page.getByRole("button", { name: /Connect wallet/ }).waitFor({ timeout: 60000 })
  await f.glide(900, 400, 10)
  f.mark("loaded"); await f.wait(1800)
  f.mark("connect"); await f.click(page.getByRole("button", { name: /Connect wallet/ }), 900); await f.wait(700)
  await f.click(page.getByRole("menuitem", { name: /Browser wallet/ }), 600)
  await page.getByTestId("position-panel").getByText("Health factor").waitFor({ timeout: 60000 })
  f.mark("connected"); await f.wait(1500)
  const panel = page.getByTestId("position-panel")
  f.mark("collateral"); await f.point(panel.getByText("Collateral", { exact: true }).first(), 900, 0.2); await f.wait(1400)
  f.mark("debt"); await f.point(panel.getByText("Debt", { exact: true }).first(), 600, 0.2); await f.wait(1200)
  f.mark("ltv-health"); await f.point(panel.getByText("Health factor").first(), 600, 0.2); await f.wait(1800)
  f.mark("can-fall"); await f.point(page.getByText(/NVDA can fall .* before liquidation/).first(), 900); await f.wait(2200)
  f.mark("monday-table"); await f.point(page.getByText("If NVDA opens lower on Monday").first(), 900, 0.2); await f.wait(800)
  for (const r of ["−5%", "−10%", "−20%", "−30%"]) { await f.point(page.getByRole("cell", { name: r }).first(), 450, 0.3); await f.wait(450) }
  await f.wait(1200)
  f.mark("preview"); await f.type(page.locator("#borrow-loan"), "0.02", 160); await f.wait(2600)
  f.mark("preview-clear"); await page.keyboard.press("ControlOrMeta+a"); await page.keyboard.press("Backspace"); await f.wait(1200)
  f.mark("end")
}, { init: [READ_ONLY_WALLET()] })
