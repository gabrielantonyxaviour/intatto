// Beat 3 (cont.): the real borrow on OKLink, and the verified contract.
import { take } from "../rig.mjs"
await take("explorer", async f => {
  const { page } = f
  const url = "https://www.oklink.com/x-layer/address/0xE6708CC6598F17611f9A468f9907052688459D0D"
  for (let i = 0; i < 6; i++) {
    await page.goto(url)
    const ok = await page.getByText("borrow", { exact: true }).first().waitFor({ timeout: 15000 }).then(() => true, () => false)
    if (ok) break
    console.log("no tx list yet, retry", i + 1); await f.wait(4000)
  }
  await page.getByRole("button", { name: "Accept" }).click({ timeout: 5000 }).catch(() => {})
  await f.glide(720, 250, 10)
  f.mark("loaded"); await f.wait(1500)
  f.mark("contract"); await f.point(page.getByText("Contract", { exact: true }).first(), 800, 0.5); await f.wait(1200)
  f.mark("borrow-row"); await f.point(page.getByText("borrow", { exact: true }).first(), 1000); await f.wait(1800)
  f.mark("from-wallet"); await f.point(page.getByText("0x7f23...3e12a415").first(), 700); await f.wait(1400)
  f.mark("contracts-tab"); await f.click(page.getByText("Contracts", { exact: true }).first(), 900); await f.wait(3500)
  f.mark("end")
})
