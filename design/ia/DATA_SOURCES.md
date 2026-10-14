# Intatto data-source audit

**Summary: 7 PASS source checks; 9 FAIL findings (including 2 disclosed sandbox fixture/simulation findings and 1 incomplete verification requirement). Overall: FAIL for an unqualified “nothing is mocked/hardcoded” claim.**

Audited 2026-09-25, approximately 14:03–14:12 UTC. Source checkout HEAD `76f3644d1db31a7458599e7a4572d8ec9f1a70dd`, with concurrent uncommitted work. Production: https://intatto.larinova.com. This is a data provenance audit, not a security audit or a claim that current source equals the deployed bundle. Only this report was written; no product edits, commits, graph verification, deployment, mainnet transactions, or wallet signing.

The financial tiles are real contract reads. The sandbox is a real fork with deliberately changed state, seeded money and replay fixtures. Some shared copy describes its pool-derived prices as issuer quotes. Several risk terms and agent states are literal strings. Fast initial rendering is not evidence of mocked balances.

## Evidence and limits

- **L1:** direct `cast block-number --rpc-url https://xlayerrpc.okx.com` returned **71576066**. All L1 calls below used `cast call ... --block 71576066`. Browser Market/Borrow/Lend observations preceded or followed this sample; their hooks use `latest`, so these are numerical spot comparisons, **not proven same-block UI comparisons**.
- **L2:** live credit API returned block **71576133**, `asOf=2026-09-25T14:06:09.000Z`; direct lens and parameter calls were pinned to **71576133**. This is exact API-to-RPC evidence.
- **S1:** the browser switched, without an audit action, from live mode to an existing shared session `SnQE1wnhAgQdmd-PTTYaFw`, burner `0x19fC1038c7F0bA6EF58847Aff81Ed05e1fb74241`. Its RPC is `https://intatto-rpc.larinova.com/rpc/SnQE1wnhAgQdmd-PTTYaFw`. Direct head reads before and after the sandbox observations returned **71563460**; chain time **1790345152**, fork block **71563431**. All S1 contract calls were explicitly pinned to **71563460**. No scenario, warp, reset or transaction was submitted to this session.
- **S2:** to fulfill fresh-session inspection without replacing another worker's shared browser session, this audit created `CQ6Q1r6GgFRNtGQ05J0BHQ` via the same public `POST /session` used by `/sandbox`. Its RPC is `https://intatto-rpc.larinova.com/rpc/CQ6Q1r6GgFRNtGQ05J0BHQ`; burner `0xa51D615ac78f0Ca70eb4918EE25D261aA8a94Ed8`; head **71563460**, chain time **1790345297**. Key discarded without printing or saving. S2 is API/RPC evidence, not the session rendered in browser samples. It will expire after 30 idle minutes; no end/delete endpoint exists in the inspected router.
- **B:** browser DOM/accessibility observations, using the connected Gabriel Brave profile through Codex browser control. Built-in browser was unavailable. Market, Borrow, Lend and Risk were inspected live; all seven screens, including `/agents/credit` and `/sandbox/proof`, were inspected in S1. Existing live wallet was only read. Calling credit Try it added one ordinary local call-history entry and a server receipt, as the read endpoint normally does.
- **P:** Fork proof rendered **4 of 4 passed** for S1, run started **14:07:43 UTC**. Five independent direct-RPC comparisons are below. This does not prove every state difference is explained: moving-state rows explicitly never fail the check.
- Direct Python HTTP requests received 403; repeating the same public GETs with curl and a browser User-Agent returned 200. This was a client access difference, not evidence of fake API payloads.
- No screenshots/videos or extra proof files were created. No processes or existing sessions were stopped. Applicable skill bodies read: Abel Build profile and browser-identity. No build loop was invoked because this assignment expressly forbids it.

## Source key, addresses and refresh behavior

`M`, `V`, `A` mean `MarketLens.market(market)`, `.vault(market)`, `.account(market,wallet)`. The lens is `0xb7c45ca15038Ab9b0eDDC9607cdB6e2bfA89dD66`; NVDAx market is `0xE6708CC6598F17611f9A468f9907052688459D0D`. Addresses come from `deployments/xlayer-mainnet.json`, inlined into the browser through `NEXT_PUBLIC_LIVE_DEPLOYMENT`; sandbox deployment comes from session metadata. Static deployment addresses are configuration, not fabricated balances; owner/keeper labels can nevertheless become stale after role changes.

| Role | Mainnet address / function behind lens |
|---|---|
| Vault | `0x89fC3a0637768fA0c7e779375786bc129B6c308C`: `idle`, `totalAssets`, `totalSupply`, `sharePrice`, `utilizationBps`, `deficitCount`, `totalDeficit`, `deficitAt` |
| Reserve | `0x4CB09f7b032cb5F6575faE46176e9697DB07CB52`: `balance` |
| Session | `0x2d7F438AB59767fD48b4E560B16B72bD8Fb055c8`: `currentSession`, `lastPost`, `maxLtvBps`, `baseLtvBps`, `closedFloorBps`, `closedDecayDuration`, `livenessLimit` |
| Relay | `0xf69c0EA60a6f6b94fF3C0F40af8bA3B97A4567a4`: `latestPrice`, `guardStatus`, `twapWrapperPrice`, `impliedWrapperPrice`, `usdgStatus`, guard parameters, `keeper`, `owner` |
| Corporate action | `0x4b4B28da545064837CFbd66C16F94f21a0750BDE`: `isPaused`, pending-action state and window/tolerance parameters |
| Caps | `0x30279C37B299b51f03F4b2b5898902670e13F986`: `capOf(market)`, `sliceOf(market)`, `stepBps`, `minStepUsdg` |
| Liquidator | `0xc0289c36e72a2E6a799D01EdF11FC460D07bEAc0`: `penaltyBps`, `openFloorBps`, `closedFloorBps`, `closedTimeoutFloorBps`, `closedTimeout` |
| Rate model | `0xa3677c6aAC24C366C5A75083738ba568cEf8AD16`: `borrowRateBps`, `supplyRateBps`, `baseBps`, `slope1Bps`, `slope2Bps`, `kinkBps` |
| NVDAx / wrapper | `0xc845b2894dBddd03858fd2D643B4eF725fE0849d` / `0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5`: `balanceOf`, pause/multiplier, `convertToAssets` |
| USDG / pool / feed | `0x4ae46a509F6b1D9056937BA4500cb143933D2dc8` / `0x2a2B11730C2b6d99a58034A869dd810D7300a7b2` / `0x385C6bDDE06b0E438319bF4ddBfFe51C521ABf3D` |

Browser contract reads use `NEXT_PUBLIC_XLAYER_RPC_URL` if built in, then `https://xlayerrpc.okx.com`, `https://rpc.xlayer.tech`; dRPC is explicitly omitted in browsers. Server reads use `XLAYER_RPC_URL` and the configuration fallback list, which includes `https://xlayer.drpc.org`. Exact server override is not publicly disclosed; direct audit RPC was OKX. Sandbox reads use the session's RPC, not a mainnet endpoint.

`web/lib/chain/context.tsx` creates a per-runtime React Query cache with **10 s staleTime**, no focus refetch. Mode/session changes create a new cache. `web/lib/chain/reads.ts` polls M/V/A every **12 s**, client-side. These calls are individually coherent but not one shared block snapshot. StaleTime is a reuse policy, not a maximum age: failed requests/background suspension can retain data indefinitely. No finite worst-case age can be promised without an expiry gate. This audit did not demonstrate an old successful tile being silently served beyond a disclosed cadence.

Other cadences: chain head/time **5 s**; Market protocol parameters **60 s**, relay details **12 s**, recent price events **30 s**; Risk parameters **120 s**, loans **30 s**, actions **15 s**, keeper HTTP **60 s**; Lend rate model **60 s staleTime with no periodic refetch**; Borrow closed-decay parameters likewise **60 s staleTime, no interval**. Successful transaction/preflight invalidation is additional, not a source of simulated completion.

## Market `/`

Every row below applies in both modes unless stated. Amounts are USDG (6 decimals), token/wrapper quantities and prices use 18 decimals, percentages use bps. PASS sample means observed numerical agreement; L1's UI block limitation still applies.

| Number/state | True source | Live or cached (TTL) | Verified by |
|---|---|---|---|
| Total deposits | V.totalAssets → vault.totalAssets | Browser RPC, 12 s | PASS: L1 `1497509` → UI `1.497509`; S1 `50001497505` → `50,001.49` |
| Available | V.idle → vault.idle | 12 s | PASS: L1 `1097501` → `1.097501`; S1 `50001097501` → `50,001.09` |
| Loans / borrowed | Sum M.totalDebt, market.totalDebt | 12 s, separate market calls | PASS: L1 `400009` → `0.400009`; S1 `400004` → `0.400004` |
| Utilisation | V.utilizationBps → vault.utilizationBps | 12 s | PASS: L1 `2671` → `26.71%`; S1 `0` → `0.00%` |
| Reserve | V.reserveBalance → reserve.balance | 12 s | PASS: L1 `500000` → `0.50`; S1 `100500000` → `100.50` |
| Deficit amount / count | V.totalDeficit / deficitCount | 12 s | PASS: both snapshots `0 / 0`, UI `0.00 / 0 recorded` |
| Collateral value, supplied token amount, wrapper shares | M.totalCollateralValue, totalShares, assetsPerShare; client sums and conversion | 12 s | S1 `1102175`, `4869771035243362`, `1001701196801074000`; UI `1.102175`, `0.004869 wNVDAx`, `0.004878 NVDAx` |
| Stock rows/count, symbol, collateral-only, USDG row, contract addresses | deployment.markets, static product semantics, filter over guard results | Build/session metadata; no role refresh | B: live 1 market, sandbox 2; SPYx sandbox-only; `markets-table.tsx`, `contracts-card.tsx` |
| Session, period began, posted time, current max LTV, liquidation threshold | M.session/periodChangedAt/sessionPostedAt/maxLtvBps/liquidationThresholdBps | 12 s | S1 OPEN, 5000/6500, posted `14:05:47`; same-block direct lens |
| Price, fetch time, freshness, in-band, peg, corporate/issuer pause | M.priceE18/fetchedAt and five guard flags; relay/guard/token state | 12 s; keeper post age is distinct from UI age | S1 price `225945713000000000000`, UI `$225.94`; true/true/true/false/false. Source prose FAIL F6 |
| Cap, used %, remaining room, closed slice | M.capUsdg/sliceUsdg/totalDebt and local ratios | 12 s | S1 cap `50000000000`, slice `11259688682`; UI 50,000 / 11,259.68; seeded FAIL F4 |
| Borrow/supply rates | V.borrowRateBps/supplyRateBps → model at utilization | 12 s | L1 467/99 → 4.67%/0.99%; S1 200/0 → 2.00%/0.00% |
| Session limits/decay, liquidation floors/penalty; TWAP, implied wrapper quote, feed answer/time and relay bounds | `useProtocolParams`, `useRelayDetail` direct functions in source key | 60 s / 12 s | Source traced; L2 penalty 500. Session explanatory strings use fetched parameters where present |
| Recent posts, tx/hash/time/deviation/move | Relay PricePosted logs, direct browser getContractEvents | 30 s; keeps previous real data while fetching; newest 8, max 10×100 upstream blocks plus local fork blocks | `use-price-posts.ts`; not synthetic chart points; partial recent history, not lifetime history |
| Your balances, position, capacity, lending assets; connected/wrong-chain/loading states | A + wagmi connection + query status | 12 s / local state | S1 wallet NVDAx `9999999999999999999`, USDG `1000000000`; zero loan/vault position |

## Borrow `/borrow`

| Number/state | True source | Live or cached (TTL) | Verified by |
|---|---|---|---|
| Session | M.session | Browser RPC 12 s | PASS: S1 `1` → OPEN; L1 also OPEN |
| Current max new-borrow LTV | M.maxLtvBps | 12 s | PASS: S1/L1 `5000` → 50.00% |
| Liquidation line | M.liquidationThresholdBps; header also literal 65% | 12 s + static copy | PASS value: S1/L1 `6500` → 65.00%; static duplicate FAIL F1 |
| Variable interest rate | V.borrowRateBps | 12 s | PASS: S1 `200` → 2.00%; L1 `467` → 4.67% |
| Issuer wrapper conversion | M.assetsPerShare → wrapper.convertToAssets(1e18) | 12 s | PASS: S1/L1 `1001701196801074000` → `1.0017` |
| Wallet collateral | A.walletToken → token.balanceOf(wallet) | 12 s | PASS: S1 raw `9999999999999999999` → 9.9999; live wallet raw 1 → `<0.0001` |
| Quote and fetch time | M.priceE18/fetchedAt | 12 s | S1 `$225.94`, `14:05:47`; source label FAIL F6 |
| Existing collateral/shares/value, debt/LTV/health, liquidation price, borrow capacity | A fields; MarketLens delegates positionOf/valueOf/isLiquidatable and calculates ratios | 12 s | S1 and live audit wallet: zero positions; no fabricated sample loan |
| Form amount, max, preset LTV, projected health/LTV/capacity, repay/withdraw limits | User input + A/M/V through `borrow/math.ts`, `plan.ts` | Local recomputation | No onchain transaction until submit; max uses wallet balance, liquidity, cap and session; preset targets are intentional UI choices |
| Gap table: shocks, liquidation boundary, shortfall/reserve/lender loss; annual interest | Deterministic what-if math over position and fixed shock steps; penalty constant | Local scenario, not historic observations | `gapRows`, `dropToLiquidation`, `yearlyInterest`; fixed penalty FAIL F1; labelled projections |
| CLOSED floor/duration; explanation 50/40/30→20, 65, 5, 20% reserve | Decay RPC plus hardcoded `market-info`, `borrow-screen`, reviews, loan-details, gap-table | Decay staleTime 60 s; prose no TTL | FAIL F1: mutable session terms are typed; penalty/threshold/reserve duplicated rather than read |
| Refusal/review/approval progress, wallet/network/empty/loading/error states | Guard math, `preflight.ts` simulations, ERC20 allowance/wagmi transaction receipts and local workflow | Preflight 5 s staleTime /15 s poll | Source trace; no `setTimeout` faking successful approval or transaction |

## Lend `/lend`

| Number/state | True source | Live or cached (TTL) | Verified by |
|---|---|---|---|
| Deposits / available | V.totalAssets / idle | Browser RPC 12 s | PASS: L1 UI 1.4975 / 1.0975; S1 UI 50,001 / 50,001, formatting truncates underlying 50001497505 / 50001097501 |
| Lent out / utilisation | V.totalAssets−idle and V.utilizationBps | 12 s | PASS: UI 0.4 in both; L1 26.71%, S1 0.00% |
| Supply / borrow rate | V.supplyRateBps / borrowRateBps | 12 s | PASS: L1 0.99% / 4.67%; S1 0.00% / 2.00% |
| Share price | V.sharePrice | 12 s | PASS: L1 `1000005` →1.000005; S1 `1000000` →1.000000 |
| Shares outstanding | V.totalSupply | 12 s | PASS: L1 `1497501` →1.4975; S1 `50001464112` →50,001.46 |
| Reserve and deficits | V.reserveBalance/totalDeficit/deficitCount | 12 s | PASS: L1 0.50/0/0; S1 100.50/0/0 |
| Allocation, collateral, debt, threshold, cap, capacity, guard explanation per market | useLendMarkets → M per deployed symbol; V.idle; local min/ratios | 12 s; not cross-market atomic | `allocation-section.tsx`; S1 NVDAx cap 50,000, SPYx sandbox-only, both 65% |
| Rate curve/kink and base/slopes | InterestRateModel parameters; client borrowRateAt/supplyRateAt | staleTime 60 s, no periodic refresh | B live curve 2% →10% at 80% utilization →110%; supply curve defaults reserve factor to 2000, FAIL F1 |
| Monthly/yearly projections, expected shares, max withdrawal | Form amount × current rate, preview/conversion/idle/account reads | Local preview/query state | Explicit simple-interest projections; zero amount legitimately displays zero earnings |
| Wallet USDG, your vault shares/assets/fraction | A.walletUsdg/vaultShares/vaultAssets and V.totalSupply | 12 s | S1 wallet 1,000; both audit wallets hold zero vault shares |
| Deficit history row time, borrower, amount, before/after share price | LendingVault.deficitAt(index), newest 50 based on V.deficitCount | Query keyed by count; no separate interval | Empty UI corresponds to count 0; not a fixture list |
| Risk waterfall %, reserve funding %, session table, owner/keeper | Real V/M quantities plus typed 5/20/50/40/30/20/64 and deployment.operator/keeper | Static copy/build metadata | FAIL F1/F3; owner/keeper labels do not reread role rotation |
| iUSDG name/6 decimals, number of markets, primer acceptance/empty/error/step state | Static product token metadata; deployment length; `intatto:lend-terms:v1` localStorage; query/wallet state | Build/local persistence | Not live token metadata discovery; primer was not accepted during audit |

## Risk `/risk` (all subviews)

| Number/state | True source | Live or cached (TTL) | Verified by |
|---|---|---|---|
| Session / max LTV | M.session / maxLtvBps | Browser RPC 12 s | PASS S1 OPEN /50.00%, L1 OPEN /50.00% |
| Price / wrapper-implied price | M.priceE18; price×assetsPerShare | 12 s | PASS S1 `$225.94` / `$226.33` from pinned M; source prose FAIL F6 |
| Liquidation threshold | M.liquidationThresholdBps, params fallback | 12/120 s | PASS S1/L1 6500 →65%; defaults FAIL F2 |
| Reserve | V.reserveBalance | 12 s | PASS S1 100.50; L1 0.50 |
| Deficit / count | V.totalDeficit/deficitCount | 12 s | PASS S1/L1 0.00 /0 |
| Cap / debt / used %, collateral, supplied, utilization/rates | M and V, local ratios | 12 s | PASS S1 cap50,000 / debt0.40 / collateral1.10 / supplied50,001.49 |
| Claimed block/time; post ages, change since oldest post | Separate latest-block query; latest.timestamp minus posted/fetched time; first/last event comparison | 5 s block vs12 s M/V | S1 71563460, price5 s old at frozen chain time. Live summary claimed block71576100 without pinning M/V: FAIL F8 |
| Borrower/open-loan count, loans table shares/assets/debt/LTV/health/liquidation/distance, histogram | Borrow event addresses → pinned `MarketLens.account` snapshot; local ranking/buckets | 30 s + progressive log discovery | S1 1 open loan after scan; initial live scan showed 0 before finding history. Treat as count among scanned borrowers, not entire market |
| Price-shock panels and curves, loss/reserve coverage, debt at risk | Real loans × selected shock; SHOCKS 5/10/20/30/50%, CURVE10–90%; simplified recovery math | User-controlled what-if | No random series; hardcoded fallback6500/500 FAIL F2; simulations are not executed liquidations |
| Market-overview color, cap/LTV distribution | M/V/loans derived ratios; 80/90% stress-color boundaries and histogram bins are UI constants | Underlying queries | Static visual classifications, not claimed contract limits |
| Sessions/limits/decay/liveness, trust bounds/roles/guard parameters | SessionRiskController/relay/liquidator/caps/guard/market direct reads in use-risk-params | 120 s | Source table enumerates functions; typed 65 and price-band fallback text FAIL F1/F2 |
| Corporate-action pending/activation/multiplier/pause, window/tolerance | Direct guard/token reads and Action events | Actions15 s, params120 s, logs below | `actions-view.tsx`; empty pending state is real contract state |
| Price-post chart/table, liquidations, slice waits, debt/proceeds/shortfalls/reserve events, session and keeper tx history | Decoded chain logs, getBlock timestamp; getTransaction sender for permissionless actions | Head poll30 s live/10 s sandbox; progressive backfill, RPC backoff up to30 s | Not fixtures; partial scan exposed. Log cache sample below matched RPC exactly |
| Keeper service log/time/kind/detail/hash; issuer quote/period/open/next-change/halt/multiplier/disagreement | `https://intatto-keeper.larinova.com/log` and `/status`, Durable Object SQLite | HTTP no-store; UI60 s; keeper cron1 min | Real live Worker source in **both modes**, FAIL F7 for sandbox association; status sample below |
| Loading/error/empty, scan range/count/progress/source badge | Query/scanner state, actual chunk counters | Progressive local state | No synthetic progress timer; missing reads may still fall back to risk constants, F2 |

## Agents `/agents` and `/agents/credit`

| Number/state | True source | Live or cached (TTL) | Verified by |
|---|---|---|---|
| Catalog service count/name/domain/tags, v1, two resources, free price, #13907, listing “under review”, registration tx | `agents/content.ts`, literal resource count in service.tsx; no registry/listing API | Build-time, unbounded age | B catalog and detail; FAIL F3 for mutable listing/fee/identity claims; resource definitions match two routes |
| Keeper/address, pay-to none, market/network choices, deployment/wrong-wallet notices | Deployment metadata, constants, wagmi and mode | Build/session/local state | B address `0xaBa1…f808`; sandbox query includes session. No fake connection |
| Calls from this page / timestamps / wallet / market | localStorage `intatto:agents:credit-calls`, maximum20 successful calls | Browser-local, persists; no expiry | B count1→2 after this audit's Try it; correctly says not network calls |
| Session | Credit API → pinned M.session | Server RPC, HTTP no-store; page keeps last submitted report | PASS S1 report block71563460 OPEN = direct M=1; L2 OPEN=M=1 |
| Max new-borrow LTV | API M.maxLtvBps | Same report block | PASS S1/L2 5000 = pinned RPC5000 |
| Price | API M.priceE18 /1e18 | Same report block | PASS S1 225.945713; L2 224.185, exact direct RPC match |
| Price fetch time | API M.fetchedAt | Same report block | PASS S1 1790345147 =14:05:47; L2 1790345156 =14:05:56 |
| Guards | API M guard booleans | Same report block | PASS both true/true/true/false/false |
| Liquidation threshold | API M.liquidationThresholdBps | Same report block | PASS both6500; S1 shown in raw JSON |
| Debt, assets, wrapper shares, value/LTV/health, capacity, reason, liquidation price/gap/liquidatable | API A + M/V, `computeCredit`/borrowRefusal local calculation at one block | No-store, last call remains until resubmission | S1 zero position and capacity0, SessionLimit, null liquidation price/health; directly corroborated A. No fabricated loan |
| Block, chainId, asOf | Server getBlock(latest), getChainId; all lens calls pinned to returned block | Per call | S1 block71563460/asOf14:05:52; L2 block71576133/asOf14:06:09 |
| Labels “under30min”, “30-min band”, “within1%” | GUARDS array in try-it.tsx, typed explanatory labels | Build-time | FAIL F1: can diverge from owner-settable bounds; sandbox price-source label FAIL F6 |
| OKX/direct receipt counts | `/api/credit/receipts` proxy → keeper `/receipts?source=...` | No-store; not the browser local counter | Observed okx-ai0/direct59/total59; backend receipts not used to render “Calls from this page” |

## Sandbox `/sandbox`

| Number/state | True source | Live or cached (TTL) | Verified by |
|---|---|---|---|
| RPC chain id | getChainId; expected1960196 in config/session | 60 s staleTime +15 s visible-card invalidation | PASS S1 1960196; metadata agrees; parent196 is config |
| Latest block and chain time | getBlock(latest) | 5 s | PASS S1 71563460 /1790345152 =14:05:52; head unchanged across observations |
| Market session / max-LTV prose | M.session plus static SESSION_LIMIT map | 12 s +15 s invalidation / prose static | PASS S1 OPEN; direct5000 agrees50%; typed session explanation FAIL F1 |
| Burner NVDAx | token.balanceOf(burner) | Direct browser RPC, 15 s while visible | PASS S1 raw9999999999999999999 →9.9999; S2 same raw at its own block71563460 |
| Burner SPYx | token.balanceOf(burner) | 15 s | PASS S1/S2 raw1999999999999999999 →1.9999 |
| Burner USDG | token.balanceOf(burner) | 15 s | PASS S1/S2 raw1000000000 →1,000 |
| Burner OKB | eth_getBalance | 15 s | PASS S1 raw100000000000000000 →0.1 |
| Fork block, snapshot age, deployment, RPC URL, session ID, funded holder | `/health` bundled snapshot meta; created session response/localStorage | Build snapshot, no automatic rebase; health query10 s staleTime | fork71563431; created2026-09-25T10:35:08.373Z; FAIL F4 for fixture/seeded source (disclosed) |
| Session active/expired, created/lastActive, 30idle minutes | Session DO state; IDLE_MINUTES constant | session query30 s; API reads can touch activity | S1 active; S2 creation201; expiry is wall-clock, not simulated chain time |
| Ledger count, status/kind/summary/detail/time/hash | Durable session ledger + bundled snapshot ledger | UI15 s, refreshed after actions | S1 22entries; funding, owner impersonation, cap50,000, reserve+100, lender50,000, USDG maxAge30days visibly disclosed |
| Scenario percentages/dates/ratios/durations/next-step descriptions | copy.ts and bundled replays JSON, actual fork scenario methods | Build-time; not fresh issuer history | FAIL F5: January CFD counterfactual;10-for-1 scenario; synthetic45% gap; each labelled. No scenario run in audit |
| Start/admin/loading/progress/refusal state | Actual POST lifecycle; static denied-method list vs optional RPC probe | Local pending state; real responses | No fake progress. Did not press evm_mine probe, reset, warp or end another session |

## Fork proof `/sandbox/proof`

Live mode without a stored fork is a no-sandbox/input state, not a financial dashboard. Proof always compares a supplied/session sandbox to public mainnet. B observed four genuine async checks complete; no preset PASS array.

| Number/state | True source | Live or cached (TTL) | Verified by |
|---|---|---|---|
| Fork block71563431 hash | eth_getBlockByNumber on both RPCs at71563431 | Per run; not periodically refreshed | PASS P and independent cast: both `0x39cd860eb0a09786ec4a3931622ba185fbeadb237f1e585044deecc81371c039` |
| Fork−1 block71563430 hash | Both RPCs at71563430 | Per run | PASS both `0x460528191c3347085062d86ed7ba150b8fb17f91d6d96e440996ee2dce28c27a` |
| Fork−10 block71563421 hash | Both RPCs at71563421 | Per run | PASS both `0x33bd886550f6c0761bf3f763e29c0974acf384ea57a8250f212fa0f9763006b2` |
| Fork−100 block71563331 hash | Both RPCs at71563331 | Per run | PASS both `0xb6b9b4090dfda756fa002c619056f694a080035aed27f089c1d45f717724f3fa` |
| USDG totalSupply | token.totalSupply; mainnet fork block71563431 vs S1 current block71563460 | Per run; intentionally different state heights | PASS raw1513579282911390 on both →1,513,579,282.91139; direct calls reproduced UI |
| Chain ids / selected RPC / input fork block / started and finished time | RPC chainId, session/manual inputs, client Date.now | Run snapshot; no TTL | B1960196/196, OKX RPC, started14:07:43; times are execution metadata, not chain measurements |
| External code sizes/hashes/equality, proxy implementation/admin addresses | eth_getCode, eth_getStorageAt, aggregator/getPool calls; keccak256 | Sandbox latest vs mainnet fork block | P14addresses; NVDAx2138bytes; code checks real. Target addresses/slot keys are static config |
| Unchanged state12reads and moving state9values | targets.ts contract calls/storage slots; balances, multiplier, slot0/liquidity, wrapper conversion, feed latestRoundData | Sandbox latest vs mainnet fork block | P feed0.9999, unchanged state passed; moving differences displayed with regex-matched ledger explanations and never fail |
| Intatto code size/hash/immutable ranges/compiler/diff offset, sandbox-only marker | Sandbox code vs mainnet latest code; SPYx compares bundled artifacts.generated.ts; maskImmutables | Live reads + build artifact, no artifact TTL | Intentional static bytecode reference, not a mocked RPC; does not attest mutable contract configuration |
| 4/4, individual pending/pass/fail/refused/unreachable, coverage counts | Actual Promise results and row counts in use-fork-proof/check-* | Last run until rerun | P4/4; timeout10 s and pacing timers are real I/O control |
| Ledger entries, reproduce commands, funding/scenario notes | Session ledger; commands generated from actual RPC/address/block inputs | Fetched per proof run | S1 22entries; no claim later simulated state is mainnet history |

## APIs, Workers and source freshness

`/api/credit` and `/api/credit/health` route to `web/lib/credit/handler.ts`; `query.ts` validates wallet/market/network/session. `compute.ts` pins three lens calls to the same getBlock result. Financial data is server-side onchain; there is no sample-report fallback. Bare credit request returns a **static service description** and example wallet `0x7F23b131F7312bd0f63EF79974E215Dc3E12a415`, not that wallet's report. Health checks chain access plus configured deployment, not bytecode correctness. Paid-mode challenge defaults0.01USDG/300s, but settlement is unwired and live calls are free; those are configuration constants, not successful payment evidence. API headers are `Cache-Control: no-store`.

`/api/health` returns literal `ok:true`, configured deployment presence, configured sandbox URL and wall-clock time **without any RPC**. Observed200/deployedtrue; it is web liveness, not chain or keeper health. Unknown API paths return static404 `{error,code}`. No raw stack/database error is the intended API result.

`/api/risk/logs` validates≤100-block range, returns raw eth_getLogs for the deployment's watched addresses. Server head memory cache5s; Cloudflare `caches.default` and response max-age **15s for recent/unsettled chunks**, **86400s for complete chunks >10blocks behind head**. Historical data is expected immutable, but reorg corrections can remain stale for a day; the response's `latest` is also a cached snapshot, not current head. Cache key is request URL, not a deployment hash. Browser scanner polls head30s and progressively fills ranges; slow backfill/retries have no hard worst-case completion time. Observed range **71576100–71576199**: API200, max-age86400, **one log identical in all raw fields to direct OKX eth_getLogs for that exact range**.

Keeper `services/keeper/src/worker.ts` instantiates **XStocksIssuer**, not RecordedIssuer. It polls `https://api.xstocks.fi/api/v2`: asset metadata, price-data, system status and multiplier. Asset/multiplier cache30s per isolate; quote/status uncached; single-flight/budget/backoff30s→10min or Retry-After. Cron1min, non-overlap lease3min; issuer data age is not bounded under outages. `fetchedAt` is keeper wall time because quote has no source timestamp; session period time may use calendar reconciliation. Depth is real QuoterV2 sell-size sampling, not a “sample data” fixture.

Keeper `/log`, `/status`, `/receipts` read SQLite in the KeeperState DO, no-store. Retention: actions50,000; receipts5,000, so receipt totals are retained counts, not guaranteed lifetime totals. `/status` observed cycle14:05:56, chainTime1790345156, actions1/sent1/failures0/duration3183ms; issuer reading14:05:57, quote224.185, market OPEN, nextChange20:00, multiplier1.001701196801074. `/log` recorded the matching post and tx `0xd2d958fc78c55333c0eb8b551d323acc34ffa9b1555df73b23983c6ceb5687df`. `/receipts` requires source; omitted source correctly400. With source=okx-ai it returned0calls, total59, empty latest. The web proxy returned okx-ai0/direct59; zero OKX receipts is not a hardcoded zero and does not establish whether a registry task executed elsewhere.

Sandbox Worker imports **container/snapshot/meta.json** at build time; container loads **state.json**. Session DO/API exposes metadata/status/ledger and filtered RPC to Anvil. The base is mainnet fork71563431 with live NVDAx contracts plus sandbox-only SPYx. Start warps clock toward wall time, impersonates owner/keeper, posts **calendar sessions and pool-implied quotes**, and transfers fixed funds from a real holder on the fork. It does not poll the live issuer adapter for those posts. Normal freshen threshold10min, contract price/session liveness30min; old snapshots cap clock advance14days and widen feed staleness30days. Direct S2 `usdgMaxAge=2592000` versus live L2 `93600` (26h). No random fake balances: session IDs and burner keys use crypto randomness, while balances are real fork state seeded with chosen amounts.

## Why the pages feel instant

Next renders the shell/static copy and skeletons; actual financial data waits for client hydration and RPC. `ChainReady`, `shell-skeleton`, per-screen loading states and the observed empty→populated Borrow/Lend states demonstrate this separation. OpenNext serves JS/CSS/static assets through the Worker ASSETS binding; `open-next.config.ts` has no incremental data cache and explicitly describes client chain reads. The observed log response carried `x-opennext:1`. This is not SSR of a frozen financial fixture.

Shared M/V/A query keys reuse recent values across mounted views, with10s freshness and12s polling; a lens bundles many underlying contract reads into one eth_call. Next Link navigation/prefetch can prepare route assets; this audit did not capture a network trace proving a particular link was prefetched. Static catalog/copy appears without RPC. Cached historical logs make repeat event views quicker; initial logs still progressively load. Fork proof is slower because it really issues many reads, with pacing/retry. None of the inspected timers fabricates finished financial operations.

## PASS checks and FAIL findings

Counts below are **distinct audit checks/findings**, not a sum of every field/table cell. A numerically matching tile can coexist with a failing source label or hardcoded explanation.

| ID | Result | Evidence / proposed fix |
|---|---|---|
| P1 | PASS | Live M/V/A numeric reads exist and match observed stable tiles at L1; no fixture payload in shared lens hooks. Exact UI block caveat F9 remains. |
| P2 | PASS | Sandbox financial and wallet samples are actual S1 RPC state at71563460; five or more samples per financial screen reproduced. |
| P3 | PASS | Credit reports are pinned server-side reads; S1 rendered report and L2 API price/session/fetch/guards/threshold match their explicit RPC blocks. |
| P4 | PASS | Risk logs API returned the identical raw event for a fixed range; cache is of real logs, not rewritten chart data. |
| P5 | PASS | Keeper uses live issuer adapter; status/log/receipt endpoints are real durable records, with no fake success fallback found. |
| P6 | PASS | Fork proof4/4 was observed, plus four exact block-hash comparisons and USDG supply independently reproduced by cast. |
| P7 | PASS | Skeletons, timers, local call history, scenario labels and what-if inputs have identifiable UI/runtime purposes; no Math.random finance generator or timer-faked transaction completion found in scope. |
| F1 | FAIL — hardcoded terms | Borrow header/market-info/review/gap-table/loan-details; Lend primer/risk/rates/deposit; Risk sessions text; Sandbox copy; Agents GUARDS repeat65/5/20/50/40/30/20/64h/30min/1% and model reserve factor2000. **Fix:** share active-chain parameter reads and label explicit assumptions in what-if math; constants matching today's contracts are still typed, not fetched. |
| F2 | FAIL — fallback risk values | Risk price-posts falls back to30min/3/8/15/1%; loans/price-shock fallback6500 and500 can display authoritative-looking numbers when reads are unavailable. **Fix:** show unknown/loading and prevent derived assertions until required reads succeed. |
| F3 | FAIL — mutable static metadata | Agent listing under-review/#13907/free/payment status and keeper identity are build strings; Lend owner/keeper come from deployment JSON, not role reads. **Fix:** fetch status/config/roles or show a dated verified snapshot; keep static resource documentation separate. No current listing contradiction was verified. |
| F4 | FAIL — seeded sandbox state (disclosed) | Snapshot fixture,50,000USDG lender,100USDG reserve top-up,50,000cap,30-day feed tolerance and10NVDAx/2SPYx/1,000USDG/0.1OKB burner funding are chosen inputs. **Fix:** retain explicit seed/simulation labels near aggregates and link ledger; never characterize them as organic mainnet activity. Removing them is not proposed. |
| F5 | FAIL — replay fixtures (disclosed) | `services/sandbox/src/replays.ts` imports JSON CFD counterfactual, corporate-action scenario and synthetic45% gap. **Fix:** preserve provenance/kind/source/hash labels in every consumer; do not call these historical X Layer liquidity or live issuer events. |
| F6 | FAIL — wrong sandbox price provenance | Shared Market/Risk/Lend/Agents copy and `computeCredit.PRICE_SOURCE` say issuer quote, but SandboxSession.refreshKeeper→keeperTick uses poolImpliedQuote/calendar. B S1 shows issuer-source prose for225.945713. **Fix:** mode-specific source metadata/copy identifying simulated pool-derived posts and replay overrides. |
| F7 | FAIL — mixed-mode keeper panel | Sandbox Risk uses fixed NEXT_PUBLIC_KEEPER_LOG_URL to display live mainnet keeper `/log` and `/status`, alongside sandbox state. **Fix:** label it mainnet-only or use the session ledger/keeper source in sandbox; do not imply these readings drove sandbox prices. |
| F8 | FAIL — unsupported block attribution | Risk summary says M/V figures are “at block” latestBlock, but latestBlock refreshes separately every5s while lens calls independently use latest every12s. **Fix:** pin M/V to a captured block and carry its number/time with the returned snapshot. |
| F9 | FAIL — verification coverage gap | Five exact same-block **live rendered UI** comparisons per screen were not established; live M/V/A have no retained block IDs and live Sandbox/Fork proof have no financial dataset without a fork. Sandbox samples, exact credit comparisons and fork proof were completed; fresh S2 created through API, browser S1 preserved. **Fix:** rerun in an isolated browser with read-only RPC tracing or a block-pinned audit mode, retaining original live UI request/result block evidence. Do not count L1 matches as strict same-block proof. |

Search covered `web/**`, keeper and sandbox source for mock/fixture/sample/demo/placeholder/stand-in/TODO, Math.random, Date.now, setTimeout, percentages, refresh/cache terms and JSON imports. `RecordedIssuer` is present but not instantiated by the production keeper entrypoint; fixtures under checks are not browser market payloads. `DEMO_WALLET` is example curl input. “sampleDepth” is real quote sampling; UI placeholders are skeleton/input copy; local.ts “stand-in” is local Anvil hosting. Date.now is cache/backoff/lease/run-time/session-clock metadata; setTimeout is timeout/pacing/copy-feedback/reconnect control. Static JSON/build artifact sources and all identified financial constants are accounted for above.

No code was fixed. The report records intentional simulation separately from misleading source claims and incomplete proof; it must not be read as an all-clear for production freshness or an exact-source/deployed-build equivalence certificate.
