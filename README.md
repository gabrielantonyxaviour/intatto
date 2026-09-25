# Intatto

Borrow USDG against tokenized stocks on X Layer, with risk limits that know when the real stock market is closed.

A tokenized stock (xStocks' NVDAx) trades 24/7, but the stock behind it does not. At night and over weekends its
price comes from thin trading, the issuer cannot mint or redeem, and Monday can open with a gap. Intatto is a
lending market that plans for that: new borrowing capacity follows the US market session, splits and dividends
pause a stock instead of mis-valuing it, credit is capped by real exit depth on X Layer, liquidation is bounded
while the market is closed, and any loss runs through an explicit waterfall that lenders can read.

- **Live app (X Layer mainnet):** https://intatto.larinova.com
- **Hosted sandbox (a fork of X Layer mainnet you can time-travel):** https://intatto.larinova.com/sandbox
- **Prove the sandbox is a real fork, in your browser:** https://intatto.larinova.com/sandbox/proof
- **Credit and health API (for agents, OKX AI A2MCP):** https://intatto.larinova.com/api/credit
- **Keeper log:** https://intatto-keeper.larinova.com/log

## Try it in two minutes

1. Open the [sandbox](https://intatto.larinova.com/sandbox) and start a session. You get a burner wallet funded with
   NVDAx and USDG moved from a real X Layer holder (never minted).
2. On **Borrow**, deposit NVDAx and borrow USDG within the weekday limit.
3. Back on **Sandbox**, press **Jump to Saturday**. The session turns CLOSED and the borrowing limit drops.
4. Try to borrow more: the button shows `Refused: SessionLimit` from the contract's own simulation, and nothing is
   sent. **Repay** still works.
5. Replay the **Jan 2025 NVDA weekend gap** or the **synthetic gap**, then read the **Risk console** and **Lend**.

## Mainnet contracts (X Layer, chain 196, all sources verified on OKLink)

| Contract | Address |
|---|---|
| LendingVault (USDG, ERC-4626) | [0x89fC3a0637768fA0c7e779375786bc129B6c308C](https://www.oklink.com/x-layer/address/0x89fC3a0637768fA0c7e779375786bc129B6c308C) |
| CollateralMarket (NVDAx) | [0xE6708CC6598F17611f9A468f9907052688459D0D](https://www.oklink.com/x-layer/address/0xE6708CC6598F17611f9A468f9907052688459D0D) |
| PriceRelayAdapter (NVDAx) | [0xf69c0EA60a6f6b94fF3C0F40af8bA3B97A4567a4](https://www.oklink.com/x-layer/address/0xf69c0EA60a6f6b94fF3C0F40af8bA3B97A4567a4) |
| CorporateActionGuard (NVDAx) | [0x4b4B28da545064837CFbd66C16F94f21a0750BDE](https://www.oklink.com/x-layer/address/0x4b4B28da545064837CFbd66C16F94f21a0750BDE) |
| SessionRiskController | [0x2d7F438AB59767fD48b4E560B16B72bD8Fb055c8](https://www.oklink.com/x-layer/address/0x2d7F438AB59767fD48b4E560B16B72bD8Fb055c8) |
| DepthCapRegistry | [0x30279C37B299b51f03F4b2b5898902670e13F986](https://www.oklink.com/x-layer/address/0x30279C37B299b51f03F4b2b5898902670e13F986) |
| BoundedLiquidator | [0xc0289c36e72a2E6a799D01EdF11FC460D07bEAc0](https://www.oklink.com/x-layer/address/0xc0289c36e72a2E6a799D01EdF11FC460D07bEAc0) |
| GapReserve | [0x4CB09f7b032cb5F6575faE46176e9697DB07CB52](https://www.oklink.com/x-layer/address/0x4CB09f7b032cb5F6575faE46176e9697DB07CB52) |
| InterestRateModel | [0xa3677c6aAC24C366C5A75083738ba568cEf8AD16](https://www.oklink.com/x-layer/address/0xa3677c6aAC24C366C5A75083738ba568cEf8AD16) |
| MarketLens (read-only views) | [0xb7c45ca15038Ab9b0eDDC9607cdB6e2bfA89dD66](https://www.oklink.com/x-layer/address/0xb7c45ca15038Ab9b0eDDC9607cdB6e2bfA89dD66) |

The deployment lives in [`deployments/xlayer-mainnet.json`](deployments/xlayer-mainnet.json). The gap reserve was
seeded with 0.5 USDG, and a demo wallet ([0x7F23…a415](https://www.oklink.com/x-layer/address/0x7F23b131F7312bd0f63EF79974E215Dc3E12a415))
lent 1.4975 USDG, deposited 0.004878 NVDAx and borrowed 0.40 USDG. `npx tsx checks/mainnet.ts --deploy` compares every
contract's runtime code with the build output.

## How it works

| Mechanism | Rule |
|---|---|
| Collateral | NVDAx is wrapped into the issuer's non-rebasing ERC-4626 wrapper (wNVDAx) and valued as `convertToAssets(shares) × price`. The multiplier is never applied twice. |
| Session limits | Max **new-borrow** LTV: regular hours 50%, pre/post-market and overnight 40%, weekend 30% decaying to 20% over 64 hours, halted / corporate action / unknown 0%. A session post older than 30 minutes reads UNKNOWN. |
| Liquidation threshold | Fixed at 65% in every session: the rules never spring on a borrower at Friday's close. |
| Borrow guards | `borrow()` refuses with a named error: `IssuerPaused`, `UnknownSession`, `SessionLimit`, `StalePrice`, `PriceOutOfBand`, `CorporateActionPending`, `TickerCapReached`, `UsdgOffPeg`. `repay()` and `addCollateral()` never read a guard. |
| Price | A keeper relays the xStocks issuer's indicative quote. It carries no source timestamp, so the app shows the keeper's fetch time and never claims market-price freshness. Each post must pass onchain guards: fetch age, the wNVDAx/USDG pool's 30-minute TWAP band (3% in regular hours, 8% otherwise), a 15% max move per post unless the pool's own TWAP confirms it, and Chainlink USDG/USD fresh within 26 hours and within 1% of $1. Rejected posts are recorded onchain. |
| Corporate actions | Around a split or dividend multiplier change the stock pauses 30 minutes before activation, and resumes only when a post-activation price is consistent with the new multiplier. |
| Depth caps | The keeper samples QuoterV2 sell depth and posts a cap. A lower cap applies at once; a higher one rises at most 25% per hour. |
| Liquidation | While the market is closed, only slices bounded by pool depth and a 3% price floor execute (8% after a 6-hour wait); after the reopen the rest is liquidated (15% floor). Slices are sold directly into the Uniswap v3 pool with a price limit. |
| Loss waterfall | Proceeds repay debt, a 5% penalty goes half to the keeper and half to the reserve, and any surplus returns to the borrower. A shortfall is paid by the gap reserve first. Anything beyond it is recognised as a lender deficit (`DeficitRecognised`), which lowers every lender's share value pro rata. **Lenders can lose money in a gap larger than the reserve.** |

On a fork of X Layer, the Jan 2025 NVDA weekend gap (−12.5% at Monday's open, CFD minute data) is absorbed by the 65%
threshold: no position opened within the weekday limit is liquidated. The synthetic 45% gap liquidates the position,
drains the reserve and records the deficit. `contracts/test/ForkScenarios.t.sol` proves both.

## OKX integrations

- **X Layer:** every contract, position, keeper post and liquidation is on X Layer mainnet; collateral, the pool,
  USDG and the USDG/USD feed are native X Layer contracts.
- **OKX AI (A2MCP):** `GET /api/credit?wallet=0x…&market=NVDAx` answers, from onchain reads only, how much a wallet can
  borrow right now, the contract error that would refuse it, the keeper's price and fetch time, the guards, the
  liquidation price and the gap that would liquidate the position. The listing is in [`okx-ai/`](okx-ai/). It ships
  free; the x402 Payment SDK challenge (`eip155:196`, USDG) is built and tested, and will be switched on only after
  a real paid settlement succeeds.
- **Keeper agent:** a Cloudflare cron Worker that reads the issuer every minute and posts session, price, pending
  corporate actions and depth caps, and runs bounded liquidations. Every action is logged with its transaction.

## Trust and limits, stated plainly

- The keeper is a **trusted relayer** of the issuer's quote and market session. Onchain bounds limit the price: it
  cannot move it outside the pool's TWAP band, cannot bypass caps and cannot move funds. It does choose the
  session and corporate-action posts, so a faulty keeper could, for example, allow the weekday limit on a weekend
  or pause a stock; a silent keeper makes borrowing stop (UNKNOWN session, stale price) while repay stays open.
  The [Risk console](https://intatto.larinova.com/risk) lists every post, accepted or rejected.
- The Chainlink Data Streams v10 adapter is built and unit-tested but **not wired live** (no Data Streams entitlement).
- In the **sandbox only**, the relay's USDG/USD staleness limit is widened to 30 days, because a forked Chainlink feed
  cannot update in simulated time (the 1% peg band stays), and the mainnet keeper/owner is impersonated on the fork.
  Every such change is written to the session's divergence ledger.
- Replay prices are Dukascopy CFD bid minutes applied as a counterfactual to today's fork, not historical X Layer
  liquidity. The synthetic gap is labelled synthetic. Hashes and sources are in [`data/replays/`](data/replays/).
- No token, no governance, no firstness or solvency claims.

## Repository

| Path | What |
|---|---|
| `contracts/` | Foundry project: the protocol (`src/`), unit and fork tests (`test/`), deploy scripts (`script/`) |
| `web/` | Next.js app (App Router, wagmi/viem, ReUI/shadcn) on Cloudflare Workers via OpenNext, incl. the credit API |
| `services/keeper/` | Keeper cron Worker with a SQLite Durable Object log |
| `services/sandbox/` | Hosted sandbox: Worker + Durable Objects + one Cloudflare Container (anvil) per session |
| `checks/` | End-to-end checks: fork harness, keeper, credit API, sandbox, UI (Playwright), mainnet, public reachability |
| `config/` | Shared X Layer addresses, deployment schema, session names and generated ABIs |
| `data/replays/` | Replay data with provenance |

## Run the checks

```sh
pnpm install
forge test --root contracts                       # unit tests
forge test --root contracts --match-contract ForkScenarios --fork-url https://xlayerrpc.okx.com
npx tsx checks/fork/self-test.ts                  # the shared fork harness
npx tsx checks/keeper.ts                          # one keeper cycle on a fork
npx tsx checks/credit-api.ts --mode sandbox       # API answers equal contract reads
npx tsx checks/sandbox.ts                         # sandbox sessions, time travel, refusal and repay
npx playwright test checks/ui                     # every screen against a local fork
npx tsx checks/mainnet.ts --deploy                # mainnet code equals the build
npx tsx checks/public.ts                          # the public app and sandbox from outside
```

Built for OKX Dev Day 2026 (Build a Market, with OKX AI).

## License

MIT (see [LICENSE](LICENSE)); files with their own SPDX header keep that license.
