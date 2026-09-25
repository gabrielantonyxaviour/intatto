/** ABEL SCENARIO — generated. Fill in selectors and assertions; do not rename step ids.
 *  scenario:   sc_borrow
 *  mapping:    1
 *  definition: ca236f0a019a0b9eba1435e58d7319d9010d327bf4e7540164600a2460b7f852
 *
 *  Regenerate with: npm run graph -- scenario-spec --product <id>
 *  Your code between the `>>> abel:<id>` markers is preserved across regeneration.
 */
import { scenario, step } from "./_abel"

scenario("sc_borrow", "borrower", () => {
  step("borrow_connect", "Connect on Market", async ({ page }) => {
    // action:   Open Market and connect the wallet on chain 196.
    // expected: Market is in the connected state: session, max new-borrow LTV, relayed NVDAx price with the keeper's fetch time and guard status, and the relay disclosure are shown, with the wallet address on chain 196.
    // >>> abel:borrow_connect
    throw new Error("TODO: implement step borrow_connect")
    // <<< abel:borrow_connect
  })
  step("borrow_open", "Open Borrow with no position", async ({ page }) => {
    // action:   Follow Borrow from Market.
    // expected: Borrow shows the wallet's NVDAx balance and no position.
    // >>> abel:borrow_open
    throw new Error("TODO: implement step borrow_open")
    // <<< abel:borrow_open
  })
  step("borrow_deposit", "Deposit NVDAx", async ({ page }) => {
    // action:   Approve NVDAx, then deposit it as collateral.
    // expected: Two transactions, approve then deposit, each linked to the explorer. The position shows collateral in NVDAx and wNVDAx units with the current multiplier and its value.
    // >>> abel:borrow_deposit
    throw new Error("TODO: implement step borrow_deposit")
    // <<< abel:borrow_deposit
  })
  step("borrow_capacity", "Read capacity for the session", async ({ page }) => {
    // action:   Read the borrowing capacity shown for the current session.
    // expected: Capacity equals the collateral value times the current session's max LTV, using the relayed price.
    // >>> abel:borrow_capacity
    throw new Error("TODO: implement step borrow_capacity")
    // <<< abel:borrow_capacity
  })
  step("borrow_borrow", "Borrow USDG within the limit", async ({ page }) => {
    // action:   Enter an amount within capacity, borrow and sign.
    // expected: The borrow succeeds, links to the explorer, and the wallet's USDG balance and debt rise by the amount.
    // >>> abel:borrow_borrow
    throw new Error("TODO: implement step borrow_borrow")
    // <<< abel:borrow_borrow
  })
  step("borrow_health", "Read health and the Monday-gap table", async ({ page }) => {
    // action:   Read debt, LTV, health, the liquidation price and the Monday-gap table.
    // expected: Debt includes accrued interest; LTV, health and the liquidation price agree with contract reads; the table lists the Monday-open drops that would liquidate the position and whether lenders would lose.
    // >>> abel:borrow_health
    throw new Error("TODO: implement step borrow_health")
    // <<< abel:borrow_health
  })
  step("borrow_repay", "Repay in full", async ({ page }) => {
    // action:   Repay the whole debt.
    // expected: Repay succeeds and links to the explorer; debt shows zero.
    // >>> abel:borrow_repay
    throw new Error("TODO: implement step borrow_repay")
    // <<< abel:borrow_repay
  })
  step("borrow_withdraw", "Withdraw the collateral", async ({ page }) => {
    // action:   Withdraw all the collateral.
    // expected: Withdraw succeeds and links to the explorer; Borrow returns to no position.
    // >>> abel:borrow_withdraw
    throw new Error("TODO: implement step borrow_withdraw")
    // <<< abel:borrow_withdraw
  })
})
