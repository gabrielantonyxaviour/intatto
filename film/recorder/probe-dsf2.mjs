import { chromium } from "@playwright/test"
const size = b => { let i = 2; while (i < b.length) { if (b[i] === 0xff && (b[i + 1] === 0xc0 || b[i + 1] === 0xc2)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + b.readUInt16BE(i + 2) } }
for (const [name, launch, ctx] of [
  ["force-dsf-flag", { args: ["--force-device-scale-factor=2"] }, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
  ["new-headless+flag", { channel: "chromium", args: ["--force-device-scale-factor=2"] }, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
]) {
  try {
    const b = await chromium.launch(launch); const c = await b.newContext(ctx); const p = await c.newPage(); const cdp = await c.newCDPSession(p)
    let got; cdp.on("Page.screencastFrame", ({ data, sessionId }) => { cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {}); got = size(Buffer.from(data, "base64")) })
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 2880, maxHeight: 1800 })
    await p.goto("https://intatto.larinova.com/"); await p.waitForTimeout(3000)
    console.log(name, JSON.stringify(got), await p.evaluate(() => [innerWidth, devicePixelRatio])); await b.close()
  } catch (e) { console.log(name, "ERR", e.message.slice(0, 150)) }
}
