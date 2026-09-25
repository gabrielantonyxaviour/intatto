/** ABEL SCENARIO — generated. Fill in selectors and assertions; do not rename step ids.
 *  scenario:   sc_fork_proof
 *  mapping:    1
 *  definition: 4aba1e6bbad45e4108a8305d30c2e401e0e8648d47e8e88e1fa0cd57dd344c9b
 *
 *  Regenerate with: npm run graph -- scenario-spec --product <id>
 *  Your code between the `>>> abel:<id>` markers is preserved across regeneration.
 */
import { scenario, step } from "./_abel"

scenario("sc_fork_proof", "judge", () => {
  step("proof_open", "Open the proof page from Sandbox", async ({ page }) => {
    // action:   On Sandbox, follow the link to the fork proof.
    // expected: Sandbox shows the fork block, and its link opens the fork proof page.
    // >>> abel:proof_open
    throw new Error("TODO: implement step proof_open")
    // <<< abel:proof_open
  })
  step("proof_checks_run", "Run the four checks", async ({ page }) => {
    // action:   Let the checks run.
    // expected: All four checks run in the browser and turn green.
    // >>> abel:proof_checks_run
    throw new Error("TODO: implement step proof_checks_run")
    // <<< abel:proof_checks_run
  })
  step("proof_raw_values", "Read the raw values", async ({ page }) => {
    // action:   Open each check's raw values.
    // expected: Each check shows the values from both RPCs side by side.
    // >>> abel:proof_raw_values
    throw new Error("TODO: implement step proof_raw_values")
    // <<< abel:proof_raw_values
  })
  step("proof_ledger_commands", "Read the ledger and the commands", async ({ page }) => {
    // action:   Read the ledger, the RPC URL, the cast commands and the reproduce command.
    // expected: The ledger, the public sandbox RPC URL, copyable cast commands and the reproduce command are shown, with the simulation note.
    // >>> abel:proof_ledger_commands
    throw new Error("TODO: implement step proof_ledger_commands")
    // <<< abel:proof_ledger_commands
  })
})
