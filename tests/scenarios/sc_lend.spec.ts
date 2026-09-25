/** ABEL SCENARIO — generated. Fill in selectors and assertions; do not rename step ids.
 *  scenario:   sc_lend
 *  mapping:    1
 *  definition: aac716a5b707be25fefbc19cf537c116c16190818b1a53a03465f1fc5461508c
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
    throw new Error("TODO: implement step lend_connect")
    // <<< abel:lend_connect
  })
  step("lend_open", "Open Lend", async ({ page }) => {
    // action:   Follow Lend from Market.
    // expected: Lend shows the wallet's USDG balance, supply rate, utilization and the reserve, with no shares yet.
    // >>> abel:lend_open
    throw new Error("TODO: implement step lend_open")
    // <<< abel:lend_open
  })
  step("lend_deposit", "Deposit USDG", async ({ page }) => {
    // action:   Approve USDG if needed, then deposit into the vault.
    // expected: Deposit succeeds and links to the explorer; Lend shows the new shares and their USDG value.
    // >>> abel:lend_deposit
    throw new Error("TODO: implement step lend_deposit")
    // <<< abel:lend_deposit
  })
  step("lend_read_risk", "Read the reserve and the waterfall", async ({ page }) => {
    // action:   Read the supply rate, utilization, the reserve and its funding rule, the deficit history and the waterfall.
    // expected: Every number matches contract reads; the waterfall is explained with the live numbers and the loss warning is visible.
    // >>> abel:lend_read_risk
    throw new Error("TODO: implement step lend_read_risk")
    // <<< abel:lend_read_risk
  })
  step("lend_withdraw", "Withdraw USDG", async ({ page }) => {
    // action:   Withdraw USDG within available liquidity.
    // expected: Withdraw succeeds and links to the explorer; shares fall and the USDG balance rises by their value.
    // >>> abel:lend_withdraw
    throw new Error("TODO: implement step lend_withdraw")
    // <<< abel:lend_withdraw
  })
})
