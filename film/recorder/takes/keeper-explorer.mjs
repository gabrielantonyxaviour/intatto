// Beat 8 (cont.): the keeper's own transactions on OKLink: a post every few minutes, all onchain.
import { take } from "../rig.mjs"
await take("keeper-explorer", async f => {
  const { page } = f
  const url = "https://www.oklink.com/x-layer/address/0xaBa1F7e4FB0500696855BF38012676c10e3ef808"
  for (let i = 0; i < 8; i++) {
    await page.goto(url)
    const ok = await page.locator("text=/0x[0-9a-f]{10}/").first().waitFor({ timeout: 15000 }).then(() => true, () => false)
    if (ok && await page.getByText(/postPrice|postSession|post/i).count()) break
    console.log("no tx list yet, retry", i + 1); await f.wait(5000)
  }
  await page.getByRole("button", { name: "Accept" }).click({ timeout: 5000 }).catch(() => {})
  await f.glide(720, 300, 10)
  f.mark("loaded"); await f.wait(2000)
  f.mark("address"); await f.point(page.getByText("0xaBa1F7e4FB0500696855BF38012676c10e3ef808").first(), 800); await f.wait(1500)
  f.mark("rows"); await f.scrollTo(420, 1400); await f.wait(600)
  const methods = page.locator("td").filter({ hasText: /^post/i })
  const n = Math.min(5, await methods.count())
  for (let i = 0; i < n; i++) { await f.point(methods.nth(i), 450); await f.wait(500) }
  await f.wait(2500)
  f.mark("end")
})
