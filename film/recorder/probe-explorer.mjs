import { chromium } from "@playwright/test"
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "UTC", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36" })
const p = await ctx.newPage()
for (const [n, u] of [["oklink-addr", "https://www.oklink.com/x-layer/address/0x7F23b131F7312bd0f63EF79974E215Dc3E12a415"], ["oklink-market", "https://www.oklink.com/x-layer/address/0xE6708CC6598F17611f9A468f9907052688459D0D"]]) {
  try { await p.goto(u, { timeout: 45000 }) } catch (e) { console.log(n, "goto", e.message.slice(0, 100)) }
  await p.waitForTimeout(8000)
  await p.screenshot({ path: `film/look/${n}.png` })
  console.log(n, p.url(), (await p.locator("body").innerText().catch(() => "")).replace(/\n+/g, " | ").slice(0, 600))
}
await b.close()
