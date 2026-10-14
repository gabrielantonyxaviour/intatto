// Beat 8: an agent-style call to the credit API for the demo wallet, then the keeper's onchain posts (mainnet).
import { take, DEMO_WALLET } from "../rig.mjs"
const shot = (page, n) => page.screenshot({ path: `film/look/ag-${n}.png` }).catch(() => {})
await take("agents", async f => {
  const { page } = f
  await page.goto("https://intatto.larinova.com/agents")
  await page.getByText("Intatto credit and health").first().waitFor({ timeout: 60000 })
  await f.glide(720, 500, 10)
  f.mark("loaded"); await f.wait(2000)
  f.mark("credit-card"); await f.point(page.getByText("Intatto credit and health").first(), 800); await f.wait(1500)
  f.mark("keeper-card"); await f.point(page.getByText("Keeper", { exact: true }).first(), 800); await f.wait(1500)
  f.mark("try-it"); await f.click(page.getByRole("link", { name: "Try it" }).first(), 800)
  await page.locator("#credit-wallet").waitFor({ timeout: 60000 }); await f.wait(1200)
  f.mark("type-wallet"); await f.type(page.locator("#credit-wallet"), DEMO_WALLET, 35); await f.wait(700)
  f.mark("submit"); await f.click(page.locator("form").getByRole("button", { name: "Try it" }), 800)
  await page.getByTestId("credit-capacity").waitFor({ timeout: 60000 })
  f.mark("report"); await f.wait(1500); await shot(page, "1-report")
  for (const id of ["credit-session", "credit-capacity", "credit-liq-price", "credit-gap"]) { await f.point(page.getByTestId(id), 650, 0.3); await f.wait(1100) }
  f.mark("json"); await f.scrollToEl(page.getByTestId("credit-json"), 140, 1600); await f.wait(3000); await shot(page, "2-json")
  f.mark("to-risk"); await page.goto("https://intatto.larinova.com/risk")
  await page.getByTestId("risk-console").waitFor({ timeout: 90000 }); await f.wait(2500)
  f.mark("keeper-log"); const v = page.locator('nav[aria-label="Risk analyses"]').getByText("Keeper log", { exact: true }).first(); await f.click(v, 800); await f.wait(3000); await shot(page, "3-keeper-log")
  await f.glide(900, 520, 900); await f.wait(2500)
  f.mark("price-posts"); const pp = page.locator('nav[aria-label="Risk analyses"]').getByText("Price posts", { exact: true }).first(); await f.click(pp, 800); await f.wait(3500); await shot(page, "4-price-posts")
  f.mark("end")
})
