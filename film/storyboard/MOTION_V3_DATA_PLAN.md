# Motion v3 · data beats (06, 07, 08): shot plan

cg-motion-data (Claude Opus 5.5, high). Built in `film/remotion/src/v3/beat06|beat07|beat08`, with beat-local
helpers in `src/v3/datakit/`. Shared theme, dial and ui primitives come from cg-motion-lead and are not edited here.

## Numbers and where they come from
| On screen | Value | Source file |
|---|---|---|
| Friday close | 142.60 (142.596, bar 15:59 ET) | `nvda-minute-bars.json` anchors.fridayClose |
| Monday open | 124.82 (124.817, bar open 09:30 ET) | anchors.mondayOpen |
| Gap at the open | −12.47% (−12.468) | `gapPercent` |
| Loan at the weekday limit | 49.5% | `checks/fork/lib/scenarios.ts` openPosition: min(5000, maxLtv − 50) bps |
| LTV along the replay | 49.5 × 142.596 / price | same loan, real bars. At Monday's close 118.496 → **59.57%**, which matches `recorded-run.json` replay.terminalLtvPercent |
| Liquidations | 0 | recorded-run.json replay.liquidations |
| Synthetic crash | −45%, 1 slice, 19.966 wNVDAx → 2,037.58 USDG, floor held | recorded-run.json synthetic |
| Reserve | 149.10 → 0.00 USDG | recorded-run.json synthetic |
| Lender loss | 147.69 USDG; share 1.000008 → 0.997054 (−0.2954%) | recorded-run.json synthetic |
| Proof rows | block 71,563,431 hash · NVDAx bytecode keccak · CollateralMarket bytecode keccak · USDG totalSupply | `proof.json` rows (equal: true) |
| Snapshot | 25 Sep 2026 14:41 UTC | proof.json retrievedAt 14:41:14Z |

Intraday Monday LTV peaks at 60.49% (the 116.696 low) before settling at 59.57% at the close. It's computed from
the real bars on the same loan and stays under 65%. The sandbox itself stepped only to the open and to the close,
so the settled number is the one that carries a source line.

## Beat 06 · The real weekend · 15 s · black
REPLAY · CFD data and SANDBOX chips for the whole beat.
1. **0–1.2 s** Eyebrow `NVDA · 24–27 JAN 2025` and the title "The DeepSeek weekend" rise in (stagger 5 f). Price
   gridlines draw left to right, staggered 3 f; price ticks rise in.
2. **1.0–4.2 s** The Friday afternoon line draws itself with a bright playhead dot and a vertical playhead hairline
   whose time label (`FRI 14:32 ET`) and price tick with the bar under it. Ends on the close dot, `142.60 · Fri close`.
3. **4.2–5.2 s** The weekend band fades up (hatched, slowly drifting); the red dashed connector falls to Monday's open.
   `−12.47%` counts up in red at the gap, source line under it. Held to the end of the beat.
4. **5.2–7.2 s** Hold on the gap; the camera pushes gently toward it.
5. **7.2–8.4 s** The LTV meter rises in below the chart: 0–80% scale, a tick at 49.5 "opened at the weekday limit",
   the fixed red line at 65% "Liquidation 65% · never moves". The fill steps 49.5 → 56.55 with a pulse on the gap.
6. **8.4–12 s** Monday draws; the meter fill and the big number track the playhead's bar (cause → effect).
7. **12–15 s** Settles at **59.57%** (source line), `0 liquidations` with a green tick. Camera eases back.
Ambient: a 1.0 → 1.035 push through the beat (in-out cubic); chips and title parallax at 40% of the chart's motion.

## Beat 07 · The worst case · 18 s · black
SYNTHETIC · not market data chip (red outline) for the whole beat. One wide world with four stations on a hairline
rail; the camera travels left to right, so the loss is seen flowing (no cuts).
1. **0–3.8 s · Crash.** A price column: its outline stays at 100%; the ink fill drops to 55%, the missing 45% is a red
   outlined void. `−45%` counts in red. "A made-up crash".
2. **3.8–7.6 s · Pool.** Camera trucks right. One slice block `19.966 wNVDAx` leaves the loan, travels the rail into
   the pool; `2,037.58 USDG` comes back out. A floor gauge: the sale mark lands above the floor tick, `Floor held` ✓.
3. **7.6–11.4 s · Reserve.** A tank with 149.10 USDG; its surface has a small ambient ripple. It drains to 0.00 while
   the number counts down in lock step; a red shortfall token travels on along the rail.
4. **11.4–14.6 s · Lenders.** `Lender loss 147.69 USDG` lands in red; the share value rolls 1.000008 → 0.997054,
   `−0.2954%`.
5. **14.6–18 s · Up front.** Camera pulls back; a floating frame with the real Lend page primer ("Lenders can lose
   money.") rises in and pushes in on that line. Swappable take/mark/offset.

## Beat 08 · Don't trust us · 9 s · black → white
1. **0–1.4 s** Two columns, "X Layer mainnet" (LIVE chip) and "Sandbox fork" (SANDBOX chip), slide in from the frame
   edges toward a centre gutter.
2. **1.4–3.6 s** Four rows read in left to right in both columns at once (mono, middle-truncated hashes), staggered
   6 f per row.
3. **3.6–6.2 s** "same block, same code, same state": a thin compare sweep crosses each row pair; the gutter tick
   turns green and the row's hairline locks. Block → NVDAx code → CollateralMarket code → USDG totalSupply.
4. **6.0–7.0 s** The white ThemeFlip grows from the gutter's last tick.
5. **7.0–9 s** On white: the four locked rows and `Snapshot · 25 Sep 2026 14:41 UTC`.

## Captions
`scratchCaptions` burns the VO lines, timed per phrase in `src/v3/datakit/vo.ts`, through the lead's Caption.
