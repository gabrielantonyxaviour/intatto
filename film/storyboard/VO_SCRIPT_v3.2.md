# Intatto demo video: voice-over script (v3 draft, conversational)

OKX Dev Day 2026 · close-guard 1.0.0 · 10 beats · about 400 words, about 2:40 of speech plus pauses.
**Draft for Gabriel's OK.** v2 (the cinematic version) is kept in `VO_SCRIPT_v2.md`, v1 in `VO_SCRIPT_v1.md`.

Direction (Gabriel, 25 Sep): concise, clear and conversational. You're explaining it to a smart friend: no
narrator voice, no ad lines, no dramatic scene-setting. Say it like you'd say it on a call.

## How to record
- One file per beat, `01-gap.mp3` … `10-close.mp3`, into `film/vo/gabriel/`. Or one long file with 3 seconds of
  silence between beats.
- Phone voice memo in a quiet room is fine. About 20 cm away, slightly to the side. 1 second of silence at each end.
  If you stumble, pause and redo the sentence.
- Normal speaking pace. Read it the way you talk. Changing a word so it sounds like you is fine; keep the numbers.

Pronunciation: Intatto = in-TAT-to · NVDAx = N-V-D-A-x · USDG = U-S-D-G · X Layer = ex layer · OKX = O-K-X.

---

## 1 · The gap · ~12 s
*White. One big sourced number: ~$91.5M of tokenized stocks on X Layer. Under it: "0 accepted by Aave on X Layer".*
> There's about ninety million dollars of tokenized stocks on X Layer, like NVIDIA.
>
> But you can't borrow against any of them. Aave on X Layer doesn't accept a single one.

## 2 · Why it's hard · ~16 s
*White: three exchange names in plain text with the source line. Then the NVDA / NVDAx pair; the dial runs into the weekend and the frame goes black; the issuer readout "max order: $0".*
> Bybit, Kraken and Bitget already let you borrow against these tokens. Onchain it's harder, because the token trades all weekend, and the real stock doesn't.
>
> On a Saturday, nobody actually knows what NVIDIA is worth. Even the issuer stops taking orders.

## 3 · Intatto · ~24 s
*The name "Intatto" lands first, then the session dial and the limit bar: white while the market's open, black once it closes. The 65% line never moves.*
> That's why we built Intatto. You can borrow dollars against tokenized stocks on X Layer, and the loan limits follow the market's hours.
>
> While the market's open, you can borrow up to half your collateral's value. Once it closes, that limit drops, and it keeps dropping through the weekend, toward twenty percent.
>
> The liquidation line stays at sixty-five percent the whole time. We lend less on weekends, but we never move the goalposts on existing loans.

## 4 · It's live · ~12 s
*White. The live Borrow screen floating in frame, then a zoom into the OKLink transaction and the verified contract.*
> And this is live on X Layer mainnet. This wallet put in real NVDAx and borrowed real USDG.
>
> Here's the transaction on OKLink, on a verified contract.

## 5 · Make it Saturday · ~25 s
*The dial spins to Saturday and the frame flips to black. SANDBOX label. The refusal lands as "SessionLimit"; the repay goes through.*
> Of course, you can't wait for a weekend in a demo. So we built a sandbox: a fork of X Layer mainnet, same contracts, same state, where we can move the clock.
>
> Let's jump to Saturday.
>
> Now I try to borrow more, and the contract says no before I even sign. But repaying still works. You can always reduce your risk.

## 6 · The real weekend · ~15 s
*Black. REPLAY · CFD data. The real NVDA minute chart draws itself across the weekend gap (−12.47% at Monday's open); the LTV meter climbs and stops near 60, under the 65 line.*
> Now let's replay a real weekend: January 2025, the DeepSeek weekend, when NVIDIA opened twelve and a half percent down on Monday.
>
> A loan opened at the weekday limit climbs to about sixty percent loan-to-value. That's under the line, so nobody gets liquidated.

## 7 · The worst case · ~18 s
*Black. SYNTHETIC label. The loan sold into the pool, the reserve draining to zero, the lender loss shown.*
> What if it's worse? Here's a made-up forty-five percent crash.
>
> The loan gets sold into the pool, never below a floor price. Our reserve covers the shortfall first, and anything beyond that is a loss for lenders.
>
> We tell lenders that up front, before they deposit.

## 8 · Don't trust us · ~9 s
*Two columns, mainnet and the fork, slide together; the real hashes match; four checks.*
> And you don't have to trust our sandbox. Your browser checks it against mainnet: same block, same code, same state.

## 9 · Agents and the keeper · ~12 s
*White again. An agent's question and the credit API's answer; the keeper's heartbeat with its onchain posts.*
> We also built it for OKX AI, so any agent can ask how much a wallet can borrow right now.
>
> And our keeper checks the market every minute and posts it onchain.

## 10 · Close · ~8 s
*White. The name, "Live on X Layer mainnet", and the URL. Hold.*
> So now you can borrow against tokenized stocks on X Layer, even on a weekend.
>
> Intatto is live now, at intatto dot larinova dot com.

---

### What changed from v2
- It opens straight on the problem, the missing credit market on X Layer (Gabriel, 25 Sep: "start directly with the problem" / "establish a need for a credit market in X Layer"). The weekend is why it's hard. Intatto is named in beat 3. There's no self-introduction and no Monday scare.
- DeepSeek now appears only in the replay (beat 6), as evidence the limits work.
- The Venus and Ventuals examples are cut. DeepSeek is the one real example, and we replay it later.
- The ad lines are gone ("This isn't a mockup", "Your loan, intact", "Italian for intact"). The close states the gap and the URL.
- Plain words and contractions, in the first person.

### Sources behind the lines
| Line | Source |
|---|---|
| Issuer stops taking orders | xStocks public asset API, closed-period `maxOrderFiatValue = 0`, read 25 Sep 2026 |
| DeepSeek weekend, 12.5% down at the open | Dukascopy NVDA minute data, 24/27 Jan 2025 (`data/replays`); sandbox ledger "Monday open gap 12.47%" |
| Half, then toward 20%; 65% fixed | SessionRiskController: OPEN 50%, EXTENDED 40%, CLOSED 30% → 20% over 64 h; threshold 65% |
| Real NVDAx in, real USDG out; verified contract | demo wallet 0x7F23…a415; OKLink borrow tx 0xa933…0f45 on CollateralMarket 0xE670…9D0D, source verified |
| Refused before signing; repay works | sandbox: "Refused: SessionLimit" from the contract's own simulation; repay confirmed on Saturday |
| About 60%, nobody liquidated | sandbox Risk: loan at 59.57% LTV, 0 liquidation slices |
| Sold into the pool, floor; reserve first; lender loss | sandbox synthetic run: 1 slice above the floor, reserve 149.10 → 0, lender deficit 147.69 USDG |
| Browser checks block, code, state | /sandbox/proof; live fork check 25 Sep 14:41 UTC, 7/7 values equal |
| Any agent can ask | public `/api/credit` (free); OKX AI listing under review |
| Keeper every minute, posts onchain | keeper cron Worker (reads each minute); OKLink `post` / `postSession` transactions |
| Bybit, Kraken, Bitget let users borrow against xStocks | spotedcrypto.com, Bybit xStocks collateral loans (Bitget Jun 2026, Kraken Jul 2026, Bybit 31 Jul 2026) |
| ~$90M tokenized stocks on X Layer | Crypto Briefing, 12 Sep 2026 (~$91.5M) |
| Aave on X Layer accepts none | onchain `getReservesList`, 25 Sep 2026 |
