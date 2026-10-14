// Recording rig for the Intatto demo film.
// A real headless-Chromium screencast at 1440x900 CSS px, captured at 2x (2880x1800) through CDP,
// with a drawn cursor (headless has none), eased mouse moves, smooth scrolling and named marks.
// Every take keeps its raw frames, a per-frame log (time, size, cursor, scroll) and an encoded mp4 under
// film/raw/<take>-<stamp>/. session() keeps one browser across takes so setup can happen off camera.
import { chromium } from "@playwright/test"
import { mkdirSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const FILM = join(dirname(fileURLToPath(import.meta.url)), "..")
export const DEMO_WALLET = "0x7F23b131F7312bd0f63EF79974E215Dc3E12a415"

const CURSOR = `(() => {
  const install = () => {
    if (document.getElementById("__film_cursor")) return
    const c = document.createElement("div")
    c.id = "__film_cursor"
    c.innerHTML = '<svg width="26" height="30" viewBox="0 0 26 30"><path d="M3 2 L3 24 L8.6 18.8 L12.4 27.4 L16 25.8 L12.3 17.4 L19.8 17.4 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    Object.assign(c.style, { position: "fixed", left: "0", top: "0", width: "26px", height: "30px", zIndex: 2147483647, pointerEvents: "none", transform: "translate(-100px,-100px)", filter: "drop-shadow(0 1px 2px rgba(0,0,0,.25))" })
    document.documentElement.appendChild(c)
    let saved = null
    try { saved = JSON.parse(sessionStorage.getItem("__film_xy") || "null") } catch {}
    const place = (x, y) => { c.style.transform = "translate(" + (x - 3) + "px," + (y - 2) + "px)" }
    if (saved) place(saved[0], saved[1])
    addEventListener("mousemove", e => { place(e.clientX, e.clientY); try { sessionStorage.setItem("__film_xy", JSON.stringify([e.clientX, e.clientY])) } catch {} }, true)
    addEventListener("mousedown", e => {
      const r = document.createElement("div")
      Object.assign(r.style, { position: "fixed", left: e.clientX - 18 + "px", top: e.clientY - 18 + "px", width: "36px", height: "36px", borderRadius: "50%", background: "rgba(17,17,17,.18)", zIndex: 2147483646, pointerEvents: "none", transform: "scale(.3)", transition: "transform .35s ease-out, opacity .45s ease-out" })
      document.documentElement.appendChild(r)
      requestAnimationFrame(() => { r.style.transform = "scale(1)"; r.style.opacity = "0" })
      setTimeout(() => r.remove(), 600)
    }, true)
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install); else install()
})()`

/** EIP-1193 provider that is the demo wallet for reads and refuses every signature: nothing can be sent. */
export const READ_ONLY_WALLET = (address = DEMO_WALLET, rpc = "https://rpc.xlayer.tech") => `(() => {
  const ADDR = ${JSON.stringify(address)}, RPC = ${JSON.stringify(rpc)}, ls = {}
  const refuse = () => { const e = new Error("Read-only demo wallet: nothing is signed"); e.code = 4001; throw e }
  window.ethereum = {
    isFilmReadOnly: true,
    async request({ method, params }) {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [ADDR]
      if (method === "eth_chainId") return "0xc4"
      if (method === "net_version") return "196"
      if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null
      if (method === "wallet_requestPermissions" || method === "wallet_getPermissions") return [{ parentCapability: "eth_accounts" }]
      if (method === "wallet_revokePermissions") return null
      if (/^(eth_send|eth_sign|personal_sign|wallet_send)/.test(method)) return refuse()
      const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }).then(r => r.json())
      if (r.error) { const e = new Error(r.error.message); e.code = r.error.code; throw e }
      return r.result
    },
    on(e, f) { (ls[e] ||= []).push(f) },
    removeListener(e, f) { ls[e] = (ls[e] || []).filter(x => x !== f) },
  }
})()`

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/**
 * One browser context for several takes. `prep` and anything between `record` calls run OFF camera (session
 * setup, time jumps); only `record(name, run)` is filmed, each into its own film/raw/<name>-<stamp>/.
 * Capture is 2x (2880x1800 for 1440x900 CSS px). Each frame logs the cursor (CSS px), button state and scroll.
 */
export async function session(fn, { init = [], width = 1440, height = 900 } = {}) {
  const browser = await chromium.launch({ args: ["--force-device-scale-factor=2"] })
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: "light", locale: "en-US", timezoneId: "UTC" })
  for (const script of [CURSOR, ...init]) await context.addInitScript(script)
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  const cursor = { x: width / 2, y: height / 2, down: false }
  let active = null // the take being recorded
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {})
    if (!active) return
    const file = `${String(active.frames.length).padStart(6, "0")}.jpg`
    writeFileSync(join(active.dir, "frames", file), Buffer.from(data, "base64"))
    active.frames.push({
      file,
      t: metadata.timestamp,
      w: metadata.deviceWidth,
      h: metadata.deviceHeight,
      scrollY: metadata.scrollOffsetY,
      cursor: { x: +cursor.x.toFixed(1), y: +cursor.y.toFixed(1), down: cursor.down },
    })
  })
  const move = async (x, y) => { cursor.x = x; cursor.y = y; await page.mouse.move(x, y) }
  const film = {
    page,
    context,
    mark(label) {
      if (!active) return
      const t = Date.now() / 1000 - active.t0
      active.marks.push({ label, t })
      console.log(`[${active.name} ${t.toFixed(1)}s] ${label}`)
    },
    wait: ms => page.waitForTimeout(ms),
    /** Eased move over `ms` of wall time (time-based, so 2x capture latency doesn't stretch it). */
    async glide(x, y, ms = 700) {
      const from = { x: cursor.x, y: cursor.y }, start = Date.now()
      for (;;) {
        const k = Math.min(1, (Date.now() - start) / ms)
        await move(from.x + (x - from.x) * ease(k), from.y + (y - from.y) * ease(k))
        if (k >= 1) break
        await page.waitForTimeout(8)
      }
    },
    async point(locator, ms = 700, dx = 0.5, dy = 0.5) {
      await locator.scrollIntoViewIfNeeded()
      const b = await locator.boundingBox()
      await film.glide(b.x + b.width * dx, b.y + b.height * dy, ms)
    },
    async click(locator, ms = 700) {
      await film.point(locator, ms)
      await page.waitForTimeout(180)
      cursor.down = true; await page.mouse.down(); await page.waitForTimeout(90)
      await page.mouse.up(); cursor.down = false
    },
    async type(locator, text, delay = 110) {
      await film.click(locator)
      await page.keyboard.press("ControlOrMeta+a"); await page.keyboard.press("Backspace")
      await page.keyboard.type(text, { delay })
    },
    /** Smooth-scrolls the window so `y` (px) is at the top, over `ms`. */
    async scrollTo(y, ms = 1200) {
      await page.evaluate(([y, ms]) => new Promise(done => {
        const from = scrollY, start = performance.now(), e = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
        const tick = now => { const k = Math.min(1, (now - start) / ms); scrollTo(0, from + (y - from) * e(k)); k < 1 ? requestAnimationFrame(tick) : done() }
        requestAnimationFrame(tick)
      }), [y, ms])
    },
    async scrollToEl(locator, offset = 96, ms = 1200) {
      const y = await locator.evaluate((el, offset) => el.getBoundingClientRect().top + scrollY - offset, offset)
      await film.scrollTo(Math.max(0, y), ms)
    },
    /** Films `run` as take `name`. Everything outside a record() call is off camera. */
    async record(name, run) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
      const dir = join(FILM, "raw", `${name}-${stamp}`)
      mkdirSync(join(dir, "frames"), { recursive: true })
      active = { name, stamp, dir, frames: [], marks: [], t0: Date.now() / 1000 }
      await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: width * 2, maxHeight: height * 2, everyNthFrame: 1 })
      // Repaint once so the first frame arrives at t0 even on a static page.
      await move(cursor.x + 0.01, cursor.y)
      let error = null
      try { await run(film) } catch (e) { error = e; console.error(`TAKE ERROR (${name}):`, e.message) }
      await page.waitForTimeout(400)
      await cdp.send("Page.stopScreencast").catch(() => {})
      const take = active
      active = null
      const tEnd = Date.now() / 1000
      writeFileSync(join(dir, "take.json"), JSON.stringify({ name, stamp, t0: take.t0, tEnd, scale: 2, css: { width, height }, error: error?.message ?? null, marks: take.marks, frames: take.frames }, null, 1))
      encode(dir, take.frames, tEnd)
      return { dir, error }
    },
  }
  try { await fn(film) } finally { await browser.close() }
}

/** A single take in its own browser (the original API). */
export async function take(name, run, opts = {}) {
  let result
  await session(async f => { result = await f.record(name, run) }, opts)
  return result
}

/** Frames arrive only when the page repaints; hold each until the next one and resample to 30 fps. */
export function encode(dir, frames, tEnd) {
  if (!frames.length) return
  const lines = []
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].t : tEnd
    lines.push(`file 'frames/${f.file}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`)
  })
  lines.push(`file 'frames/${frames.at(-1).file}'`)
  writeFileSync(join(dir, "concat.txt"), lines.join("\n"))
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "concat.txt", "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "14", "-preset", "medium", "take.mp4"], { cwd: dir, stdio: "inherit" })
  console.log(r.status === 0 ? `encoded ${dir}/take.mp4 (${frames.length} frames)` : "ENCODE FAILED")
}
