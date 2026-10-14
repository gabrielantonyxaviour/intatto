# Intatto submission summaries

Draft for Gabriel's approval. Product: Intatto; Abel: close-guard 1.0.0. Primary track: Build a Market. Route: in person. The coordinator's authenticated page 1 capture confirms that Project Summary should briefly cover the product, intended user and core integration; no character limit was established.

## About 50 words

Intatto lets tokenized-stock holders borrow USDG against NVDAx on X Layer. Borrowing limits follow US market sessions, with a fixed liquidation threshold and disclosed lender losses. A trusted keeper relays issuer prices within onchain bounds. Judges can explore weekend borrowing, corporate actions and gap replays in a labelled mainnet-fork sandbox.

## About 200 words

Intatto is a lending market on X Layer for people who hold tokenized US stocks and want USDG without selling their exposure. USDG holders supply a shared vault and earn borrower interest. NVDAx is deployed on mainnet; SPYx is demonstrated only in the sandbox.

Tokenized stocks trade around the clock, while their underlying stocks do not. Intatto adjusts new borrowing limits to the US market session: 50% during regular hours, 40% during extended hours, and 30% declining toward 20% over the weekend. Its liquidation threshold stays at 65%. Repayment and added collateral remain available when borrowing is blocked.

A trusted keeper relays the issuer's indicative price, checked against onchain bounds; its fetch time is not a source-price timestamp. Corporate-action guards pause borrowing around splits, credit caps use sampled exit depth, and liquidation uses bounded slices. Losses exceeding recovered collateral and the gap reserve reduce lenders' share value.

The hosted mainnet-fork sandbox lets judges try borrowing, weekend refusal, repayment, a historical-price counterfactual replay, and a synthetic 45% gap. A browser proof panel compares selected fork and mainnet evidence and exposes divergences. The free credit API returns onchain capacity and health. OKX AI agent #13907: listing under review. Paid settlement is not enabled.

## Evidence and editorial choices

Sources: [spec.json](../spec.json) for intended mechanics; [README.md](../README.md), [deployment manifest](../deployments/xlayer-mainnet.json), [final VO script v5.3](../film/storyboard/VO_SCRIPT.md), and [QA re-check](../qa/e2e-2026-09-25-recheck/REPORT.md) for implementation and demo scope. The submission wording makes no market-size, exclusivity, guaranteed exit-liquidity, or loss-protection claim. The final VO's broad availability language is narrowed to borrowing subject to guards; sampled depth does not guarantee a future sale. The Chainlink Data Streams adapter is built and unit-tested but not wired live.
