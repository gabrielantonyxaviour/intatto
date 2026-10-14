# Shot list against the new layout (script v2, 10 beats)

## Beat map (v2)

| # | Beat id | Picture | UI takes used |
|---|---|---|---|
| 1 | cold-open | motion only (real Fri 24 Jan 2025 minute bars, the dial) | none |
| 2 | problem | motion only (weekend dark, real Monday gap, 405 dots) | none |
| 3 | idea | motion: session dial + limit bar | optional `market` insert (session, max LTV, fixed 65%) |
| 4 | real | floating UI + OKLink callouts | `borrow-mainnet`, `explorer` |
| 5 | saturday | floating UI, dial spins to Saturday, SESSIONLIMIT stamp | `weekend` |
| 6 | replay | motion: real NVDA chart + LTV meter, UI insert | `replays` (January part) |
| 7 | worst | motion: slices, reserve tank, lender loss, UI insert | `replays` (synthetic part) |
| 8 | proof | motion: hash columns lock, UI insert | `proof` |
| 9 | agents | motion: keeper heartbeat, agent Q&A, UI insert | `agents`, `keeper`, `keeper-explorer` |
| 10 | close | motion only | none |

Motion scenes are primary from beat 6 on. The UI takes are inserts that prove the motion is real, so hold the
key states long enough (≥ 2.5 s) for a 3–4 s insert.

close-guard 1.0.0 · for the recording helpers (filming from ~20:00 UTC, after the 19:30 screen freeze) and for
the edit. Written against `design/ia/IA_PLAN.md`. Where the built screens differ from the plan, film what is built
and keep the **take names and mark labels exactly as below**: the edit timeline cues every cut from them.

## Rules for every take

- Rig: `film/recorder/rig.mjs` (1440×900 CSS px, 30 fps, drawn cursor, eased moves, `f.mark(label)`). One script per
  take in `film/recorder/takes/<take>.mjs`. Update selectors to the new DOM; keep take names and mark labels.
- **Before the 20:00 recordings, upgrade the rig:** (1) launch Chromium with
  `args: ["--force-device-scale-factor=2"]` so the screencast captures 2880×1800 frames at the same 1440×900 layout
  (tested 25 Sep; check the frame rate with a 10 s test take, and lower the JPEG quality to 85 if it drops below ~24 fps);
  (2) log the cursor position with each frame (or at least at every glide end and every mark) in `take.json`, so the
  edit can zoom to the cursor.
- Every raw take is kept in `film/raw/<take>-<stamp>/`. A retake gets a new stamp. Nothing is deleted.
- Mainnet takes use `READ_ONLY_WALLET()`: the demo wallet 0x7F23…a415 for reads, and every signature refused. No
  mainnet transaction is ever sent.
- Hold 1.5–2.5 s after every mark whose state the voice-over names, so the edit has room. Glide the cursor to the
  thing being named. No random mouse movement.
- **Any detail the voice-over names must be visible on camera.** If it sits in a popover, sheet or collapsed
  section, open it in the take (click, never hover-only), hold, then close it (Escape) before navigating.
- Before filming, ask cg-build whether a deploy is running. Don't film during one.
- Don't open Risk → "Loans near liquidation" after the synthetic run unless cg-build confirms that fix is live.
- After each take, check frames at every mark (`node film/recorder/marks.mjs <take>` and grab frames with ffmpeg).
  Retake if a spinner, a skeleton, an error state or a toast covers the named detail.

## Takes

### `market` · beat 3 (optional insert) · live mainnet, not connected
Route `/`. Marks:
`loaded` (headline values settled) → `session` (cursor on the selected market's session state) → `max-ltv` (current
max new-borrow LTV) → `threshold` (liquidation threshold 65%) → `relay` (the permanent "trusted relayer" line;
open its definition popover, hold 2.5 s, Escape) → `reserve` (reserve / deficit status row) → `end`.

### `borrow-mainnet` · beat 4 · live mainnet, read-only demo wallet
Route `/borrow`. Marks:
`loaded` → `connect` (open the wallet control, choose the injected "Browser wallet") → `connected` (chain badge
X Layer and 0x7F23…a415 visible) → `collateral` → `debt` → `ltv-health` (LTV ~36%, health 1.79) → `can-fall`
(the short gap-risk cue / liquidation price, "NVDA can fall ~44%") → `monday-gap` (open "Monday gap scenarios",
hold until every row and the lender-loss column are readable) → `end`. Don't type an amount and don't open Review.

### `explorer` · beat 4 · OKLink, no re-film needed
The existing take `explorer-2026-09-25T10-58-19` stays valid: `borrow-row` (the `borrow` from 0x7f23…3e12a415
at 10:15:44 UTC) → `contracts-tab` ("Contract source code verified · CollateralMarket").

### `weekend` · beat 5 · hosted sandbox, new session
Route `/sandbox`. Marks:
`start-click` → `session-ready` (burner connected, balances) → `to-borrow` → `loan-typed` (collateral 4 NVDAx, loan
300 USDG) → `review` (the review dialog opens) → `approve` → `deposit` → `borrow` → `borrowed` (receipt in the dialog)
→ `review-close` → `to-sandbox` → `saturday-click` (Jump to Saturday) → `saturday-done` (result + CLOSED) →
`to-borrow-2` → `limit` (cursor on the CLOSED limit, ~28%, "falls to 20% by Monday") → `try-more` (type 10) →
`refused` (inline "Refused: SessionLimit", hold 3 s) → `repay-tab` → `repay-review` → `repay` → `repaid` (receipt:
repaid, and "repay works in every session" if it's shown) → `end`.
Speed-ups happen in the edit. Film at real speed.

### `proof` · beat 8 · hosted sandbox
Start a new session on `/sandbox`, then press "Prove this is a real fork". Marks:
`proof-click` → `checks-running` → `checks-done` (all 4 checks passed, hold 3 s) → `raw-values` (open one "Raw values"
sheet, the bytecode/contracts check preferred; hold 2.5 s; Escape) → `ledger` (open "View ledger"; hold 2.5 s;
Escape) → `end`.

### `replays` · beats 6–7 · hosted sandbox, one session, in this order
Start a new session. Marks:
`scroll-scenarios` → `jan-click` ("Replay the January 2025 gap", CFD/Dukascopy label visible on the card) → `jan-done`
→ `jan-ledger` (open View ledger: top row "gap replay finished: Monday open gap 12.47% … 0 bounded liquidation
slices" and the Dukascopy source; hold 3 s; Escape) → `to-risk` → `risk-loans` (Loans near liquidation: the scenario
loan ~59.6%, under 65%) → `risk-liqs` (Liquidations: no liquidation; reserve untouched) → `to-sandbox` → `syn-click`
("Run a synthetic 45% gap", Synthetic label visible) → `syn-done` → `to-risk-2` → `risk-liqs-2` (the slice row, reserve
0.00, lender deficit ~147.69) → `to-lend` → `primer-lose` (if the primer opens: "Lenders can lose money", hold 3 s,
then close it) → `share-price` → `deficit` (open Deficits: ~147.69 USDG written off, share price before → after; hold 3 s)
→ `end`.

### `agents` · beat 9 · live mainnet
Route `/agents`. Marks:
`loaded` → `credit-card` → `listing` (the "under review" status, whatever it reads at filming time) → `try-it` →
`type-wallet` (0x7F23b131F7312bd0f63EF79974E215Dc3E12a415) → `submit` → `report` (inline session, debt, capacity) →
`response-details` (open Response details: price, fetch time, liquidation price, gap, JSON; hold 3 s) → `end`.

### `keeper` · beat 9 · live mainnet
Route `/risk`, then open the keeper service log sheet (`#keeper` should open it directly). Marks:
`loaded` → `keeper-sheet` (posts with their transactions, hold 3 s) → `end`. If the mainnet read fails on the day,
skip this take. The edit falls back to `keeper-explorer`.

### `keeper-explorer` · beat 9 · OKLink
Re-film at ~20:00 so the newest posts are current (the existing take stays as a fallback). Keeper address
0xaBa1F7e4FB0500696855BF38012676c10e3ef808. Marks: `loaded` → `rows` (the `post` / `postSession` rows) → `end`.
The OKLink list can load empty in headless mode, so reload until rows appear (the script already retries).

## Non-UI shots
All motion graphics are specified in `MOTION_BRIEF.md` (the session dial, the cold open, the problem, the idea, the
replay chart, the reserve tank, the proof lock, the heartbeat and the close) and are built in Remotion. Every
simulated scene carries its label on screen.
