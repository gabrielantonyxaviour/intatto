/** ABEL SCENARIO — generated. Fill in selectors and assertions; do not rename step ids.
 *  scenario:   sc_corporate_action
 *  mapping:    1
 *  definition: a15290f2b40d4184d1e2c3459767850b96370720950333a26a136ad035668870
 *
 *  Regenerate with: npm run graph -- scenario-spec --product <id>
 *  Your code between the `>>> abel:<id>` markers is preserved across regeneration.
 */
import { scenario, step } from "./_abel"

scenario("sc_corporate_action", "judge", () => {
  step("ca_replay", "Replay the activation", async ({ page }) => {
    // action:   On Sandbox, replay a corporate-action activation.
    // expected: The replay starts, and the ledger lists it with its source.
    // >>> abel:ca_replay
    throw new Error("TODO: implement step ca_replay")
    // <<< abel:ca_replay
  })
  step("ca_risk_window", "Read the window on the Risk console", async ({ page }) => {
    // action:   Open the Risk console.
    // expected: The Risk console is in the corporate-action state and shows the multiplier before and after and the pause window.
    // >>> abel:ca_risk_window
    throw new Error("TODO: implement step ca_risk_window")
    // <<< abel:ca_risk_window
  })
  step("ca_borrow_paused", "Borrow inside the window", async ({ page }) => {
    // action:   On Borrow, try to borrow.
    // expected: The borrow is refused with CorporateActionPending; repay stays available.
    // >>> abel:ca_borrow_paused
    throw new Error("TODO: implement step ca_borrow_paused")
    // <<< abel:ca_borrow_paused
  })
  step("ca_past_activation", "Move past activation", async ({ page }) => {
    // action:   Jump past the activation time.
    // expected: Sandbox is in the warped state; the post-activation price is posted.
    // >>> abel:ca_past_activation
    throw new Error("TODO: implement step ca_past_activation")
    // <<< abel:ca_past_activation
  })
  step("ca_borrow_resumes", "Borrow resumes", async ({ page }) => {
    // action:   On Borrow, borrow again.
    // expected: The borrow succeeds; the Risk console no longer shows the window as active.
    // >>> abel:ca_borrow_resumes
    throw new Error("TODO: implement step ca_borrow_resumes")
    // <<< abel:ca_borrow_resumes
  })
})
