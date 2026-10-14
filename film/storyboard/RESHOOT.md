# Re-shoot list for the helpers (when Gabriel lifts the hold)

The first takes in `film/raw` were recorded on 25 Sep 2026, 10:56–11:12 UTC, before three deploys changed the
screens. Re-film on the live versions so the film matches what judges click. The rig and the take scripts are in
`film/recorder/` (`node film/recorder/takes/<take>.mjs`, 1440×900, drawn cursor, marks in `take.json`). The storyboard
and voice-over lines are on the Abel Demo tab and in `VO_SCRIPT.md`.

Live versions at the last update: web 8ecfc928 · keeper 00d6b9b7 · sandbox 169cc954.

**Status (later on 25 Sep): all UI filming is on hold for a layout rework.** Gabriel asked for less
documentation-style text and more product, with details moving into popovers, dialogs and sheets. Track A (chain
badge and wallet dropdown) is being built. Track B (the per-screen layout plan) waits for his approval. Once the new
layout is live, **every app screen take below needs re-filming**, not only the ones marked. Only the OKLink takes
(`explorer`, `keeper-explorer`) stay valid. The storyboard's content (beats, voice-over, sandbox mechanics, mainnet
facts) still holds. Where a detail the voice-over names moves into a popover or sheet, the take must open it on
camera: the price-relay disclosure (beat 2), the Monday-gap table (beat 3), the ledger's source line (beat 6) and
"Lenders can lose money" (beat 7).

| Take | Beat | Why re-film | Notes |
|---|---|---|---|
| `market` | 2 | Market now shows the gap reserve and recognised deficits | |
| `borrow-mainnet` | 3 | New market selector; Monday-gap table has a "Liquidation starts" row and a lender-loss column; capacity to 6 decimals | Read-only wallet; nothing is signed |
| `explorer` | 3 | Keep: OKLink is unchanged | Re-film only if the cut needs a cleaner take |
| `weekend` | 4 | Borrow screens changed; new sandbox build | |
| fork proof (new) | 5 | Not filmed yet | Start a session on `/sandbox`, press "Prove this is a real fork", allow ~20 s for all 4 checks |
| `replays` | 6–7 | New sandbox build; Risk has a "Last issuer read" card and source notes; Lend lists every market (SPYx in the sandbox) | See the constraint below |
| `agents` | 8 | Agents shows "OKX AI listing: under review (agent #13907)" | |
| `keeper-explorer` | 8 | Keep: OKLink is unchanged | |
| mainnet `/risk` (optional) | 8 | Now reads through a cached route and loads the keeper's posts | Can replace or join the OKLink keeper shot |

## Constraints from cg-build

- **Do not film Risk → "Loans near liquidation" after the synthetic-gap run** until cg-build's next deploy is live.
  A forked mainnet borrower shows a double-negative distance ("−-22.2%") and stays unliquidated at 79%, because the
  sandbox keeper watches only two accounts. Filming that view after the January replay and before the synthetic run is fine.
- Ask cg-build before recording around a deploy. They announce each one.
