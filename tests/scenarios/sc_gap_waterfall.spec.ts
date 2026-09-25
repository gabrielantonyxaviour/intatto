/** ABEL SCENARIO — generated. Fill in selectors and assertions; do not rename step ids.
 *  scenario:   sc_gap_waterfall
 *  mapping:    2
 *  definition: 412a402cfd2b648c7cd3fcce17b4f2dc01e45aed63cbd40f778458324abab012
 *
 *  Regenerate with: npm run graph -- scenario-spec --product <id>
 *  Your code between the `>>> abel:<id>` markers is preserved across regeneration.
 */
import { scenario, step } from "./_abel"

scenario("sc_gap_waterfall", "judge", () => {
  step("gap_replay_jan", "Replay the Jan 2025 gap", async ({ page }) => {
    // action:   On Sandbox, replay the 24–27 Jan 2025 NVDA weekend gap; inspect the position, liquidation and reserve state on Risk after reopen.
    // expected: The replay is labelled Dukascopy CFD minute data with source, retrieval time and sha256 in the ledger. The Monday open is about 12.5% below Friday close. A position borrowed within session limits stays below the fixed 65% liquidation threshold: no liquidation, no reserve draw and no deficit.
    // >>> abel:gap_replay_jan
    await (await import("./_intatto_gap")).january(page)
    // <<< abel:gap_replay_jan
  })
  step("gap_replay_synthetic", "Replay the gap larger than the reserve", async ({ page }) => {
    // action:   On Sandbox, replay the synthetic 45% gap with a shortfall larger than the reserve.
    // expected: The 45% gap is labelled synthetic; the ledger records source, retrieval time and sha256. The position becomes unhealthy and liquidation follows after reopen.
    // >>> abel:gap_replay_synthetic
    await (await import("./_intatto_gap")).synthetic(page)
    // <<< abel:gap_replay_synthetic
  })
  step("gap_slices", "Follow the liquidation slices", async ({ page }) => {
    // action:   On the Risk console, follow liquidation after the synthetic 45% gap and reopen.
    // expected: Synthetic-gap liquidation slices show size, price and proceeds. Each respects the depth cap and minimum output; the unhealthy position is fully closed. The January replay has no liquidation slices.
    // >>> abel:gap_slices
    await (await import("./_intatto_gap")).slices(page)
    // <<< abel:gap_slices
  })
  step("gap_reserve_absorbs", "Reserve absorbs the shortfall", async ({ page }) => {
    // action:   Read the reserve and deficit after the synthetic-gap liquidation on Risk.
    // expected: Recovered collateral proceeds repay debt first. GapReserve pays the shortfall up to its available balance; any remainder is recognised as a lender deficit, never counted as reserve payment.
    // >>> abel:gap_reserve_absorbs
    await (await import("./_intatto_gap")).reserve(page)
    // <<< abel:gap_reserve_absorbs
  })
  step("gap_deficit_on_lend", "See the deficit on Lend", async ({ page }) => {
    // action:   Open Lend in the sandbox.
    // expected: Lend is in the deficit state: the deficit appears in the history with its amount and the share value is reduced.
    // >>> abel:gap_deficit_on_lend
    await (await import("./_intatto_gap")).lend(page)
    // <<< abel:gap_deficit_on_lend
  })
})
