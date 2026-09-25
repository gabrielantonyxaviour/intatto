/** ABEL SCENARIO — generated. Fill in selectors and assertions; do not rename step ids.
 *  scenario:   sc_lend
 *  mapping:    2
 *  definition: a4faf14839a9396a170a84de8f13eda4a1caa8446e24588790828be7fb54adc3
 *
 *  Regenerate with: npm run graph -- scenario-spec --product <id>
 *  Your code between the `>>> abel:<id>` markers is preserved across regeneration.
 */
import { scenario, step } from "./_abel"

scenario("sc_lend", "lender", () => {
  step("lend_connect", "Connect on Market", async ({ page }) => {
    // action:   Open Market and connect the wallet on chain 196.
    // expected: Market is in the connected state and shows USDG supplied, USDG borrowed, utilization, rates and the gap reserve.
    // >>> abel:lend_connect
    await (await import("./_intatto_lend")).connect(page)
    // <<< abel:lend_connect
  })
  step("lend_open", "Open Lend", async ({ page }) => {
    // action:   Follow Lend from Market.
    // expected: Lend shows the wallet's USDG balance, supply rate, utilization and the reserve, with no shares yet.
    // >>> abel:lend_open
    await (await import("./_intatto_lend")).open(page)
    // <<< abel:lend_open
  })
  step("lend_deposit", "Deposit USDG", async ({ page }) => {
    // action:   Approve USDG if needed, then deposit into the vault.
    // expected: Deposit succeeds and links to the explorer; Lend shows the new shares and their USDG value.
    // >>> abel:lend_deposit
    await (await import("./_intatto_lend")).deposit(page)
    // <<< abel:lend_deposit
  })
  step("lend_read_risk", "Read the reserve and the waterfall", async ({ page }) => {
    // action:   Read the supply rate, utilization, the reserve and its funding rule, the deficit history and the waterfall.
    // expected: Every number matches contract reads; the waterfall is explained with the live numbers and the loss warning is visible.
    // >>> abel:lend_read_risk
    await (await import("./_intatto_lend")).risk(page)
    // <<< abel:lend_read_risk
  })
  step("lend_withdraw", "Withdraw USDG", async ({ page }) => {
    // action:   Withdraw USDG within available liquidity.
    // expected: Withdraw succeeds and links to the explorer; shares fall and the USDG balance rises by their value.
    // >>> abel:lend_withdraw
    await (await import("./_intatto_lend")).withdraw(page)
    // <<< abel:lend_withdraw
  })
})
