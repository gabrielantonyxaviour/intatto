/** ABEL SCENARIO — generated. Fill in selectors and assertions; do not rename step ids.
 *  scenario:   sc_fork_proof
 *  mapping:    2
 *  definition: 25f6a35ab1095f2982ab9277f505bf2484f022bc5ad586874dddcb5b32c52513
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
    await (await import("./_intatto_proof")).open(page)
    // <<< abel:proof_open
  })
  step("proof_checks_run", "Run the four checks", async ({ page }) => {
    // action:   Let the checks run.
    // expected: All four checks run in the browser and turn green.
    // >>> abel:proof_checks_run
    await (await import("./_intatto_proof")).checks(page)
    // <<< abel:proof_checks_run
  })
  step("proof_raw_values", "Read the raw values", async ({ page }) => {
    // action:   Open each check's raw values.
    // expected: Each check shows the values from both RPCs side by side.
    // >>> abel:proof_raw_values
    await (await import("./_intatto_proof")).raw(page)
    // <<< abel:proof_raw_values
  })
  step("proof_ledger_commands", "Read the ledger and the commands", async ({ page }) => {
    // action:   Read the ledger, the RPC URL, the cast commands and the reproduce command.
    // expected: The ledger, the public sandbox RPC URL, copyable cast commands and the reproduce command are shown, with the simulation note.
    // >>> abel:proof_ledger_commands
    await (await import("./_intatto_proof")).commands(page)
    // <<< abel:proof_ledger_commands
  })
})
