/** ABEL SCENARIO — generated. Fill in selectors and assertions; do not rename step ids.
 *  scenario:   sc_agent_credit
 *  mapping:    1
 *  definition: 1ee481e2afaf1144eeae9487675d4b0f54344683b1438695ef91418d1eb54625
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
    throw new Error("TODO: implement step agent_call")
    // <<< abel:agent_call
  })
  step("agent_answer_matches", "Check the answer against the chain", async ({ page }) => {
    // action:   Compare each field with direct contract reads.
    // expected: Session, capacity, price with fetch time, guards, liquidation price and the liquidating gap all equal the onchain values.
    // >>> abel:agent_answer_matches
    throw new Error("TODO: implement step agent_answer_matches")
    // <<< abel:agent_answer_matches
  })
  step("agent_screen", "See the call and the listing status", async ({ page }) => {
    // action:   Open Agents.
    // expected: Agents shows the call and its response, the payment receipt when paid, and the listing status.
    // >>> abel:agent_screen
    throw new Error("TODO: implement step agent_screen")
    // <<< abel:agent_screen
  })
})
