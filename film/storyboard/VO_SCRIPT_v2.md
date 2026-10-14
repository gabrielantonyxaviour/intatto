# Intatto demo video: voice-over script (v2, story-first)

OKX Dev Day 2026 · close-guard 1.0.0 · 10 beats · about 400 words, about 3:15 of speech.
v1 (fact-led, 9 beats) is kept in VO_SCRIPT_v1.md.

## How to record

- **One file per beat**, `01-cold-open.mp3` … `10-close.mp3`, into `film/vo/gabriel/`. A single long file with **3 seconds of silence between beats** also works.
- A phone voice memo in a quiet room is enough. Hold it about 20 cm away, slightly to the side.
- Leave 1 second of silence at the start and end. If you stumble, pause and re-read the whole sentence.
- Tone: calm, confident, a little slower than normal speech. Beats 1–2 carry quiet tension; from beat 3 on, it's warm and sure. Let the short lines land.

Pronunciation: Intatto = in-TAT-to · NVDAx = N-V-D-A-x · USDG = U-S-D-G · X Layer = ex layer · OKX = O-K-X.

---

## 1 · Cold open · ~10 s
*Friday-night New York; the last print; the NVIDIA ticker freezes; the onchain token keeps ticking.*
> Friday night in New York. The last trade prints, and NVIDIA stops trading until Monday.
>
> Its token doesn't.

Pause after "until Monday." Say "Its token doesn't." quietly.

## 2 · The problem · ~28 s
*Weekend darkness, a headline flicker, the Monday gap cracks the chart; 405 dots burst.*
> That's a problem if you lend against it.
>
> All weekend, nobody can trade the real stock. The issuer won't even take an order.
>
> Then Monday opens wherever the news took it.
>
> In January 2025, after the DeepSeek weekend, NVIDIA opened twelve and a half percent lower.
>
> And when one platform got a stock split wrong, four hundred and five people were liquidated.
>
> So who pays for the weekend?

## 3 · The idea · ~22 s
*The session dial appears; the limit bar tightens as the dial turns into night; the 65% line stays fixed.*
> This is Intatto. Italian for *intact*.
>
> The stock market keeps hours. So do our loans.
>
> While it's open, you can borrow up to half your collateral. As it closes, that limit tightens, toward twenty percent by Monday.
>
> The liquidation line never moves.

Slow down on "This is Intatto." This is the line to remember.

## 4 · It's real · ~15 s
*The live app floating in frame; zoom into the OKLink transaction and the verified contract.*
> This isn't a mockup. It's live on X Layer mainnet.
>
> This wallet deposited real NVDAx, and borrowed real USDG.
>
> Here's the transaction, on a verified contract.

## 5 · Make it Saturday · ~30 s
*The dial spins forward; the sandbox jumps in time; SESSIONLIMIT lands like a stamp; the repay goes through.*
> But you can't wait for a weekend in a three-minute demo. So we built one.
>
> A fork of X Layer mainnet, with the same contracts and the same state, where we can move time.
>
> Let's make it Saturday.
>
> I try to borrow more. The contract says no, before I even sign.
>
> But repaying is always open. Reducing risk is never blocked.

Lift on "Let's make it Saturday."

## 6 · Replay the real weekend · ~20 s
*The real NVDA minute chart draws itself; the loan's LTV climbs toward 65 and stops near 60.*
> Now, the real thing. The DeepSeek weekend, minute by minute.
>
> A loan opened at the weekday limit rides the gap down, and stops near sixty percent.
>
> Under the line. Nobody liquidated.
>
> The limits held.

Let the last three lines land one at a time.

## 7 · The worst case, honestly · ~22 s
*SYNTHETIC label; slices peel off; the reserve drains like a tank; the lender loss appears.*
> And if it's worse? Here's a made-up forty-five percent crash.
>
> The loan is sold in bounded slices, never below a floor.
>
> Our reserve pays first. What's left is shown as a loss to lenders, in plain words.
>
> They're told that before they ever deposit.

## 8 · Don't trust us · ~10 s
*Two hash columns slide together and lock; four green checks.*
> You don't have to trust our fork.
>
> Your own browser checks it against mainnet: same block, same code, same state.

## 9 · Agents and keeper · ~13 s
*The keeper's heartbeat pulse each minute; an agent's question and the answer.*
> Agents can use it too. Intatto is built for OKX AI: any agent can ask how much a wallet can borrow right now.
>
> And our keeper checks the market every minute, and posts it onchain.

## 10 · Close · ~15 s
*The dial comes to rest; the name; the URL.*
> X Layer holds about ninety million dollars of tokenized stocks. Aave on X Layer lists none of them.
>
> Intatto. Your loan, intact.
>
> Live on X Layer.

Pause after "Intatto." Say "Live on X Layer." simply, with a smile.

---

### Sources behind the lines

| Line | Source |
|---|---|
| Issuer won't take an order while closed | xStocks public asset API, closed-period `maxOrderFiatValue = 0`, read 25 Sep 2026 |
| DeepSeek weekend, opened 12.5% lower | Dukascopy NVDA minute data, 24/27 Jan 2025 (data/replays); sandbox ledger "Monday open gap 12.47%" |
| 405 liquidated on a mishandled split | Unchained: Ventuals SpaceX pre-IPO perp, mishandled 5-for-1 split |
| Half, then toward 20% by Monday; 65% fixed | SessionRiskController: OPEN 50%, CLOSED 30%→20% over 64 h, threshold 65% |
| Real NVDAx, real USDG, verified contract | demo wallet 0x7F23…a415; OKLink borrow tx on CollateralMarket 0xE670…9D0D, verified |
| Stops near 60%, nobody liquidated | sandbox Risk: loan at 59.57%, 0 liquidation slices |
| Reserve pays first, remainder a lender loss | sandbox: reserve 0.00, deficit 147.69 USDG, share value reduced |
| Browser checks: block, code, state | /sandbox/proof, 4 checks |
| Keeper every minute | keeper cron Worker; OKLink `post` / `postSession` transactions |
| ~$90M xStocks on X Layer | Crypto Briefing, 12 Sep 2026 (~$91.5M) |
| Aave on X Layer lists none | onchain `getReservesList`, 25 Sep 2026 |
