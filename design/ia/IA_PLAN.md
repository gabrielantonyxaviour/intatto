# Intatto information architecture plan

Plan only · 25 September 2026 · close-guard 1.0.0 · Track B

## Decision and evidence

Make each route start with its current state and useful action. Market answers “what can I do now?”, Borrow and Lend execute a transaction, Risk explains restrictions and losses, Agents runs a credit query, Sandbox runs an experiment, and Fork proof shows the experiment's evidential limits. Definitions and reproduction instructions should not occupy the same hierarchy as balances and actions.

This is functional ReUI/shadcn work, with existing neutral styles and no product look tokens. It does not change contracts, economics, data sources, permissions, listing status, or the shell/wallet work owned by Track A. Existing built screens will need coordinator-managed Circuit rework before implementation; this document is not an approval or a Circuit mutation.

Inspected the live `/`, `/borrow`, `/lend`, `/risk`, `/agents`, `/agents/credit`, `/sandbox`, and `/sandbox/proof`, including a newly started populated sandbox. Its proof report displayed four of four passed; that is an observed UI state, not a fresh harness certification. Visually inspected Market at desktop width, Sandbox at desktop/768/390 widths, and Fork proof at 390px. Sandbox identity prose pushes controls below the initial viewport; proof reproduction material precedes the check results. These are planning observations, not a complete responsive acceptance run.

Read `web/components/**` for these surfaces, `design/flows/SUMMARY.md`, `design/flows/screen-flows.json`, the captures cited below, and the eight scenario specs with `_intatto*.ts` helpers. The read-only evidence command `ABEL_URL=http://127.0.0.1:4179 bash .abel/graph scenario-evidence --product close-guard --version 1.0.0 --scenario <id>` reported `mappingCurrent: true` for all eight scenarios below. No scenario tests were rerun for this plan. `.abel/graph check-project` returned `Wiring valid: close-guard`.

Component paths below are relative to `web/components/`. Quoted token-specific copy is the rendered NVDAx example; implement removals in the source template without hardcoding a market.

Reference captures establish information hierarchy, not Intatto behavior. Do not import Aave thresholds, Liquity rate-setting, Morpho vault mechanics, or Tenderly product limits. Tenderly captures are documentation with embedded dashboard examples, not evidence of a tested paid dashboard.

## Shared patterns and hard constraints

- **One-click evidence:** every currently asserted number/state remains inline or behind a directly visible trigger. Opening a sheet exposes all asserted fields, including raw values and provenance; never require a sheet followed by an accordion. A Risk view counts as the one click, so asserted rows within that view remain expanded. A transaction's required review/approval sequence is not an informational disclosure shortcut.
- **One definition popover:** labelled info button, click/Enter/Space to open, Escape to close, focus returned to trigger. One short explanation plus units/source when relevant. Tooltip may duplicate a short definition but is never the only access. Relay, health, LTV, wrapper shares, guards and rate definitions use this pattern. Failures and their recovery actions remain inline. (`rule/smallest-intervention`, `rule/accessible-name-required`, `rule/keyboard-complete-flow`.)
- **One evidence sheet:** title names market/session/check, summary identifies the source and as-of block/time, then complete values or chronological rows. Copy controls name the copied item. Use a full-width sheet at narrow widths, scroll inside it, wrap addresses, and keep close reachable. No nested sheets or second disclosure for asserted fields. Empty, fetching, unavailable and partial scan are distinct states. (`rule/cover-reachable-states`, `rule/error-states-recovery`.)
- **One transaction review dialog:** amount, asset, chain, before/after position or shares, relevant limit, wallet steps, fee information actually available, then named action. Reuse existing simulations and approval sequencing. Retain inputs on cancel/rejection; show retry beside the failed step. Completed approvals/deposits remain completed if a later step fails. Receipt and explorer links persist until dismissed. Never imply an atomic bundle or undo. Primer, review and wallet UI must not create nested application dialogs. (`rule/no-nested-modals`, `rule/preserve-user-input`, `rule/name-object-scope-consequence`, `rule/undo-only-when-honest`.)
- **Navigation versus action:** routes and Risk views are links; state changes are buttons. Preserve `/borrow?market=…`, existing Risk hashes and useful anchor links. Mobile Risk navigation uses wrapping direct links, not a select followed by a second choice. A deep link to moved content opens it immediately. (`rule/navigation-vs-action`, `rule/control-matches-cardinality`.)
- **Truth stays visible:** network/sandbox distinction, stale data, active guard failures, current borrowing cap, paused actions, lender-loss warning, deficit, synthetic-data labels and incomplete proof never disappear into a definition. No zero placeholders for unavailable reads. Stable loading labels and layout; block only actions whose required reads failed. (`rule/loading-stable-labels`, `rule/error-states-recovery`.)
- **Portal-aware tests:** retain semantic labels and existing test IDs where their meaning remains. Dialog/sheet content is rendered through portals, so update parent-scoped locators explicitly rather than duplicating hidden DOM. Only one authoritative copy of each asserted value. Idempotent helpers open disclosures only when closed, dismiss before navigation, and preserve transaction hashes for later receipt assertions.

## 1. Market — `/`

**Stays, in order:** short purpose line; four compact headline values (deposits, loans, idle liquidity, utilisation); market table with assets, supply/borrow rates and route actions; selected-market summary and connected wallet position/action card. Keep reserve and any deficit visible as a compact status row rather than another explanation card. Disconnected state has one clear connect action; connected state prioritises Borrow USDG and Lend USDG with balances and position.

The selected market keeps session, current max new-borrow LTV, liquidation threshold, accepted price and fetch time, cap used/limit, and guard outcomes visible. Present these as a compact definition list beside the action context. Keep a permanent concise relay disclosure (“Price supplied by a trusted relayer”) and surface any rejected/stale state inline. Do not remove the relay disclosure entirely into a tooltip: it is an explicit product constraint.

**Moves:** relay bounds, keeper liveness and guard meanings → definition popovers; complete weekly session schedule → one directly opened collapsed section; accepted price history and keeper records → separate directly opened evidence sheets; wrapper and contract addresses → Contracts sheet. The wallet card moves above the technical material. Selecting another market must not require opening an additional panel to find its ordinary limits.

**Remove outright:** “How much you can borrow follows the US market session; the liquidation line stays put.” from `market/market-screen.tsx` (current limits express this more precisely); “Your balances and position in the NVDAx market.” from `market/your-info.tsx` (resolved symbol example; the card title already identifies the market); “Newest first. Each post passed the relay's checks when it landed.” from `market/price-panel.tsx` (use a dated accepted-post table with explicit accepted status, not repeated prose). Do not remove timestamp or acceptance evidence with the sentence.

**References:** `design/flows/aave/01-markets-list.png` for totals → market rows → actions; `design/flows/aave/m01-markets-mobile.png` for mobile metric grouping; `design/flows/kamino/08-oracle-tooltip.png` for compact risk/price context with explanation on demand. Proposed sheets are an Intatto adaptation, not a claim that those captures show sheets.

**Estimate:** 4–6 hours, including Market locator changes and responsive review. Main risk: retaining selected-market scoping without duplicating values in portals.

## 2. Borrow — `/borrow`

**Stays:** collateral/loan form first, wallet balances, amount/max controls, available borrowing capacity, session limit and current rate; compact position showing collateral value, debt, LTV, health and liquidation price. Keep current session and liquidation threshold next to the amount decision. Deposit, borrow, repay and withdraw retain their existing permissions and simulations. Refusal reason, disabled action and repayment availability remain immediately visible; never require opening a review to discover an already-known refusal.

**Moves:** accepted Review opens the shared transaction dialog instead of replacing the working form inline. Keep Approve/Deposit/Borrow steps and progress explicit. “Back to form” closes review and retains inputs. Wrapper share count, multiplier and conversion detail → directly opened Collateral details sheet; full Monday-gap table → directly opened collapsed “Monday gap scenarios” section, with every row and estimated lender loss immediately exposed. Keep a short gap-risk cue visible. Definitions → popovers; contract addresses → Contracts sheet. Do not turn position health into a tooltip-only value.

**Remove outright:** “Deposit NVDAx and borrow USDG against it. How much you can borrow follows the US market session; the liquidation line stays at 65% LTV around the clock.” from `borrow/borrow-screen.tsx` (resolved token/current threshold). Fields identify assets, and explicit current/session versus liquidation limits replace the paragraph. Preserve the statement that repaying is available independently of new-borrow restrictions; it is material behavior and tested.

**References:** `design/flows/liquity-borrow/4-loan-low-risk.png` for form-led hierarchy and adjacent risk consequences; `design/flows/morpho/07-review-confirm.png` for before/after review; `design/flows/liquity-borrow/13-signature-rejected-retry.png` for retained receipt context and a recoverable rejected step. No new manual interest-rate setting is implied.

**Estimate:** 5–7 hours, including shared-review integration and Borrow helper changes. Highest risk: partial completion and background-position assertions while a modal remains open.

## 3. Lend — `/lend`

**Stays:** Deposit/Withdraw control, wallet USDG, amount/max, supply rate, owned shares and their USDG value, share price, idle liquidity and utilisation. Keep reserve balance and deficit total visible. Keep the concise warning that lenders can lose principal, the single-market exposure, and the idle-liquidity withdrawal limit. The current primer gate remains; it closes before any transaction review opens.

**Moves:** deposit and withdrawal confirmation → shared review dialog with amount, shares/underlying estimate, approval steps and relevant liquidity limit; earnings projections → one directly opened Earnings popover clearly labelled estimates. Detailed reserve funding, the 20% interest allocation, loss waterfall and worked loss example → one “Risk and reserve” sheet, all exposed together. Deficit history with before/after share prices → direct “Deficits” sheet, distinct from the visible deficit total. Allocation table and rate curve → two independent collapsed sections. Existing `#risk` entry opens the risk sheet directly.

**Remove outright:** “The vault lends to one market, whose borrowing limits follow the US stock market session.” from `lend/vault-hero.tsx`; “The vault lends to one market. Every USDG that is not idle is owed by people borrowing against NVDAx.” from `lend/allocation-section.tsx` (resolved current-market sentence). A visible “Exposure: NVDAx” label plus actual allocation and idle figures supplies the useful information without repeating the introduction. If deployments contain multiple markets, retain their actual exposure list; do not hardcode NVDAx.

**References:** `design/flows/morpho/21-vault-page.png` for position/metrics beside a transaction panel; `design/flows/morpho/23-vault-allocation.png` for allocation as secondary analysis; `design/flows/aave/10-supply-review-confirm.png` for a concrete receipt naming asset, rate, receipt token and next wallet action.

**Estimate:** 5–7 hours, including review receipts, idle-liquidity failure checks and sheet locator updates. No change to withdrawal availability or deficit accounting.

## 4. Risk — `/risk`

**Stays:** concise current summary (session, accepted price/as-of, new-borrow limit, cap use, reserve and deficit), Refresh, scan coverage and direct analysis links. Preserve the current one-view-at-a-time structure. Prices shows timestamp/spot/TWAP/divergence/guards; Sessions shows current session, complete schedule and timeline; Corporate actions shows pending event, before/after multiplier, activation window and pause status; Liquidations shows slices, floor, proceeds, reserve coverage and remaining deficit. Keep all journey-asserted fields in each selected view, without further expansion.

**Moves:** parameter definitions → popovers; contract/source explanation → Data sources sheet; addresses → Contracts sheet. Keeper log detail may use a direct “Keeper service log” sheet from the default console, with all asserted service/action details already visible. The existing `#keeper` link must open that sheet directly; do not make a keeper tab whose rows need another click. Preserve scan bounds outside the sheet and inside its source header. Other nonasserted transaction diagnostics may have optional detail sheets.

**Remove outright:** “Back to the market” from `risk/risk-console.tsx` (the shell Market link provides the same route); “Refreshes every few seconds.” from `risk/overview-view.tsx` (show the actual as-of timestamp/block and Refresh state). Relocate the surrounding contract/source provenance rather than deleting it. Never replace incomplete scans with a healthy-looking empty state.

**References:** `design/flows/risk/01-kamino-risk-summary.png` for compact overview plus persistent analysis navigation; `design/flows/risk/02-oracles-analysis.png` for direct comparative oracle evidence. These support a technical analysis route, not technical prose above every product action.

**Estimate:** 4–6 hours, including hash/deep-link continuity and risk helper scoping. Keep all chain-derived calculations untouched.

## 5. Agents — `/agents` and `/agents/credit`

**Stays:** two service cards with purpose, availability, Free price where true, review/listing status and one useful route action. The credit detail opens with wallet input, Try it, and result summary: session, borrowing capacity and debt. Keep agent identity once, failed/invalid request feedback inline, and the local count labelled “Stored in this browser only.” Keep “under review” visible; a registration or an on-chain task is not a listing approval.

**Moves:** endpoint/method/parameter reference → one collapsed API reference section below the form; result price, fetch time, liquidation/gap details, guards and complete response → direct “Response details” sheet, all fields visible together and copyable as returned JSON. Registration/address material → direct Agent details sheet. Payment explanation, including future x402 receipt behavior → Payment details popover; keep current Free/no-paid-receipt state visible. Do not invent usage analytics or imply a payment happened.

**Remove outright:** “Add your API” and “Outside APIs are not added here. The credit service is the one call an agent can make.” from `agents/catalog.tsx`; remove the search control and its placeholder “Try: credit, health, borrow limit, keeper” while there are only two cards. The former control opens an explanation of something unavailable; it is not an action. Keep the separate listing-status information when deleting its containing notice.

**References:** `design/flows/agents/02-server-page.png` for concise service identity, callable resource, method/path/price and a clear Try action. Intatto's detailed form should precede the API reference. Keep browser-only counts distinct from the reference site's aggregate activity.

**Estimate:** 2–3 hours for both routes, including credit-result helper changes. This is a hierarchy cleanup, not a service-catalog expansion.

## 6. Sandbox — `/sandbox`

**Stays before starting:** title, “No real money moves,” compact parent chain/fork block, Start a session and any service-unavailable reason. Put the action before the technical identity card. Fixed configuration becomes labelled text, not apparent form inputs.

**Stays in a session:** compact fork/chain/time identity, burner connection and balances, time-travel controls, scenario actions, latest action outcome and a short recent-activity list. Group scenarios by intended experiment, each with one-sentence outcome and its provenance category. Keep “Synthetic 45%” and the January CFD/Dukascopy distinction on the respective cards. Keep warnings/errors and session expiry visible. Retain exact useful action labels such as Jump to Saturday and Schedule a 10-for-1 split. Reset and End session remain separate, scoped actions; confirmation must describe current behavior, not promise server deletion or erasure of retained ledger history.

**Moves:** RPC/API URLs, chain configuration, contracts and detailed identity → direct Session details sheet; scenario methods and full provenance → a direct scenario-specific sheet; full ledger → direct “View ledger” sheet with every row and its provenance expanded. No row-level Details gate within that sheet. Recent inline activity is a preview, not a substitute for the full API-derived ledger. Keep “Prove this is a real fork” as a direct link to proof. Do not expose burner secrets in either disclosure.

**Remove outright:** “The only network Intatto runs on.” from `sandbox/start-session.tsx`; “Look at it on” from `sandbox/session-status.tsx` (label links by destination); repeated “What you should see next: ” from `sandbox/scenarios.tsx` (retain the outcome itself); “Prove the weekend and corporate-action behaviour yourself on a fork of X Layer mainnet: move the clock, replay a gap, and watch every screen follow.” from `sandbox/sandbox-screen.tsx` (controls and short outcome labels do this work). Retain “No real money moves.”

**References:** `design/flows/tenderly/01-vnet-overview-home.png` for compact network identity/activity; `design/flows/tenderly/04-vnet-admin-rpc-time-travel.png` for separation of administrative operations and activity evidence. Both are docs captures; the proposed action-first screen is Intatto's design decision.

**Estimate:** 4–6 hours, including expired/unavailable states, ledger helpers and narrow-width review. Do not alter sandbox provisioning, replay math or lifetime policy.

## 7. Fork proof — `/sandbox/proof`

**Stays:** fork block and chain identity, reference-versus-sandbox labels, run time, four named checks with status/counts, Rerun, and “Time after the fork block is a simulation.” Put checks before reproduction instructions. On failure, name the failing check and mismatch/unreachable source inline. Pending, skipped, unreachable and failed are distinct; no aggregate pass while a required check is incomplete. No-session state retains Start sandbox; custom RPC input stays available through a direct collapsed section.

**Moves:** each check has one direct “Raw values: [check]” sheet showing both compared sides, equality/difference flags and its exact cast commands in the same open surface. Anvil reproduction command, reference RPC/fallback and copy controls → direct “Reproduce locally” sheet. Divergence ledger → direct “View ledger” sheet with complete rows and source labels. Do not nest the current command disclosure inside a raw-values sheet. Preserve all four check IDs on the root status cards only; evidence sheets get a separate scope attribute.

**Remove outright:** “Starts your own fork of X Layer at the same block with the sandbox chain id; each check below lists the cast commands to compare it, or this sandbox, with X Layer.” from `fork-proof/report-header.tsx` (reproduction title, named command targets and source labels replace the positional tutorial); repeated “from your sandbox session” beneath individual fields after a single explicit session-source heading has established their source. Do not delete the actual RPC, block, command, fallback or simulation caveat.

**References:** `design/flows/seatbelt/03-check-state-changes.png` for legible before/after evidence; `design/flows/seatbelt/05-check-verified-contracts.png` for per-address verification. These GitHub-report captures support complete comparisons, not a claim that Seatbelt uses sheets.

**Estimate:** 4–6 hours, including four evidence scopes, reproduction/ledger locators and failure-state checks.

## Journey mapping and selector migration

Existing mapping IDs and expectations remain authoritative. The names below are existing steps where available; grouped edge checks refer to their spec/helper behavior. New disclosure actions must be reflected in both Playwright helpers and the scenario's mapped interaction steps. Do not weaken numeric, receipt, nonce, provenance or chain-state expectations to accommodate cleaner screens.

### `sc_borrow` — `tests/scenarios/sc_borrow.spec.ts`, `_intatto_borrow.ts`

- `borrow_connect`: keep `headline-stats`, `market-detail-NVDAx`, `session-value[data-session]`, `tile-max-ltv [data-slot=value]`, `price-value`, `price-fetched-at` and guards on the root. Replace `chip-relay.hover()` with a labelled click; retain/assert `chip-relay-tooltip` content in the resulting popover. Preserve `your-info-connected`.
- `borrow_open`: retain `your-info` → Borrow USDG routing and `position-empty`. `borrow_deposit`: retain `#borrow-collateral` and form Review trigger; scope Approve NVDAx/Deposit, done steps, `review-finished` and explorer links to the review dialog. Close it before asserting background position; open Collateral details once for `position-shares` and multiplier. Remove the old `position-panel` ancestor assumption for moved content.
- `borrow_capacity` / `borrow_borrow`: Back to form now closes the dialog; retain entered values and exact six-decimal capacity/Max comparisons. Keep inline SessionLimit refusal and disabled behavior; open review only for the valid amount, capture receipt, close, then assert debt.
- `borrow_health`: root debt/LTV/health/liquidation-price checks stay; click Monday gap scenarios once before checking `gap-table`, `gap-line`, all row math and estimated lender loss. `borrow_repay` / withdrawal paths: update `repayAll` / `withdrawAll` dialog scope and dismissal, preserving receipt assertions.
- Stale price, out-of-band price, exhausted cap and unhealthy-position edges keep exact failure/nonce checks. Do not move guard failures or repayment availability behind a popover.

### `sc_lend` — `tests/scenarios/sc_lend.spec.ts`, `_intatto_lend.ts`

- `lend_connect`: preserve `stat-deposits`, `stat-loans`, `stat-utilisation`, `stat-reserve`, USDG market supply rate and connected-wallet checks. `lend_open`: retain primer checkbox/Continue behavior and position/rate/reserve values; review cannot open over the primer.
- `lend_deposit`: add Review before approval/submission; move `watchTxLinks` observer and action locators from `deposit-form` into the proposed `lend-deposit-review` dialog. Capture hashes before dismissal, then assert shares/value. Apply equivalent scope changes to `lend_withdraw` and its receipt watcher.
- `lend_read_risk`: open Risk and reserve once for `waterfall-reserve`, `waterfall-lenders`, `waterfall-collateral`, `loss-example` and the 20% interest allocation. Keep `loss-disclosure`, share price and reserve balance inline. Open Deficits directly for `deficits-empty` or historical rows. Update `#risk` from a static region expectation to an open-sheet deep link.
- `deficitMatches`: open Deficits once; retain `deficit-amount`, `deficit-price` before/after and `deficit-total` comparisons, with portal-aware scope. Idle-limit edge keeps the exact “Only 60.00 USDG is idle; the rest is lent out.” refusal and disabled action before review; Max remains bounded by idle liquidity.

### `sc_weekend` — `tests/scenarios/sc_weekend.spec.ts`, `_intatto_sandbox.ts`

- `weekend_start_session`: preserve Start a session, `identity-fork-block`, burner address/Connected state, `balance-NVDAx`, `balance-USDG` and sandbox banner chain/fork/time. These do not move to Session details. `weekend_borrow_weekday`: inherited Borrow review changes; close before LTV/health assertions.
- `weekend_warp`: preserve `time-travel`, Jump to Saturday, `action-result`, banner time and CLOSED state. `weekend_borrow_refused`: exact session limit, zero capacity, SessionLimit, no-send and repay-enabled checks stay inline. `weekend_repay`: inherited review/receipt changes.
- `weekend_risk_session`: Sessions remains a single direct navigation action, including on mobile; keep `risk-console[data-view=sessions]`, timeline, current CLOSED row and Max new-borrow LTV visible in that view.
- `weekend_ledger`: open View ledger once before `ledger` / `ledger-row[data-kind=warp]` and all-row API order comparisons. Expiry, fresh-session/new-burner, service-unavailable and End session edges keep their current outcome assertions; unavailable Start remains disabled with a reason.

### `sc_corporate_action` — spec plus `_intatto_borrow.ts`, `_intatto_sandbox.ts`

- `ca_replay`: preserve scenario identity/provenance and Schedule a 10-for-1 split; inherited review changes apply to setup borrowing. Add direct ledger opening to `ledgerMatchesApi`; remove the separate row Details click in this spec because all source URLs, retrieval times and SHA256 values are exposed when the sheet opens.
- `ca_risk_window`: Corporate actions remains one click; keep `pending-action`, current/before/after multiplier, price, activation window and paused/resolvable status expanded within `#actions`. `ca_borrow_paused`: keep `market-status`, CorporateActionPending refusal and repay/no-nonce behavior inline.
- `ca_past_activation`: preserve Activate the split, resulting time and ledger comparison; open full ledger directly. `ca_borrow_resumes`: use review dialog for the 1 USDG borrow, capture receipt and close; no-pending Risk state remains direct.
- Inconsistent-action edge still expects PriceOutOfBand, all applicable guard failures, pending pause and no liquidation slices. Do not collapse multiple failures into a generic corporate-action notice.

### `sc_gap_waterfall` — spec, `_intatto_gap.ts`, `_intatto_floor.ts`, `_intatto_lend.ts`

- `gap_replay_jan` / `gap_replay_synthetic`: keep action labels and on-card CFD/Dukascopy versus Synthetic 45% provenance. Replace ledger-row Details opening in `_intatto_gap.provenance` with one View ledger opening; complete source/SHA256/provenance must then already be visible.
- January replay retains the corrected expectations: funded near-60% LTV stays below 65%; no liquidation, reserve draw or deficit. Preserve the Liquidations empty state. Do not restore an older narrative implying that this historical gap liquidates the position.
- `gap_slices`: keep all `data-row=slice` / `data-tx-hash` amounts, wrapped collateral, oracle/floor prices and proceeds expanded in the Liquidations view. `gap_reserve_absorbs`: reserve now, covered amount and remaining deficit stay separate in that same view, without another click.
- `gap_deficit_on_lend`: primer handling then direct Deficits opening; reuse migrated `deficitMatches`. CLOSED floor/partial-close versus OPEN full-close edges retain their chain/math assertions; synthetic scenario labels remain visible.

### `sc_agent_credit` — spec and `_intatto_credit.ts`

- `agent_call`: preserve catalog Try it link, Wallet input and Try it action. `uiMatches` first checks inline session/debt/capacity, then opens Response details once for `credit-price`, fetched time, liquidation/gap fields and guards. Keep existing IDs where meaningful; remove old page-section ancestry assumptions.
- `agent_answer_matches`: reuse that helper without toggling an already-open sheet; retain exact schema and block-pinned contract comparisons. `agent_screen`: local call count and “Stored in this browser only.” remain inline, as do identity and under-review status; open Payment details once for the future-x402 explanation. Free calls still have no paid receipt.
- Invalid-input HTTP 400 `{ error, code }` and listing-pending behavior do not change. Do not change expected listing status based on activity elsewhere in the system.

### `sc_fork_proof` — spec and `_intatto_proof.ts`

- `proof_open`: preserve sandbox creation/fork identity and Prove this is a real fork link. `proof_checks_run`: retain exactly four root `[data-check]` elements and each status, plus `[data-slot=rerun]`. New sheets use `data-evidence-for`, not duplicate `[data-check]`.
- `proof_raw_values`: open each named Raw values sheet directly; migrate row ancestry from `[data-check=…]` to `[data-evidence-for=…]`. Retain block-row equality, bytecode/token equality, `u.usdg.supply` difference state and Intatto lens/hash comparisons. Both source values remain present.
- `proof_ledger_commands`: direct View ledger exposes all ledger rows/status; direct Reproduce locally exposes RPC/copy/anvil/fallback. Cast commands are already exposed in each check sheet; remove the old additional Reproduce with cast expansion. Simulation warning stays root-visible.
- Altered-slot failure stays visible on the root State card, with old/new values one click away; unreachable-RPC edge names the unavailable endpoint and never appears as pass.

### `sc_keeper_live` — spec and `_intatto_live.ts`

- `keeper_read_issuer`: update `openRisk('keeper')` / `#keeper` to open the service-log sheet directly. Retain scan bounds, Keeper service log rows, price/session details, halt flags, multiplier and period in its initial contents; update `[data-section=keeper]` scope for the portal. No row Details click.
- `keeper_post`: summary session/price selectors and on-chain receipt comparisons stay unchanged. `keeper_risk_console`: Prices keeps quote/fetch/guard fields inline; Caps keeps sampled depth inline; keeper action links remain immediately available in the directly opened keeper sheet.
- `keeper_market`: preserve `marketMatchesChain` root Market session, price, fetch time and cap-used locators. Out-of-band rejection keeps accepted price unchanged with visible failed guard; backoff retains no-transaction assertions and its logged reason one click away. Do not turn unavailable service evidence into an empty healthy log.

## Implementation order and acceptance

Estimates are developer implementation plus targeted selector/mapping updates per screen, not the time spent writing this plan. Shared primitives/accessibility take 3–4 hours; seven screens total 28–41 hours; final cross-journey/responsive validation takes 4–6 hours: **35–51 hours overall**. Reusing current review internals supports the low end; portal scoping and partial transaction recovery drive the high end. No backend feature work is included.

Build shared disclosure/review contracts first, then Market and Sandbox, Borrow/Lend together, Risk/Proof evidence surfaces, and Agents. Coordinate shell ownership with Track A without changing its files. Keep existing IDs where they still identify the same object. Update mappings alongside the corresponding helper change, then prove the affected journey; do not declare mapping freshness or harness proof from this plan.

Acceptance after implementation: all eight journey suites retain existing numeric/failure assertions; test stale/rejected prices, session pause, exhausted cap, partial wallet completion, idle withdrawal, deficit, expired/unavailable sandbox, altered proof state and unreachable RPC first. Verify each asserted datum is inline or one direct click away, including mobile Risk navigation. Inspect rendered screens at 390, 768 and 1440px, keyboard-open/close every disclosure, restore focus, preserve inputs after cancellation, and check portal scopes contain one authoritative value. Produce no screenshots/videos/proof documents unless requested. A local pass is not deployed proof; deployment remains coordinator-owned and requires a named target.
