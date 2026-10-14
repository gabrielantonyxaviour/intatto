# Intatto — OKX Dev Day 2026 submission answers

**Draft for Gabriel's approval; never submit automatically.** Product: Intatto; Abel: close-guard 1.0.0. Prepared 25 September 2026.

Page 1 questions below are verbatim from [okx-claude's authenticated read-only capture](FORM_PAGE1.md). This helper's own headless inspection was login-gated; [FORM_INSPECTION.md](FORM_INSPECTION.md) separates those observations. Pages 2–3 remain hidden. Their wording, number of questions and validation are unverified. Bracketed placeholders and editorial notes must not be pasted as final answers.

## Page 1 — verified question wording

### 1. Team Name

**Answer:** Intatto (Gabriel, 14 Oct 2026: "lets use Intatto its fine". The name entered on the original submission was not recorded anywhere.)

Required; short text; character limit unknown.

### 2. Team Size

**Answer:** [OPEN — Gabriel to choose the registered human team size.]

Required; choices: `1`, `2`, `3`, `4`. Do not count AI helpers as team members.

### 3. Team Members' Names

**Answer:** [OPEN — Gabriel to supply each member's exact full name matching their ID.]

Required; text; character limit unknown. Help: “Provide exact full names matching your IDs for prize verification and registration.”

### 4. Which track is the team participating in?

**Answer:** Build a Market – build with X Layer

Required; other option: `Build a Company – OKX AI`. The core working integration is NVDAx-backed USDG borrowing on X Layer; OKX AI is an additional integration with its status disclosed below.

### 5. Participation Route

**Answer:** In-Person (7 Oct 2026)

Required; other option: `Remote`. Selection for the finale is not yet confirmed. The form says in-person entries not shortlisted are automatically judged for Best Remote Build.

### 6. Would the team be able to attend our in-person finale?

**Answer:** [OPEN — Gabriel to choose the scale value, 0–4.]

Required; scale `0 (Unable to)` through `4`. Do not infer this answer from the chosen route or interpret the scale as headcount without the form confirming that meaning.

### 7. Team Display Picture [1:1 Image]

**Answer:** [OPEN — Gabriel to choose an image or leave this optional field empty.]

Optional; one image upload; maximum 10 MB; requested aspect ratio 1:1. No image generated or uploaded for this task.

### 8. Project Name

**Answer:** Intatto

Required; short text; character limit unknown.

### 9. Project Summary

**Answer:**

Intatto lets tokenized-stock holders borrow USDG against NVDAx on X Layer, while USDG lenders earn borrower interest. Borrowing limits follow US market sessions; the liquidation threshold stays fixed. A trusted keeper relays the issuer's indicative price within onchain bounds. Corporate-action guards, sampled-depth credit caps and an explicit reserve-then-lender loss waterfall address off-hours risk. NVDAx is deployed on mainnet. Judges can try weekend refusal, repayment and labelled gap replays in a mainnet-fork sandbox. The free credit API returns onchain capacity and health; OKX AI agent #13907: listing under review.

Required; paragraph; character limit unknown. Covers product, intended user and core integration. [SUMMARY.md](SUMMARY.md) provides shorter and longer alternatives.

### 10. Repository Link

**Answer:** https://github.com/gabrielantonyxaviour/intatto

**OPEN — this repository is PRIVATE.** Gabriel must choose public visibility or give OKX reviewer access before this satisfies the form. Neither action has been taken here. The README covers setup, architecture, deployments, tests and trust limits. Required; short text; character limit unknown.

### 11. Demo Video

**Answer:** TBD — public demo video URL.

**OPEN — a PUBLIC link is required**, for example YouTube, X or Instagram, to a **2–4 minute** demonstration of the working product and integration. The final script is [VO_SCRIPT.md, v5.3](../film/storyboard/VO_SCRIPT.md); it is not the video URL. Gabriel approves the finished video and its publication. Required; short text; character limit unknown.

### 12. Product Link

**Answer:** https://intatto.larinova.com

Supporting links if the field permits:

- Hosted sandbox, explicitly a fork of X Layer mainnet: https://intatto.larinova.com/sandbox
- Browser fork-proof panel: https://intatto.larinova.com/sandbox/proof
- Credit/health integration: https://intatto.larinova.com/agents/credit

Required; short text; character limit and multi-URL validation unknown. Use the main URL if only one is accepted; the app links to the sandbox and proof panel.

### 13. Is this a new project, or are you adding features to an existing one?

**Answer:** Yes, new project

Required; other option: `No, project is built on a pre-existing codebase or product`. This answer is directed by okx-claude. Supporting evidence: `spec.json` records `discoveryMode: fresh`; the repository begins with kickoff commit `c7a6519` on 25 September 2026. The project uses existing open-source libraries and issuer contracts; “new project” does not mean every dependency was newly written.

## Pages 2–3 — unverified wording

No questions on these pages have been observed. Do not present the headings below as exact form questions or a complete inventory. Required/optional flags, types, options and character limits are unknown.

### Declaration — unverified wording

The builder kit calls for accuracy and event-guideline acceptance.

**Proposed answer, only after Gabriel's review:** “I confirm that the submission accurately describes the project and its current integrations, including the disclosed sandbox, replay and listing limitations, and I accept the event guidelines.”

**OPEN — Gabriel must read the actual declaration and personally decide whether to accept it.** Do not check a box or treat this proposed wording as an executed declaration. If pages 2–3 ask about anything else, draft against their actual wording before approval.

## Technical supplement — placement in form unverified

Use this material for technical-link or integration questions if present. The kit requests technical links and contract addresses for Build a Market; it does not establish a separate question or field type.

### Working integration and demo scope

Intatto's mainnet market accepts NVDAx, wraps it in the issuer's non-rebasing wNVDAx wrapper, and lends USDG from an ERC-4626 vault. New-borrow LTV limits are 50% regular session, 40% extended session, and 30% declining toward 20% over 64 closed hours. The liquidation threshold remains 65%. Guard failures can stop new borrowing; repayment and adding collateral remain available.

The keeper is a **trusted relayer of the issuer's indicative price and market session**. The issuer publishes no source-price timestamp, so the displayed fetch time establishes keeper liveness, not market-price freshness. Onchain checks include a pool TWAP band, maximum price movement and USDG peg bounds. The Chainlink Data Streams adapter is built and unit-tested but **not wired live**.

Corporate-action guards pause borrowing around multiplier changes. Credit caps use sampled exit depth; this does not guarantee future sale proceeds. Liquidation uses bounded slices while the market is closed. After collateral recovery, shortfalls use the gap reserve; amounts beyond it become lender deficits that reduce share value. **Lenders can lose money.**

The hosted sandbox is a fork of X Layer mainnet with a separate chain ID, `1960196`; mainnet is `196`. NVDAx is live on mainnet; SPYx is sandbox-only. Time travel, impersonation, funding and fork-only configuration changes are disclosed in the divergence ledger. The browser proof panel checks selected blocks, code and state with stated exclusions; it is not exhaustive state or ledger-integrity proof.

The January 2025 NVDA replay applies historical Dukascopy CFD bid-minute data to the current fork as a **counterfactual**, not historical X Layer liquidity. That scenario does not liquidate the example position. The separately labelled **synthetic 45% gap** demonstrates liquidation, reserve exhaustion and a lender deficit. These examples do not establish a general solvency guarantee.

### OKX AI

**OKX AI agent #13907: listing under review.**

The submitted A2MCP service is “Borrow capacity and health.” Its free HTTPS endpoint, `https://intatto.larinova.com/api/credit`, reads a wallet's session, borrowing capacity, refusal reason, price/guards, collateral, debt and liquidation health at one onchain block. The integration page is https://intatto.larinova.com/agents/credit.

At this task's read-only check, the receipt endpoint recorded **0 OKX AI calls**, with 67 total receipts from other sources. Registration and a working direct API call do not prove marketplace consumption. The x402 challenge is implemented and tested; payment verification and settlement are not wired, and paid mode is off.

### Mainnet contracts and dependencies

All addresses below are taken exactly from [deployments/xlayer-mainnet.json](../deployments/xlayer-mainnet.json), chain **196**, deployment block **71562056**, timestamp **2026-09-25T10:11:32.000Z**. “Protocol” means deployed Intatto contracts; “External” means an existing integration dependency. Explorer links are address references; this drafting task did not independently re-verify every contract's source or bytecode.

| Scope | Contract / manifest field | Address and OKLink |
|---|---|---|
| Protocol | LendingVault / `vault` | [0x89fC3a0637768fA0c7e779375786bc129B6c308C](https://www.oklink.com/x-layer/address/0x89fC3a0637768fA0c7e779375786bc129B6c308C) |
| Protocol | GapReserve / `gapReserve` | [0x4CB09f7b032cb5F6575faE46176e9697DB07CB52](https://www.oklink.com/x-layer/address/0x4CB09f7b032cb5F6575faE46176e9697DB07CB52) |
| Protocol | SessionRiskController / `sessionRisk` | [0x2d7F438AB59767fD48b4E560B16B72bD8Fb055c8](https://www.oklink.com/x-layer/address/0x2d7F438AB59767fD48b4E560B16B72bD8Fb055c8) |
| Protocol | DepthCapRegistry / `depthCaps` | [0x30279C37B299b51f03F4b2b5898902670e13F986](https://www.oklink.com/x-layer/address/0x30279C37B299b51f03F4b2b5898902670e13F986) |
| Protocol | BoundedLiquidator / `liquidator` | [0xc0289c36e72a2E6a799D01EdF11FC460D07bEAc0](https://www.oklink.com/x-layer/address/0xc0289c36e72a2E6a799D01EdF11FC460D07bEAc0) |
| Protocol | InterestRateModel / `interestRateModel` | [0xa3677c6aAC24C366C5A75083738ba568cEf8AD16](https://www.oklink.com/x-layer/address/0xa3677c6aAC24C366C5A75083738ba568cEf8AD16) |
| Protocol | MarketLens / `lens` | [0xb7c45ca15038Ab9b0eDDC9607cdB6e2bfA89dD66](https://www.oklink.com/x-layer/address/0xb7c45ca15038Ab9b0eDDC9607cdB6e2bfA89dD66) |
| Protocol | NVDAx CollateralMarket / `markets[0].market` | [0xE6708CC6598F17611f9A468f9907052688459D0D](https://www.oklink.com/x-layer/address/0xE6708CC6598F17611f9A468f9907052688459D0D) |
| Protocol | NVDAx PriceRelayAdapter / `markets[0].priceRelay` | [0xf69c0EA60a6f6b94fF3C0F40af8bA3B97A4567a4](https://www.oklink.com/x-layer/address/0xf69c0EA60a6f6b94fF3C0F40af8bA3B97A4567a4) |
| Protocol | NVDAx CorporateActionGuard / `markets[0].corporateActionGuard` | [0x4b4B28da545064837CFbd66C16F94f21a0750BDE](https://www.oklink.com/x-layer/address/0x4b4B28da545064837CFbd66C16F94f21a0750BDE) |
| External | USDG / `usdg` | [0x4ae46a509F6b1D9056937BA4500cb143933D2dc8](https://www.oklink.com/x-layer/address/0x4ae46a509F6b1D9056937BA4500cb143933D2dc8) |
| External | NVDAx token / `markets[0].token` | [0xc845b2894dBddd03858fd2D643B4eF725fE0849d](https://www.oklink.com/x-layer/address/0xc845b2894dBddd03858fd2D643B4eF725fE0849d) |
| External | wNVDAx wrapper / `markets[0].wrapper` | [0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5](https://www.oklink.com/x-layer/address/0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5) |
| External | wNVDAx/USDG pool / `markets[0].pool` | [0x2a2B11730C2b6d99a58034A869dd810D7300a7b2](https://www.oklink.com/x-layer/address/0x2a2B11730C2b6d99a58034A869dd810D7300a7b2) |

The manifest's `operator` and `keeper` are the same **account, not an additional protocol contract**: [0xaBa1F7e4FB0500696855BF38012676c10e3ef808](https://www.oklink.com/x-layer/address/0xaBa1F7e4FB0500696855BF38012676c10e3ef808).

### Evidence behind the draft

- [spec.json](../spec.json): intended product and risk mechanics. Some original prose describes planned paid services and uses the old Close Guard name; current deployment and disclosures take precedence in these answers.
- [README.md](../README.md): implemented architecture, setup, contract inventory and trust limits.
- [VO_SCRIPT.md v5.3](../film/storyboard/VO_SCRIPT.md): final approved narrative; precise scope and limitations retained here where spoken shorthand is broader.
- [QA rerun](../qa/e2e-2026-09-25-rerun/REPORT.md) and [later QA re-check](../qa/e2e-2026-09-25-recheck/REPORT.md): observed mainnet reads, complete fork journey, subsequent fixes and listing status.
- [.abel-work/codex-journeys-final-report.md](../.abel-work/codex-journeys-final-report.md): seven executed journeys passed at that report's checkpoint; its run IDs predate later reruns.
- Current `bash .abel/graph circuit show close-guard 1.0.0`: **7/7 screens, 10/11 systems, 7/8 journeys proven**, no owner acceptance. `sc_keeper_live` remains unverified. This is not a claim that every mainnet gate is complete.
- [Ideation builder kit](../../../hackathons/okx-dev-day-2026/ideation/sources/builder-kit.md), [briefing](../../../hackathons/okx-dev-day-2026/ideation/sources/okx-briefing-session-1.md), and [current official kit](https://www.okx.com/en-eu/learn/okx-dev-day-builder-kit): package requirements. No broader market-size or exclusivity claim is needed for these answers.
