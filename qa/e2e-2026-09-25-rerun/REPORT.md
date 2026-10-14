# Intatto live QA rerun — 25 September 2026

## Verdict

**FAIL for a clean QA sign-off. The complete sandbox journey PASSED, and both previous HIGH issues are FIXED.**

Remaining issues: the unfiltered receipts endpoint still fails; the sandbox Lend page omits SPYx exposure; capacity precision still differs between Market and Borrow; one public-RPC 429 reached the console; the Risk page's server-source claim is inaccurate. No code, commits or deployments were changed by this QA run.

## Scope and method

- Live app: https://intatto.larinova.com; hosted sandbox: https://intatto-rpc.larinova.com.
- Requested fix deployment: `d0dd8999`. Tested the currently served production app, approximately **11:24–11:40 UTC**. The public UI did not expose an independently verifiable deployment-version identifier.
- Headless Playwright Chromium, **390, 820 and 1440 px**, height 1000. All seven requested routes captured at each width; populated states and the sandbox journey have additional screenshots. Screenshots were visually inspected at narrow, medium and wide widths.
- Mainnet wallet: `0x7F23b131F7312bd0f63EF79974E215Dc3E12a415`, injected through a read-only EIP-1193/EIP-6963 provider. Every signing/send request rejects with **4001**. One Borrow request was deliberately rejected to prove the boundary; no mainnet transaction was broadcast.
- Independent mainnet reads: `cast` against `https://xlayerrpc.okx.com`, including the API's exact block. Sandbox reads used an independent viem client, checked for chain **1960196** before signing through the app's burner.
- Fresh session `0rt93_mhyU05I6sPjEsiHQ`, fork block **71563431**, burner `0x4dBFf9…62BaeC`. Burner key was not saved in the report or evidence. Session was reset and then **ended** after testing.
- Existing dirty work and earlier screenshots were preserved. Temporary test orchestration lived in `/tmp`; only QA evidence was written here.

## Previous bugs: explicit disposition

| Previous item | Result | Evidence / actual result |
|---|---|---|
| HIGH 1: four fork-proof checks on a fresh hosted session | **PASS — FIXED** | Fresh session: **4 of 4 passed**, and 4/4 again after reset. Four block hashes, 14 external-code addresses, 12 unchanged-state reads, and Intatto code checks. [Proof result](proof-result.json), [390 px](proof-top-390.png), [full 1440 px](sb-02-proof-1440.png). |
| HIGH 2: honest proof labels; SPYx sandbox-only | **PASS — FIXED** | Explicitly says sandbox state/code are read **now**, mainnet at the fork block; lists mutable values separately and says they do not fail equality; masks immutables explicitly; compares SPYx to the build, explicitly **not mainnet**. Mainnet `/borrow?market=SPYx` declares the fallback to NVDAx. [Proof text](sb-02-proof-1440.txt), [mainnet SPYx](mainnet-spyx-unavailable.png). These are scoped checks, not exhaustive state or ledger-integrity proof. |
| MED 3: sane Lend loss example | **PASS — FIXED** | Mainnet: vault holds **1.4975 USDG**, a loss that size wipes out deposits; no impossible percentage. Sandbox: 1,000 / 49,854.210659 ≈ **2.005%**, correctly displayed. [Mainnet Lend](lend-final-1440.png), [sandbox Lend](sb-11-lend-deficit-1440.png). |
| MED 4: Market reserve and deficits | **PASS — FIXED** | Mainnet shows reserve **0.50 USDG**, deficit **0.00 USDG / 0 recorded**, plus the waterfall explanation. Matches cast. [Market](market-ready-1440.png). |
| MED 5: Borrow selector and working sandbox SPYx | **PASS — FIXED** | Picker changed URL to `?market=SPYx`; labels, wrapper, quote and transaction targets followed it. Approved and deposited **0.1 SPYx**, then borrowed **10 USDG**, with independent chain reads confirming the position. [SPYx confirmed](sb-18-spyx-borrowed-1440.png), [states](sandbox-states.json). |
| MED 6a: `/api/credit/receipts` works | **FAIL — NOT FULLY FIXED** | Bare endpoint and `?limit=5` return JSON **503 RECEIPTS_UNAVAILABLE**, repeatedly. `?source=direct` and `?source=okx-ai&limit=5` return 200. See R1 below. |
| MED 6b: unknown `/api/*` JSON 404 | **PASS — FIXED** | `/api/qa-unknown`: 404 `application/json`, `code: NOT_FOUND`. [API results](api-browser.json). |
| MED 7: liquidation row and lender-loss column | **PASS — FIXED** | Desktop has “Liquidation starts” and “Lenders lose (est.)”; mobile renders equivalent cards. SPYx −90% row shows **2.67 USDG** estimated loss after the reserve was exhausted. [Borrow 390](borrow-connected-390.png), [SPYx gap table](sb-18-spyx-borrowed-390.png). |
| LOW: one risk scale | **PASS — FIXED in exercised views** | Market/Borrow/review: ~36% LTV is Medium; sandbox NVDAx ~35.4% is Medium; SPYx 13% is Low. Shared labels agree across views. |
| LOW: one capacity figure | **FAIL — presentation remains inconsistent** | Calculation agrees, but Market displays **0.041441 USDG**, Borrow **0.0414 USDG**. Max fills **0.041439**, the documented two-micro-unit safety margin. The old calculation mismatch appears fixed; the literal single displayed figure is not. [Comparison](capacity-comparison.json), [Market](capacity-market.png), [Borrow](capacity-borrow.png). |
| LOW: refusal state on Max and chips | **PASS — FIXED** | Saturday: Max and available preset disabled with SessionLimit reason. Corporate action: Low/Medium/High and Max all disabled, with CorporateActionPending title/accessible text; collateral Max remains enabled, correctly allowing additions. [Saturday](sb-06-refused-390.png), [corporate refusal](sb-14-corporate-refusal-390.png). |
| LOW: rounding / readable small figures | **PASS for tested accounting figures** | Lend keeps meaningful precision: **1.4975** deposits, **1.0975** idle, **1.000002** share price; deficit **148.173416**. No negative or >100% loss example. Conservative token truncation remains: a 0.1 SPYx deposit, less one wei after wrapping, displays 0.0999 SPYx. Capacity precision is separately failed above. |
| LOW: no overflow at 390 px | **PASS — FIXED** | Document scrollWidth equaled viewport width on every base route at all three widths, and on populated proof, refusal, SPYx and liquidation states. No clipped page-wide content observed; large code/table areas use their own scrolling. [Matrix](responsive.json), [proof](proof-result.json). |
| LOW: Risk links | **PASS — FIXED** | Market links to guards/history; Borrow to sessions/caps and market stress; Lend to loans and stress. Risk views, transaction links and Trust page are present. |
| LOW: no dRPC console errors | **PASS — FIXED specifically for dRPC** | No dRPC requests/errors observed. One `xlayerrpc.okx.com` 429 occurred instead; see N3. |
| LOW: `chain=1` validation | **PASS — FIXED** | HTTP **400**, JSON `code: WRONG_CHAIN`. [API results](api-browser.json). |

## Full journey

| Step | Result | Observed evidence |
|---|---|---|
| Mainnet Market, Borrow and Lend match chain | **PASS** | Mainnet values below; API account fields match cast at API block 71566430. |
| Mainnet read-only wallet rejects signing | **PASS** | `eth_sendTransaction` intercepted and rejected 4001; UI says “You rejected the request in your wallet.” [Evidence](mainnet-signature-rejection.json), [screen](mainnet-signature-rejected.png). |
| Start fresh hosted session and proof | **PASS** | Funded burner, distinct chain ID, 4/4 checks. |
| Deposit and borrow | **PASS** | Deposited **1 NVDAx**, borrowed **80 USDG**; account shares `998301692354459832`, debt ~80 USDG. [Confirmed](sb-04-borrow-confirmed.png). |
| Jump to Saturday → refused | **PASS** | CLOSED, **28.12%** max LTV after 12 hours; attempted +1 USDG refused **SessionLimit**, no signature. [Screen](sb-06-refused-1440.png). |
| Repay while CLOSED | **PASS** | Approved USDG and repaid whole loan; independent account debt **0**. [Screen](sb-07-repaid-saturday.png). |
| January 2025 replay | **PASS** | Labeled CFD counterfactual; ledger **0 bounded liquidation slices**. Scenario borrower ended **59.59% LTV**, health ~1.09069, `liquidatable=false`; reserve and deficit unchanged. [Borrower](january-scenario-borrower.json), [no liquidations](sb-09-january-no-liquidations.png). |
| Synthetic 45% gap | **PASS** | One successful liquidation settlement; reserve ended **0**; deficit **148.173416 USDG**; share price **1.000018 → 0.997055**. [Event](liquidation-events.json), [Lend](sb-11-lend-deficit-1440.png), [Risk](sb-20-liquidations-390.png). |
| Corporate action | **PASS** | Schedule sets `corporateActionPaused=true`; borrowing/chips refuse. Activation clears guard, wrapper assets/share ×10, token quote ÷10; burner's collateral value stays **103.269261 USDG** and 1 USDG borrow reaches Review again. [States](sandbox-states.json), [reopened](sb-16-borrow-reopened.png). |
| SPYx | **PASS** | Selector, approve, deposit and borrow all work. Independent debt **10 USDG**, collateral value **76.901699 USDG**, LTV **13%**. [Confirmed](sb-18-spyx-borrowed-1440.png). |
| Reset | **PASS** | NVDAx account exactly matches initial account; SPYx debt 0, deficit 0, reserve restored to **100.5 USDG**, burner USDG restored to **1,000**. Ledger retains reset/history. [Check](reset-check.json), [screen](sb-21-reset-390.png). |
| Agents try-it | **PASS** | Live 200 JSON, correct wallet/mainnet/chain196/session/capacity and `sourceTimestamp:null`. Free status, listing not submitted, browser-only call counter are disclosed. [Screen](agents-tryit-1440.png). |
| No console errors | **FAIL** | One HTTP 429 from public X Layer RPC during Market loading. No JS page errors or failed browser requests were observed; later reads and Risk scan succeeded. [Diagnostics](browser-diagnostics.json). |
| No “Close Guard” leftovers | **PASS in tested visible surfaces** | None in captured page text; title “Borrow · Intatto” and shared description use Intatto. This is not a repository-wide rename audit. |
| No honesty-rule violations | **FAIL** | Core proof/relay/replay/listing disclosures pass. Sandbox Lend's NVDAx-only exposure claim and Risk's “Nothing here comes from our servers” remain inaccurate; N1/N2 below. |

### Mainnet numeric cross-check

Pinned `cast` block **71566415** (11:24:11 UTC). Live price later changed normally; later screenshots are labeled by their observed state and not treated as same-block quotes.

| Value | Independent chain read | UI / API |
|---|---:|---|
| Relayed NVDAx token quote | 226.055 USD | $226.05 (truncated); API 226.055 |
| Session / max / liquidation | EXTENDED / 40% / 65% | Same |
| Vault total assets | 1.497504 USDG | Market 1.497504; Lend 1.4975 |
| Idle | 1.097501 USDG | Market 1.097501; Lend 1.0975 |
| Debt | 0.400003 USDG | Market/API exact; Borrow 0.40 |
| Share price | 1.000002 USDG | Lend 1.000002 |
| Utilization / borrow / supply rate | 26.71% / 4.67% / 0.99% | Same |
| Reserve / deficit / count | 0.5 / 0 / 0 | Same |
| Wallet collateral value | 1.102708 USDG | Market/API exact; Borrow 1.10 |
| Wallet LTV / health / liquidation price | 36.27% / 1.791887… / $126.154619… | 36.27% / 1.79 / $126.15 |
| Borrow capacity | 0.041080 USDG | API exact at block 71566430; cast same-block account matched |

Raw evidence: [mainnet cast](mainnet-cast.json), [API-block cast](credit-same-block-cast.txt), [API](api-browser.json).

### Synthetic waterfall: exact settlement

Transaction `0x73a7be15193f4f4381f91306928b027da88feae0bcf0405ddd87ab15b3806406`, sandbox block **71563519**, receipt **success**:

- Proceeds **2,037.584917 USDG**; repaid **1,940.557063**; penalty **97.027853**; surplus **0.000001**.
- Reserve covered **149.206199 USDG**, including its share of the penalty and accrued-interest contribution; it is not limited to the 100.500899 balance before settlement.
- Lender deficit **148.173416 USDG**, deficit count **1**, final reserve **0**.
- UI displayed the same values at its stated precision. [Decoded event](liquidation-events.json).

## Remaining and NEW bugs

### R1 — MED — receipts endpoint requires an undocumented source filter

**Previous MED 6 is not fully fixed.** Reproduced with browser fetch and curl, including a later repeat:

| Request | Actual |
|---|---|
| `/api/credit/receipts` | 503 `RECEIPTS_UNAVAILABLE` |
| `/api/credit/receipts?limit=5` | 503 `RECEIPTS_UNAVAILABLE` |
| `/api/credit/receipts?source=direct` | 200; 5 calls at the time tested |
| `/api/credit/receipts?source=direct&limit=5` | 200; includes the real QA try-it call |
| `/api/credit/receipts?source=okx-ai&limit=5` | 200; 0 calls |

Expected: the documented bare endpoint works, or returns a clear 400 for a genuinely required input. Current 503 wrongly presents the missing filter as an unavailable backend. [Request matrix](receipts-matrix.json).

### N1 — NEW MED — sandbox Lend omits a live SPYx exposure

Reproduce: start sandbox → select SPYx in Borrow → deposit 0.1 SPYx → borrow 10 USDG → open Lend.

Actual: headline correctly says **10.4 USDG lent out**, but copy says “The vault lends to one market” and “Every USDG that is not idle is owed by people borrowing against NVDAx.” Overview says **1 (NVDAx)**. Allocation lists only **0.4002 USDG** NVDAx debt; the **10 USDG SPYx debt** and its collateral are missing. The loss discussion's “across all borrowers” figures are therefore also incomplete.

Expected: sandbox Lend derives market list/allocation/risk totals from both deployed markets, with SPYx explicitly sandbox-only. Mainnet can keep its single-market presentation. [Screen](sb-19-lend-after-spyx.png), [text](sb-19-lend-after-spyx.txt), `sandbox-states.json` → `spy-borrowed`.

### N2 — NEW LOW — Risk page inaccurately denies a server data path

The live page says **“Nothing here comes from our servers.”** The browser successfully receives event chunks from this app's **`/api/risk/logs?network=mainnet&from=…&to=…`** endpoint. The data is chain-derived, but the claimed direct-only provenance is false.

Expected wording distinguishes onchain origin from the cached server transport. No fabricated event data was found. [Observed requests](risk-network.json), [Risk screenshot](risk-prices-final-1440.png).

### N3 — NEW LOW / operational — public RPC 429 still reaches console

One `https://xlayerrpc.okx.com/` response returned **429**, with “Failed to load resource” in the console during Market loading. No dRPC failure occurred. The app subsequently recovered and the numeric and Risk checks passed. This does **not** reproduce the old dRPC error, but it fails the requested zero-console-error condition. [Diagnostics](browser-diagnostics.json).

### R2 — LOW — inconsistent capacity precision remains

Market **0.041441**, Borrow **0.0414**, Max **0.041439**. The last difference is a sensible explicit accrual margin; the first two are differing truncation precision for the same capacity. Standardize the visible figure or label its approximation. This is a display consistency issue, not an observed over-borrow or contract arithmetic error. [Comparison](capacity-comparison.json).

## Evidence notes and limitations

- Screenshot names ending in `390`, `820`, `1440` state viewport width. `*-final-*`, `*-ready-*` and numbered `sb-*` capture loaded states; some first-pass connected captures include the Lend introduction modal or initial loading placeholders.
- First Python urllib probes received Cloudflare 1010/403 due to that client; those are preserved in `api.json` and **are not used as endpoint verdicts**. Browser fetch and curl supplied the reported API evidence.
- Read waits initially used the wrong fresh-session test ID and a role locator hidden by the Lend modal. Those harness waits were corrected; neither was classified as an app defect.
- Fork proof excludes values explicitly marked as mutable and compares masked Intatto runtime code; a green report must not be represented as exhaustive state equality or proof that every ledger entry is complete.
- No mainnet signing, value transfer, code edits, commits, deploys, or new registrations. Hosted QA session ended after reset. This run tests functionality and presentation, not a security audit or sustained concurrency benchmark.
