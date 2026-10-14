import { chromium } from "@playwright/test"
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "UTC" })).newPage()
for (const [n, u] of [["agents", "https://intatto.larinova.com/agents"], ["keeperlog", "https://intatto-keeper.larinova.com/log"]]) {
  await p.goto(u); await p.waitForTimeout(6000)
  await p.screenshot({ path: `film/look/${n}.png`, fullPage: true })
  console.log("==", n, (await p.locator("body").innerText()).replace(/\n+/g, " | ").slice(0, 2500))
  console.log(await p.evaluate(() => [...document.querySelectorAll("button")].map(b => b.textContent.trim()).filter(Boolean).slice(0, 30).join(" / ")))
}
await b.close()
