# Intatto demo video: voice-over script (v5.2, Gabriel's corrections applied: awaiting his final confirmation)

OKX Dev Day 2026 · close-guard 1.0.0 · 11 beats · about 540 words, about 3:30 of speech plus pauses.
**Awaiting Gabriel's final confirmation.** Earlier drafts: `VO_SCRIPT_v5.1.md`, `VO_SCRIPT_v5.md`, `VO_SCRIPT_v4.md`,
`VO_SCRIPT_v3.2.md`, `VO_SCRIPT_v3.1.md`, `VO_SCRIPT_v2.md`, `VO_SCRIPT_v1.md`.

Direction (Gabriel, 25 Sep): it must sound like Gabriel explaining something to a person, not presenting data or reading a document. Use full spoken sentences with natural connectors (so, let's say, now, you'll see). No clipped dramatic fragments, no "What makes it different:" set-ups. Concise, clear, and articulate the way people who trade stocks
actually talk. Explain the product before its numbers. The demo is shown on a fork of X Layer mainnet, and we say so
plainly. Few edge cases: only what shows the engineering. OKX AI gets its own energy.

## How to record
- One file per beat, `01-hook.mp3` … `11-close.mp3`, into `film/vo/gabriel/`. Or one long file with 3 seconds of
  silence between beats.
- Phone voice memo in a quiet room is fine. About 20 cm away, slightly to the side. 1 second of silence at each end.
- Normal speaking pace. Read it the way you talk. Changing a word so it sounds like you is fine; keep the numbers.

Pronunciation: Intatto = in-TAT-to · NVDAx = N-V-D-A-x · USDG = U-S-D-G · X Layer = ex layer · OKX = O-K-X · A2MCP = A-two-M-C-P.

---

## Act 1 · The problem

## 1 · Hook · ~14 s
*Shot A, white: NVDA's session line (lit only in market hours) against NVDAx's line (lit 24/7), built from the dial. Shot B: ~$91.5M of tokenized stocks on X Layer (source), with nowhere to borrow.*
> Tokenized stocks trade twenty-four seven, but the stocks underneath them don't.
>
> There's about ninety million dollars of them on X Layer, and right now you can't borrow against any of it.

## 2 · Why it's hard · ~25 s
*White → black at Fri 20:00 ET: "price discovery stops", the token's thin line keeps moving, "max order: $0", "gap risk".*
> Bybit, Kraken and Bitget already lend against these tokens, but doing it onchain is harder, because the weekend breaks pricing.
>
> Price discovery stops Friday at 8 p.m. Eastern. The token keeps trading on thin liquidity, and even the issuer stops quoting until the open. Lend into that, and you're carrying gap risk with no real price.

## Act 2 · The product

## 3 · Intatto · ~30 s
*"Intatto" lands. Then one simple picture of the product: tokenized stock in, USDG out, and the session dial running under it (white while open, black once closed). No percentages yet.*
> So we built Intatto, a lending market that lives natively on X Layer. You just put in your tokenized stocks and borrow USDG against them, any day of the week.
>
> The key thing is that Intatto knows when the actual stock market is open. Your borrowing limit tracks the market session: it's higher while the stock is actually trading, and it tightens once the market closes.
>
> And the liquidation threshold never moves, so a market close never pushes an existing loan toward liquidation.

## 4 · Live, and forked for this demo · ~18 s
*The X Layer logo in the centre. On one side, mainnet: Intatto's real contract addresses and the live loan. On the other, the sandbox fork of mainnet at block 71,563,431. The camera zooms from the logo into each side.*
> Intatto is live on X Layer mainnet right now. For this demo, we forked mainnet, so we can show you how it behaves at different points in the market week. Everything you see in the demo, you can try yourself on the fork.

## Act 3 · The demo (a week timeline: zoom out, time moves, zoom in; white = open, black = closed; no UI toggles on screen)

## 5 · Friday · ~18 s
*The week timeline; the camera dives into Friday afternoon (white). The Borrow screen: NVDAx in, USDG out, within the open-session limit.*
> Let's say it's a Friday afternoon right now, and the market's open. I'm going to deposit some NVDAx and borrow USDG against it. Since the market's open, the protocol lets me borrow up to fifty percent of what my NVDAx is worth.

## 6 · Saturday · ~24 s
*Zoom out; the clock runs past Friday 8 p.m. and the frame goes black; dive into Saturday. The limit has stepped down; the borrow is refused before signing; the repay goes through.*
> Now let's jump ahead to Saturday. With the stock market closed, the protocol has lowered my borrowing limit. So when I try to borrow a little more, the contract rejects the transaction before I even sign it. Repaying still goes through, though, because reducing your risk is never blocked.

## 7 · The real weekend · ~24 s
*Zoom out to January 2025; dive into Monday's open (black → white). The real minute chart, the gap, and the loan's LTV topping out under 65.*
> Now here's a real example. In January 2025, after DeepSeek's new AI model took off over a weekend, NVIDIA opened twelve and a half percent down that Monday. Replayed on our fork, a loan taken at the weekday limit goes up to about sixty percent LTV, which is still under the sixty-five percent liquidation threshold, so nobody gets liquidated.

## Act 4 · Under the hood

## 8 · How it handles risk · ~29 s
*Fast, clean cuts, one idea each: the keeper relay against the pool's 30-minute average; a stock split pausing the market; the pool-depth cap; then the waterfall (bounded slice → gap reserve → lenders). Real market visuals where possible.*
> Under the hood, we've been really careful about risk. The price comes onchain through our keeper, and the contracts check it against the pool before accepting it. For production, we've already built an adapter for Chainlink Data Streams, so that price becomes fully verifiable.
>
> We only lend what X Layer's pools could absorb in a sale. And if a gap ever gets past all of that, our gap reserve takes the loss first, and lenders can see exactly what's left before they deposit.

## 9 · The model · ~20 s
*Interest splitting 80/20 into lenders and the reserve. Then the markets as isolated tiles: NVDAx live, SPYx running on the fork.*
> The model is pretty simple: borrowers pay interest, eighty percent of it goes to lenders, and twenty percent goes into the gap reserve. Every stock is its own isolated market, so adding the next stock is just a deployment away. We already run NVDAx and SPYx on our fork, and NVDAx on mainnet.

## Act 5 · OKX AI (a new energy: still clean)

## 10 · Agents · ~27 s
*A chat like iMessage. Someone asks their agent how much a wallet can borrow. The agent calls Intatto's A2MCP service (a tool-call chip), and the answer comes back as a clean card: session, borrowable now, LTV, liquidation price.*
> We've also registered Intatto on the OKX AI marketplace. It provides an A2MCP service called Borrow capacity and health, so anyone can have their agent call it and ask how much a wallet can borrow right now. It reads straight from the chain, works out the numbers, and responds with the session, the limit, the LTV and the liquidation price.

## 11 · Close · ~13 s
*Back to black and white. The week timeline one last time, then the name and the URL. Hold.*
> That's Intatto. You can borrow against your tokenized stocks on X Layer twenty-four seven, and it's live right now at intatto dot larinova dot com.

---

### What changed from v4
- v5.2: Gabriel's line-by-line corrections (conjunction in the hook, 'but doing it onchain is harder', 'lives natively', the limit tracks the session, the liquidation threshold never moves, 'the protocol lets me', a cleaner DeepSeek line, the Chainlink Data Streams upgrade, NVDAx on mainnet, the OKX AI marketplace without the agent number or review status in the VO: those go on screen).
- v5.1: every line rewritten as spoken explanation (Gabriel: 'explaining something to someone, not presenting data'). The Aave sentence is cut from beat 1.
- Beat 3 explains the product (what it does, how it solves the problem) before any numbers (Gabriel).
- The "live on mainnet / forked for this demo" statement comes once, before the demo (Gabriel), and replaces the old "don't trust our fork" beat.
- The demo travels a week (Friday → Saturday → the real weekend) instead of showing sandbox controls (Gabriel).
- New "under the hood" and "model" beats: risk engineering, economics, scale. Few edge cases.
- OKX AI is its own act: agent 13907, the A2MCP service, and a chat-style call.

### Sources behind the lines
| Line | Source |
|---|---|
| ~$90M tokenized stocks on X Layer | Crypto Briefing, 12 Sep 2026 (~$91.5M) |
| Aave on X Layer lists none | onchain `getReservesList`, 25 Sep 2026 |
| Bybit, Kraken, Bitget lend against xStocks | spotedcrypto.com (Bitget Jun 2026, Kraken Jul 2026, Bybit 31 Jul 2026) |
| Price discovery stops Fri 8 p.m. ET | US equities: after-hours ends 20:00 ET Friday |
| Issuer stops quoting until the open | xStocks public asset API, closed-period `maxOrderFiatValue = 0`, read 25 Sep 2026 |
| Lends more open, less closed; rules on open loans unchanged | SessionRiskController: OPEN 50%, EXTENDED 40%, CLOSED 30% → 20%; liquidation threshold fixed at 65% |
| Live on mainnet; fork for the demo | deployments/xlayer-mainnet.json (verified on OKLink); sandbox fork at block 71,563,431 (chain 1960196) |
| Refused before signing; repay works | sandbox: "Refused: SessionLimit" from the contract's own simulation; repay confirmed on Saturday |
| DeepSeek replay, 12.5% gap, ~60% LTV, no liquidations | Dukascopy NVDA minute data 24/27 Jan 2025; sandbox ledger "Monday open gap 12.47%"; Risk: 59.57% LTV, 0 slices |
| Keeper relay checked against the pool's 30-min average | PriceRelayAdapter: TWAP band 3% open / 8% otherwise |
| Splits and dividends pause a stock | CorporateActionGuard |
| Credit capped by pool depth | DepthCapRegistry (keeper samples QuoterV2 sell depth) |
| Bounded slices, reserve first, lenders see it before depositing | BoundedLiquidator; GapReserve; Lend primer "Lenders can lose money" |
| 80% to lenders, 20% to the reserve | Lend primer: "Lenders receive 80% of the interest borrowers pay. The other 20% funds the gap reserve" |
| Isolated markets; SPYx on the fork | per-market contracts (deployments `markets[]`); SPYx is a sandbox-only second market |
| Chainlink Data Streams adapter built for production | ChainlinkV10Adapter: built and unit-tested, not wired live (no Data Streams entitlement) |
| OKX AI marketplace, A2MCP "Borrow capacity and health" (on screen: agent 13907, listing under review) | okx-ai/credit-service.json and README (submitted 25 Sep 2026; registration tx 0xe1d27703…c2b3c7) |
