# Intatto demo video: voice-over recording script

OKX Dev Day 2026 · close-guard 1.0.0 · 9 beats · about 3:25 of speech (458 words)

Every line is written against footage already recorded from the live app and the hosted sandbox, and every number
matches what is on screen. Please read the lines as written: a changed number or claim has to match the picture
and the honesty rules (no "first", no solvency claims, sandbox and replays labelled). Small wording changes that
keep the facts are fine. The edit fits the picture to your timing, so the target seconds are a guide, not a limit.

## How to record

- **One file per beat**, named `01-hook.mp3` … `09-close.mp3`. A phone voice memo in a quiet room is enough.
  Keep the phone about 20 cm away and slightly to one side, so your breath doesn't hit it.
- Leave **1 second of silence** at the start and end of each file.
- If you stumble, pause, then **re-read the whole sentence**. I'll cut to the clean take, so there's no need to restart the beat.
- Overall tone: **calm, confident, honest.** Conversational, a little slower than normal speech, with short sentences.
  Don't hype. Let the numbers land.
- If one long take is easier, record all 9 beats in one file with **3 seconds of silence between beats**. I'll split it.
- Send the files to the planning session (or drop them in `film/vo/gabriel/`).

### Pronunciation

| Word | Say |
|---|---|
| Intatto | in-TAT-to |
| NVDAx | "N-V-D-A-x" (letters) |
| USDG | "U-S-D-G" (letters) |
| xStocks | "ex-stocks" |
| X Layer | "ex layer" |
| OKX | "O-K-X" |
| SessionLimit | "session limit" (it's the contract's error name) |
| Ventuals | VEN-choo-uls |
| onchain | "on-chain" |

---

## Beat 1 · Hook · target 18 s

**On screen:** NVIDIA's trading week next to NVDAx trading 24/7, then three fact cards with their sources.

> Tokenized NVIDIA trades around the clock. NVIDIA doesn't.
>
> While the market is closed, the issuer quotes a maximum order of zero dollars.
>
> Venus listed stock collateral with borrowing switched off.
>
> And a mishandled split on Ventuals liquidated four hundred and five users.

**Delivery:** Un https://bellwether.larinova.comafter "NVIDIA doesn't." Each fact is its own card, so leave a short beat between them.

## Beat 2 · What Intatto is · target 21 s

**On screen:** the name card, then the live Market page: session, max LTV for new loans, the fixed 65% line, the price-relay disclosure.

> Intatto lets you borrow against tokenized stocks on X Layer, with limits that know when the stock market is closed.
>
> How much you can borrow follows the US session. The liquidation line never moves.
>
> The price is our keeper relaying the issuer's quote, bounded onchain, and the app says so.

**Delivery:** The first sentence is the one line to remember, so say it clearly and a touch slower. The last sentence is a plain disclosure, not an apology.

## Beat 3 · Live on mainnet · target 21 s

**On screen:** the demo wallet's real position on Borrow, then the real borrow transaction on OKLink and the verified contract.

> And it's live, on X Layer mainnet.
>
> This wallet deposited real NVDAx and borrowed real USDG.
>
> Thirty-six percent loan-to-value, health one point seven nine.
>
> NVIDIA would have to fall about forty-four percent before this loan is liquidated.
>
> Here's the borrow on the explorer, on a verified contract.

**Delivery:** Quiet pride. Stress "live" and "real". Read the numbers evenly.

## Beat 4 · The sandbox: make it Saturday · target 33 s

**On screen:** SANDBOX label. Start a session, borrow, Jump to Saturday, the borrow refused with "SessionLimit", then a repay that goes through.

> To show you the weekend, here's a sandbox: a fork of X Layer mainnet, the same contracts, and a burner wallet funded from a real holder.
>
> I borrow on a weekday.
>
> Now, let's make it Saturday.
>
> The session closes, and the limit for new loans drops below thirty percent, falling toward twenty by Monday.
>
> I ask for more, and the contract refuses, with its reason: SessionLimit.
>
> Repaying still works. Reducing risk is never blocked.

**Delivery:** The longest beat, so keep it moving. Lift slightly on "let's make it Saturday". Pause for half a second before "SessionLimit".

## Beat 5 · Fork proof · target 12 s

**On screen:** SANDBOX label. The fork-proof checks turn green in the browser, then the ledger of changes.
*(This shot is recorded after cg-build ships the proof-page fix.)*

> And you don't have to trust the fork.
>
> These checks run in your own browser: same block, same contracts, same state, and a ledger of everything we changed.

**Delivery:** Matter-of-fact. Read the list evenly.

## Beat 6 · Replay: the DeepSeek weekend · target 22 s

**On screen:** REPLAY · CFD data label. The January 2025 replay runs; the Risk console shows the loan near 60% LTV and no liquidation.

> Now a real weekend. January 2025, the DeepSeek weekend.
>
> NVIDIA closed on Friday and opened Monday twelve and a half percent lower.
>
> Replayed on the fork from minute data, a loan opened at the weekday limit ends near sixty percent.
>
> Under the line. Nobody is liquidated. The limits held.

**Delivery:** Let the last three short sentences land one at a time. It's the payoff, so keep it calm.

## Beat 7 · Synthetic 45% gap · target 25 s

**On screen:** SYNTHETIC label. A liquidation slice, the reserve drained to zero, a 147.69 USDG lender deficit on Lend, then the "Lenders can lose money" notice.

> To show a real crash, here's a synthetic forty-five percent gap.
>
> The loan is sold into the pool in bounded slices, never below a price floor.
>
> The gap reserve pays first, all of it.
>
> What it can't cover, about a hundred and forty-eight dollars, is recognised openly as a loss to lenders.
>
> They're told that before they deposit.

**Delivery:** Honest and steady. This is the "we say the risk before a judge does" moment. Don't soften it.

## Beat 8 · OKX AI: agents and the keeper · target 22 s

**On screen:** the Agents page calling the credit API for the demo wallet, then the keeper's transactions on OKLink.

> Agents can ask too. Intatto's credit API is built for OKX AI.
>
> It answers how much a wallet can borrow right now, and why, from onchain reads.
>
> And our keeper agent reads the issuer every minute, and posts the session and price onchain.
>
> Every post is a transaction you can check.

**Delivery:** Brisk and practical.

*(Note: say "built for OKX AI", not "listed on". As of the 25 Sep deploy, the Agents page shows "OKX AI listing: under review (agent #13907)". If the review passes before you record, this line can become "Intatto's credit API is listed on OKX AI.")*

## Beat 9 · Close · target 26 s

**On screen:** why X Layer (with sources), what's next, then the name and intatto.larinova.com.

> Everything Intatto needs lives on X Layer: the xStocks, their pools, USDG, and OKX AI.
>
> X Layer holds about ninety-one million dollars of xStocks, and its Aave market lists none of them.
>
> Next: Chainlink Data Streams, and more stocks.
>
> Intatto.
>
> Borrow against tokenized stocks on X Layer, with limits that know when the market is closed.
>
> And it's live.

**Delivery:** Slow down for the last three lines. Pause after "Intatto." Say "And it's live." simply, with a smile.

---

### Sources behind the lines

| Line | Source |
|---|---|
| Issuer max order $0 while closed | xStocks public asset API, closed-period `maxOrderFiatValue = 0`, read 25 Sep 2026 |
| Venus, borrowing off | CryptoSlate: Venus listed stock collateral with borrow caps at 0 |
| Ventuals, 405 liquidated | Unchained: SpaceX pre-IPO perp, mishandled 5-for-1 split |
| 36% LTV, health 1.79, 44% to liquidation | live mainnet position of demo wallet 0x7F23…a415 (Borrow page, credit API) |
| Borrow tx, verified contract | OKLink: 0xa933d8de…0f45 on CollateralMarket 0xE670…9D0D, source verified |
| Below 30%, toward 20% by Monday | sandbox Borrow page after Jump to Saturday: CLOSED, 28.12%, falls to 20% by Monday |
| DeepSeek replay, 12.5% gap, ends near 60%, no liquidation | sandbox ledger: "Monday open gap 12.47% … 0 bounded liquidation slices"; Risk: loan at 59.57% |
| Synthetic: reserve paid all, ~148 lender deficit | sandbox Risk: reserve 0.00, deficit 147.69 USDG; Lend: written off 147.695867 USDG |
| Keeper reads every minute, posts onchain | keeper cron Worker; OKLink shows its `post` / `postSession` transactions |
| ~$91.5M xStocks on X Layer | Crypto Briefing, 12 Sep 2026 |
| Aave on X Layer lists no xStocks | onchain read of `getReservesList`, 25 Sep 2026 |
