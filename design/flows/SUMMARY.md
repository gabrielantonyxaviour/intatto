# Intatto: reference flows from live lending products

Captured on 2026-09-25 with headless Chromium at 1440×900, plus 390×844 phone shots (m*.png). A read-only mock wallet (EIP-1193 + EIP-6963, "Read-only Mock") showed real positions. It refused every signing call with code 4001, including the one it received (Liquity's eth_sendTransaction on Sepolia). Nothing was signed or sent.
- flows.json: all 105 steps. screen-flows.json: one flow per screen; pg_borrow has two (Liquity V2 primary, Morpho secondary).
- Addresses (public, read-only): Aave 0x2784a546…9379 (HF 1.51, $694k collateral, 370k USDC debt). Morpho 0xA56da9BB…846F (800 weETH / 1.05M USDC, 77% LLTV). Liquity Sepolia 0x2bfe19b7…775c (13.11 test ETH).

## Screen → flow to emulate
| Screen | Flow | Steps | Other captures |
|---|---|---|---|
| pg_market | Kamino xStocks → NVDAx reserve | 8 | aave/01–03, aave/28 |
| pg_borrow | Liquity V2 borrow (primary); Morpho isolated market (secondary) | 14 / 11 | aave/14–19, aave/27 |
| pg_lend | Morpho vault: primer → deposit → allocation → risk | 5 | kamino/11, aave/06–10 |
| pg_risk | Kamino risk dashboard | 6 | aave/13, morpho/15, kamino/08, kamino/12 |
| pg_agents | x402scan catalog → service → try-with | 3 | agents/04 |
| pg_sandbox | Tenderly Virtual Environments (docs) | 7 | — |
| pg_fork_proof | Aave seatbelt fork-simulation report | 6 | tenderly/07 |

## pg_market
1. Chips in the header for price, oracle and liquidation style ("Price $224.56 · Soft liquidations from 1.00% · Oracle: Scope"); each chip has a tooltip explaining it (kamino/06–08).
2. Show the layered oracle in words: most recent price, floored and capped by ChainlinkX, referenced against Pyth. Intatto's price band can be written the same way (kamino/08).
3. Collateral-only assets show "–" in place of a borrow rate and have no Borrow button, like NVDAx in Intatto (kamino/03).
4. Supply-cap usage as a ring ("80.16% · 2.40B of 3.00B"); max LTV, liquidation threshold and penalty in three tiles (aave/04).
5. Five headline numbers across the top: deposits, loans, size, available, borrows (aave/01).
6. Frozen or paused reserves hidden behind a toggle; when shown, one sentence says what still works (withdraw, repay) and what is refused (aave/28–29).
7. Oracle price history on the reserve page (flat stretches when the stock market is closed) plus a Proof of Reserves card with the reserve address (kamino/13–14).
8. On phones the table becomes cards and the reserve page splits into Overview and Your info tabs (aave/m01, aave/m03).

## pg_borrow
1. One vertical form (collateral → loan → rate) with a consequence line under each input: price and Max LTV; fee, liquidation price, LTV and a risk dot (liquity-borrow/2–7).
2. The risk label changes wording and colour at set thresholds: LTV 38.5% green "Low", 77% red "High"; above the limit, LTV shows in red as ">90.91%" and the liquidation price moves above spot (liquity-borrow/4–6).
3. Preset loan chips at fixed risk levels ($7.1K green, $14K amber, $19K red) beside free typing; "Max 12.99 ETH" keeps a gas buffer (liquity-borrow/3, /7).
4. The refusal reason is the button label ("Enter an amount", "Maximum borrowable exceeded", "Insufficient USDC balance"); the value causing it turns red with an alert icon (morpho/08, /11, aave/14).
5. Every position number shown as before → after (Loan 1.05M → 1.15M, Collateral 800 → 810, LTV 44.29% → 47.91%) next to the liquidation LTV; Aave does the same with HF 1.51 → 1.44 (morpho/04–05, aave/15–16).
6. Risky actions need an acknowledgement: when HF after the action falls below 1.5, a red callout and an "I acknowledge the risks involved" checkbox appear and the button stays disabled until ticked (aave/16–17, /25). Some actions are refused outright with a sentence, e.g. turning off collateral when HF would go 1.52 → 0.58 (aave/27).
7. Max is bounded and explained: borrow Max limited by max LTV or available liquidity (Aave HF 1.04; Morpho 110.72k of liquidity); withdraw Max shows only what is safe ("Supply balance 85.05" of 160 ETH); repay Max = min(wallet, debt) with an amber note when the wallet falls short (aave/18, /22, /24, morpho/09).
8. Review → wallet step → recoverable error: preview card plus itemised receipt (creation fee, refundable gas deposit); "Please sign the transaction in your wallet. Retry" while the wallet is open; "Retry: Open Position" and a collapsed error with More details after a refusal, with form values kept (liquity-borrow/10–14). Morpho re-simulates in the review and shows placeholders until the result arrives (morpho/06–07). Repay and withdraw-collateral share one mirrored panel (morpho/10–11).

## pg_lend
1. First-visit primer: lender → vault → markets, and depositors carry each market's collateral, oracle and LLTV risk; a terms checkbox gates the first deposit (morpho/20).
2. The deposit panel projects monthly and yearly earnings as you type ($38.47/mo, $471.60/yr) next to APY (morpho/21–22).
3. Show exactly where the money is lent: each market with collateral and LLTV, allocation, liquidity, caps (morpho/23).
4. Loss disclosure in plain words: "There is no insurance fund… losses are socialized among the lenders of that specific asset" (kamino/11). Show realised and unrealised bad debt even at 0 (morpho/12).
5. Risk section: curator, risk rating, owner/curator/guardian roles, 7-day timelock (morpho/24, /21).
6. Interest-rate curve marking current utilisation (aave/05).
7. Deposit review as a receipt: source, destination, APY in green, collateralisation, the receipt token you get; the button names the next wallet step (aave/10).

## pg_risk
1. Oracle table: timestamp, spot price, TWAP price, divergence % (risk/02), with the layered-oracle explanation (kamino/08) and a check against a reference price (Morpho shows oracle vs DefiLlama, morpho/12).
2. Daily rate limits with live usage and a reset countdown: "Daily new debt limit 6,000 NVDAx · today 2.05 · resets in 0 mins"; daily withdrawal cap resets in 678 mins (kamino/12).
3. Loans ranked by distance to liquidation: current/max/unhealthy LTV, distance, collateral, debt, collateral liquidation price (risk/04).
4. Price-shock scenarios: all assets, one asset, correlation-based (risk/03); collateral-at-risk curve against price (morpho/15).
5. Histogram of debt by LTV (risk/05).
6. Utilisation row coloured by stress level; headline tiles with 24h deltas (risk/06, risk/01).
7. Parameter sheet with an explanation per mechanism (soft-liquidation tooltip with a worked example, kamino/07); frozen state with its reason and governance link (aave/29).

## pg_agents
1. Service cards (name, one-line description, domain, "Try it") plus a natural-language intent search ("Try: send email, generate image…") (agents/01, /04).
2. The service page shows usage as proof it is live: transactions, volume, buyers with 30-day sparklines (agents/02).
3. Endpoint rows: METHOD badge + path + tags + description, price per call right-aligned ($0.20 / $0.10 / Free), copy button (agents/02).
4. "Try with ▾" menu of clients that can call it: AgentCash, Poncho, awal, Agent Wallet, pay.sh (agents/03).
5. Side facts (resource count, tags, pay-to addresses) and an "Add your API" entry point (agents/01–02).

## pg_sandbox
1. The fork's identity first: parent network, chain id, fork block, admin RPC and public RPC (tenderly/01).
2. Creation form: parent network, block height, custom chain id, state sync on/off (tenderly/02–03).
3. Time-travel and balance controls named after their cheatcodes: increaseTime, setNextBlockTimestamp, increaseBlocks, setBalance, setErc20Balance (tenderly/04).
4. Snapshot and revert are first-class, with the stated limit that one revert rolls back at most 2,000 blocks (tenderly/05).
5. Every cheatcode logged as a transaction in the activity table: status, function, block, from/to (tenderly/04, /06).
6. Dry-run before committing: outcome, gas, state changes, events (tenderly/07).

## pg_fork_proof
1. The header pins how to reproduce the run: simulation link, state, creator, payloads per chain with address and id (seatbelt/02, /01).
2. One heading per check with ✅ or ❌ ("Check: Reports all state changes ✅") (seatbelt/03–06).
3. Evidence directly under each check: storage diffs in red and green (old → new), decoded events (seatbelt/03–04).
4. Checks list every address they covered (verified / not verified / EOA) so a pass can be audited (seatbelt/05).
5. Safety invariants named as checks, e.g. no selfdestruct in touched contracts (seatbelt/06).

## Blocked or skipped
- Kamino: no Solana wallet mock, so no supply/borrow modal (kamino/15 shows the connect gate); no weekend or market-hours text on the site.
- Venus, LlamaRisk and Chaos Labs: not attempted (time).
- x402scan: try-it needs a paying x402 wallet; clicking a resource row does not expand it.
- Tenderly: dashboard needs a paid login, so docs pages were captured.
- Liquity Sepolia: The Graph data unavailable, so the redemption-risk indicator stayed grey and the rate histogram did not show.
- Liquity Earn: not captured.
