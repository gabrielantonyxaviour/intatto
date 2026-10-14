# Intatto demo video: voice-over script (v4 draft, market-literate)

OKX Dev Day 2026 · close-guard 1.0.0 · 10 beats · about 390 words, about 2:30 of speech plus pauses.
**Draft for Gabriel's OK.** Earlier drafts: `VO_SCRIPT_v3.2.md`, `VO_SCRIPT_v3.1.md`, `VO_SCRIPT_v2.md`, `VO_SCRIPT_v1.md`.

Direction (Gabriel, 25 Sep): concise, clear and conversational, and articulate the way people who trade stocks actually talk (price discovery, gap risk, LTV). Nothing vague or AI-sounding. You're explaining it to a smart friend: no
narrator voice, no ad lines, no dramatic scene-setting. Say it like you'd say it on a call.

## How to record
- One file per beat, `01-hook.mp3` … `10-close.mp3`, into `film/vo/gabriel/`. Or one long file with 3 seconds of
  silence between beats.
- Phone voice memo in a quiet room is fine. About 20 cm away, slightly to the side. 1 second of silence at each end.
  If you stumble, pause and redo the sentence.
- Normal speaking pace. Read it the way you talk. Changing a word so it sounds like you is fine; keep the numbers.

Pronunciation: Intatto = in-TAT-to · NVDAx = N-V-D-A-x · USDG = U-S-D-G · X Layer = ex layer · OKX = O-K-X.

---

## 1 · Hook · ~14 s
*Shot A, white: NVDA's session line (lit only in market hours) against NVDAx's line (lit 24/7), built from the dial's arcs. Shot B: ~$91.5M of tokenized stocks on X Layer (source), then "0 listed on Aave (X Layer)" (source).*
> Tokenized stocks trade twenty-four seven. The stocks underneath them don't.
>
> There's about ninety million dollars of them on X Layer, and right now you can't borrow against any of it. Aave on X Layer doesn't list a single one.

## 2 · Why it's hard · ~16 s
*White: "Bybit · Kraken · Bitget" in plain type with the source. The dial runs to Fri 20:00 ET and the frame flips black: "price discovery stops". The token's line keeps moving, thinly. The issuer readout "max order: $0". The words "gap risk".*
> Bybit, Kraken and Bitget already lend against these tokens. Onchain it's harder, because the weekend breaks pricing.
>
> Price discovery stops Friday at 8 p.m. Eastern. The token keeps trading on thin liquidity, and even the issuer stops quoting until the open. Lend into that, and you're carrying gap risk with no real price.

## 3 · Intatto · ~22 s
*"Intatto" lands, then the session dial and the limit bar: white in market hours, black once it closes. The 65% line never moves.*
> So we built Intatto: a lending market on X Layer where the borrow limit follows the stock market's session.
>
> During regular hours you can borrow up to fifty percent LTV. After the close it steps down, and through the weekend it decays toward twenty.
>
> The liquidation threshold stays at sixty-five the whole time. We take less new risk while the market's shut, and we never move the goalposts on open loans.

## 4 · It's live · ~11 s
*White. The live Borrow screen floating in frame, then OKLink: the borrow transaction and the verified contract.*
> It's live on X Layer mainnet. This wallet posted real NVDAx and borrowed real USDG. Here's the transaction on OKLink, against a verified contract.

## 5 · Make it Saturday · ~24 s
*The dial spins to Saturday and the frame flips black. SANDBOX label. The SessionLimit stamp; the repay goes through.*
> You can't wait for a weekend in a demo, so we built a sandbox: a fork of X Layer mainnet, same contracts, same state, and a clock we control.
>
> Let's jump to Saturday.
>
> I try to borrow more, and the contract rejects it before I even sign. Repaying still goes through. Reducing risk is never blocked.

## 6 · The real weekend · ~15 s
*Black. REPLAY · CFD data. The real NVDA minute chart draws across the weekend gap (−12.47% at Monday's open); the LTV meter tops out near 60, under the 65 line.*
> Now a real weekend: the DeepSeek selloff in January 2025, when NVIDIA gapped down twelve and a half percent at Monday's open.
>
> A loan opened at the weekday limit tops out around sixty percent LTV. Under the threshold. No liquidations.

## 7 · The worst case · ~17 s
*Black. SYNTHETIC label. The position sold into the pool in a bounded slice, the reserve draining to zero, the lender loss shown.*
> And a real crash? Here's a synthetic forty-five percent gap.
>
> The position gets sold into the pool in bounded slices, never below a price floor. The reserve absorbs the shortfall first; anything past that is socialized to lenders, and they see that before they deposit.

## 8 · Don't trust us · ~8 s
*Two columns, mainnet and the fork, slide together; the real hashes match; four checks.*
> You don't have to trust our fork. Your browser verifies it against mainnet: same block hash, same bytecode, same state.

## 9 · Agents and the keeper · ~11 s
*White. An agent's query and the credit API's answer; the keeper's heartbeat with its onchain posts.*
> It's built for OKX AI too, so any agent can query a wallet's borrowing capacity in real time. And our keeper reads the market every minute and posts it onchain.

## 10 · Close · ~8 s
*White. The name, "Live on X Layer mainnet", and the URL. Hold.*
> Borrowing against tokenized stocks on X Layer, even on weekends.
>
> Intatto is live now, at intatto dot larinova dot com.

---

### What changed from v3.2
- A sharp opener: "Tokenized stocks trade twenty-four seven. The stocks underneath them don't." The $90M / Aave line is now the second shot (Gabriel: it "sounds like a second shot").
- "On a Saturday, nobody actually knows what NVIDIA is worth" is cut. The weekend is now explained the way traders say it: price discovery stops, thin liquidity, the issuer stops quoting, gap risk.
- Tighter, market-literate wording throughout (LTV, liquidation threshold, gapped down, socialized to lenders, bytecode), still plain and conversational.

### Sources behind the lines
| Line | Source |
|---|---|
| Price discovery stops Fri 8 p.m. ET | US equities: after-hours ends 20:00 ET Friday; no regular trading until the week reopens |
| Issuer stops quoting until the open | xStocks public asset API, closed-period `maxOrderFiatValue = 0`, read 25 Sep 2026 |
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
