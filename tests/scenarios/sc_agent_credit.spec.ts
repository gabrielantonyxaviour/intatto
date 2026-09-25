/** ABEL SCENARIO — generated. Fill in selectors and assertions; do not rename step ids.
 *  scenario:   sc_agent_credit
 *  mapping:    2
 *  definition: e4f182dcca5751cb8759b49484d60d99a43ee99d8d4c4fbe0b56f9738a61f9ec
 *
 *  Regenerate with: npm run graph -- scenario-spec --product <id>
 *  Your code between the `>>> abel:<id>` markers is preserved across regeneration.
 */
import { scenario, step } from "./_abel"

scenario("sc_agent_credit", "agent", () => {
  step("agent_call", "Call the credit and health service", async ({ page }) => {
    // action:   Call the service for a wallet and the NVDAx market.
    // expected: The call returns the documented JSON and is shown on Agents.
    // >>> abel:agent_call
    await (await import("./_intatto_credit")).call(page)
    // <<< abel:agent_call
  })
  step("agent_answer_matches", "Check the answer against the chain", async ({ page }) => {
    // action:   Compare each field with direct contract reads.
    // expected: Session, capacity, price with fetch time, guards, liquidation price and the liquidating gap all equal the onchain values.
    // >>> abel:agent_answer_matches
    await (await import("./_intatto_credit")).chain(page)
    // <<< abel:agent_answer_matches
  })
  step("agent_screen", "See the call and the listing status", async ({ page }) => {
    // action:   Open Agents.
    // expected: Agents shows the call and its response, the payment receipt when paid, and the actual OKX AI listing status: listed, or under review stated plainly.
    // >>> abel:agent_screen
    await (await import("./_intatto_credit")).screen(page)
    // <<< abel:agent_screen
  })
})
