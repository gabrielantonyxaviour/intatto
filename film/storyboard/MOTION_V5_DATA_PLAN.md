# Motion v5 · data beats (07, 08, 09): plan and sources

cg-motion-data (Claude Opus 5.5, high). Code: `film/remotion/src/v3/weekend/` (Beat07), `hood/` (Beat08),
`model/` (Beat09), helpers in `src/v3/datakit/`. Registered in `src/v3/compositions-data.tsx`. The v3 folders
`beat06/`, `beat07/`, `beat08/` stay on disk as sources; they're no longer registered.

## Beat 07 · The real weekend (16 s, black → white)
The January 2025 week on the shared WeekTimeline ("January 2025" lands big, then settles into the corner) → the
camera finds Fri 24 → Mon 27 → Friday's real minute line draws along the strip → the playhead crosses 65 empty weekend
hours → at Monday 09:30 the red connector drops and the white flip grows from the playhead (the open turns the
frame white) → push in on −12.47% → the weekend collapses so both sessions fill the plot → Monday draws → the same
line inverts into the loan's LTV (price down, LTV up) under the red 65% line → push to 59.57% and "No liquidations".
Honesty line: "Replay · Dukascopy CFD minute data · Fork of X Layer mainnet".

## Beat 08 · Under the hood (22 s, white)
1. Price check. The pool's 30-min TWAP line draws, the ±3% open-market band opens around it, and the keeper's 23
   posts from 09:31 to 10:33 ET drop in and land inside it. Push to the widest: 0.57% against a 3% limit.
2. Depth. The same line (USDG per wNVDAx) bends from time into sale size: the pool's price for 0.5 → 1,600 wNVDAx
   sold, the 2% slippage budget, the curve turning red past it. The keeper's largest in-budget size: 200 wNVDAx →
   44,772.98 USDG, and the credit cap is half: 22,386.49 USDG.
3. Losses. A red drop falls out of the past-budget curve; the camera tilts down to the gap reserve tank, which drains
   first (149.10 → 0.00); what it can't cover runs on to the lenders (−147.69 USDG, share 1.000008 → 0.997054).
   Honesty line switches from "X Layer mainnet" to "Synthetic scenario · Fork of X Layer mainnet".

## Beat 09 · The model (12 s, white)
Interest from borrowers flows along one trunk and splits: every fifth payment goes to the gap reserve (20%), four
in five go to lenders (80%), and the small tank tops back up. Then the whole diagram shrinks into one market tile
(NVDAx, X Layer mainnet), a dashed tile draws ("next stock: one deployment"), and it fills in as SPYx (fork of X
Layer mainnet), with another dashed tile beyond.

## Sources
| On screen | Value | Source |
|---|---|---|
| Replay line, −12.47%, 59.57%, 0 liquidations | as in v3 | `motion/data/nvda-minute-bars.json`, `recorded-run.json` |
| Keeper posts vs pool TWAP | 23 posts 09:31–10:33 ET, 25 Sep 2026; widest 57 bps | `PricePosted` events read from each keeper tx receipt (`motion/data/hood.json`, `fetch-hood.mjs`; tx hashes from `keeper.json`) |
| Band 3% open / 8% otherwise, TWAP 30 min | 300 / 800 bps, 1,800 s | `PriceRelayAdapter` `bandOpenBps`, `bandOtherBps`, `twapWindow` on mainnet |
| Depth curve | 0.5 → 1,600 wNVDAx, 224.34 → 216.23 USDG/share | QuoterV2 `0xd1b7…4343` at block 71,577,082, the block whose 200-share quote reproduces the keeper's posted proceeds exactly (`motion/data/depth-at-cap.json`, `fetch-depth-at-cap.mjs`) |
| Cap rule | largest keeper size within 2%, × 50% | `services/keeper/src/steps/depth.ts`, `context.ts` (sizes 0.5/2/10/50/200, 200 bps, 5,000 bps) |
| Cap shown | 200 wNVDAx → 44,669.61 USDG → 22,334.81 USDG | the keeper's posted cap, DepthCapRegistry.post tx 0xc694…ee55, 25 Sep 2026 14:21 UTC (keeper.json) |
| 80 / 20 | `RESERVE_FACTOR_BPS = 2000` | CollateralMarket on mainnet (read in `hood.json`) |
| NVDAx market | `0xE670…9D0D` | `deployments/xlayer-mainnet.json` |
| SPYx market (fork) | `0x16A2…9E4d` | `motion/data/session-public.json` |

v5.3 notes: beat 8's waterfall was cut with the script; the Chainlink card describes the onchain signature check (no tick: the adapter isn't live).
