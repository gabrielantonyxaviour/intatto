// Rig verification: 2x frames, frame cadence and the cursor log, on the public Market page (no wallet).
import { take } from "../rig.mjs"
await take("rigcheck", async f => {
  const { page } = f
  await page.goto("https://intatto.larinova.com/")
  await page.waitForLoadState("networkidle").catch(() => {})
  f.mark("loaded"); await f.wait(800)
  await f.glide(300, 200, 900); f.mark("glide"); await f.glide(1100, 600, 900)
  await f.scrollTo(400, 1000); f.mark("scrolled"); await f.wait(600)
  f.mark("end")
})
