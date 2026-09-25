/**
 * Playwright fixtures for Intatto UI checks.
 *
 * `useFork(page, env)` seeds the app's sandbox session (localStorage "intatto:sandbox") before the
 * first navigation, so the app starts in sandbox mode against the fork with the burner connected.
 */
import { test as base, expect, type Page } from "@playwright/test"
import type { ForkEnv } from "../../lib/fork-env"

export { expect }
export type { ForkEnv }

export const SANDBOX_STORAGE_KEY = "intatto:sandbox"

/** The SandboxSession the web app reads (web/lib/chain/sandbox-session.ts), built from a ForkEnv. */
export function sandboxSessionFor(env: ForkEnv) {
  return {
    sessionId: "local-check",
    apiUrl: env.sessionApiUrl ?? "",
    rpcUrl: env.rpcUrl,
    chainId: env.chainId,
    forkBlock: env.forkBlock,
    deployment: env.deployment,
    burnerKey: env.burnerKey,
  }
}

type Fixtures = {
  useFork: (page: Page, env: ForkEnv) => Promise<void>
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  useFork: async ({}, use) => {
    await use(async (page, env) => {
      const value = JSON.stringify(sandboxSessionFor(env))
      await page.addInitScript(
        ({ key, value }) => {
          try {
            // Seed once per tab: after "Exit sandbox", a reload stays in live mode like it would for a person.
            const marker = `${key}:seeded`
            if (window.sessionStorage.getItem(marker) === value) return
            window.localStorage.setItem(key, value)
            window.sessionStorage.setItem(marker, value)
          } catch {
            // about:blank and other opaque origins have no storage
          }
        },
        { key: SANDBOX_STORAGE_KEY, value },
      )
    })
  },
})

export const viewports = {
  narrow: { width: 390, height: 844 },
  medium: { width: 768, height: 1024 },
  wide: { width: 1440, height: 900 },
} as const

export async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(
    scrollWidth,
    `page scrolls sideways: ${scrollWidth}px of content in a ${clientWidth}px viewport`,
  ).toBeLessThanOrEqual(clientWidth + 1)
}
