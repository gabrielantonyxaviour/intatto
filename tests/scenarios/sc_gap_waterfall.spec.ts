/** ABEL SCENARIO — generated. Fill in selectors and assertions; do not rename step ids.
 *  scenario:   sc_gap_waterfall
 *  mapping:    1
 *  definition: dc7f088256df8f6fb8b1c2cb7f88400e5810e513414c446e3837d469d58e7971
 *
 *  Regenerate with: npm run graph -- scenario-spec --product <id>
 *  Your code between the `>>> abel:<id>` markers is preserved across regeneration.
 */
import { scenario, step } from "./_abel"

scenario("sc_gap_waterfall", "judge", () => {
  step("gap_replay_jan", "Replay the Jan 2025 gap", async ({ page }) => {
    // action:   On Sandbox, replay the 24–27 Jan 2025 NVDA weekend gap.
    // expected: The replay runs and is labelled CFD data; the ledger lists it with source, retrieval time and hash.
    // >>> abel:gap_replay_jan
    throw new Error("TODO: implement step gap_replay_jan")
    // <<< abel:gap_replay_jan
  })
  step("gap_slices", "Follow the liquidation slices", async ({ page }) => {
    // action:   On the Risk console, follow the liquidation after the Monday reopen.
    // expected: Slices are listed with size, price and proceeds, each within the depth-bounded size; the position ends fully closed.
    // >>> abel:gap_slices
    throw new Error("TODO: implement step gap_slices")
    // <<< abel:gap_slices
  })
  step("gap_reserve_absorbs", "Reserve absorbs the shortfall", async ({ page }) => {
    // action:   Read the reserve and deficit figures on the Risk console.
    // expected: The reserve balance falls by the shortfall and no deficit is recorded.
    // >>> abel:gap_reserve_absorbs
    throw new Error("TODO: implement step gap_reserve_absorbs")
    // <<< abel:gap_reserve_absorbs
  })
  step("gap_replay_synthetic", "Replay the gap larger than the reserve", async ({ page }) => {
    // action:   On Sandbox, replay the synthetic gap larger than the reserve.
    // expected: The replay is labelled synthetic and listed in the ledger.
    // >>> abel:gap_replay_synthetic
    throw new Error("TODO: implement step gap_replay_synthetic")
    // <<< abel:gap_replay_synthetic
  })
  step("gap_deficit_on_lend", "See the deficit on Lend", async ({ page }) => {
    // action:   Open Lend in the sandbox.
    // expected: Lend is in the deficit state: the deficit appears in the history with its amount and the share value is reduced.
    // >>> abel:gap_deficit_on_lend
    throw new Error("TODO: implement step gap_deficit_on_lend")
    // <<< abel:gap_deficit_on_lend
  })
})
