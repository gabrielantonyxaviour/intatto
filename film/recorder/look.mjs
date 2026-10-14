import { chromium } from "@playwright/test"
const out = process.argv[2]
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
for (const [name, url] of [["market","https://intatto.larinova.com/"],["borrow","https://intatto.larinova.com/borrow"],["lend","https://intatto.larinova.com/lend"],["risk","https://intatto.larinova.com/risk"],["agents","https://intatto.larinova.com/agents"],["sandbox","https://intatto.larinova.com/sandbox"],["keeperlog","https://intatto-keeper.larinova.com/log"]]) {
  await p.goto(url, { waitUntil: "networkidle" }).catch(e=>console.log(name, e.message))
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: true })
  console.log(name, await p.evaluate(() => document.body.innerText.slice(0, 1500).replace(/\n+/g, " | ")))
}
await b.close()
