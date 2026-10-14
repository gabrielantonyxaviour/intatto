// Beat 2: the live Market page on X Layer mainnet.
import { take } from "../rig.mjs"
await take("market", async f => {
  const { page } = f
  await page.goto("https://intatto.larinova.com/")
  await page.getByTestId("headline-stats").waitFor({ timeout: 60000 })
  await page.getByTestId("market-detail-NVDAx").getByTestId("session-value").waitFor()
  await f.glide(720, 300, 10)
  f.mark("loaded"); await f.wait(2500)
  f.mark("stats"); await f.point(page.getByTestId("headline-stats"), 900, 0.3, 0.5); await f.wait(1500)
  const detail = page.getByTestId("market-detail-NVDAx")
  f.mark("scroll-market"); await f.scrollToEl(detail, 80, 1400); await f.wait(600)
  f.mark("session"); await f.point(detail.getByTestId("session-value").first(), 800); await f.wait(1800)
  f.mark("max-ltv"); await f.point(detail.getByTestId("tile-max-ltv"), 800); await f.wait(1800)
  f.mark("threshold"); await f.point(detail.getByText("Liquidation threshold").first(), 800); await f.wait(1800)
  f.mark("relay"); await f.point(page.getByTestId("chip-relay"), 900); await page.getByTestId("chip-relay").hover(); await f.wait(3500)
  f.mark("guards"); await f.glide(1250, 400, 600); await f.scrollToEl(page.getByText("Guards", { exact: true }).first(), 120, 1400); await f.wait(500)
  for (const k of ["fresh", "inBand", "pegOk"]) { await f.point(detail.getByTestId(`guard-${k}`), 500, 0.1, 0.5); await f.wait(700) }
  f.mark("price-made"); await f.scrollToEl(page.getByText("How the NVDAx price is made").first(), 120, 1600); await f.wait(800)
  f.mark("keeper-posts"); await f.point(page.getByText("Recent keeper posts").first(), 800); await f.wait(3000)
  f.mark("end")
})
