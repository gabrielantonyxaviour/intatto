# Intatto

Borrow USDG against tokenized stocks on X Layer, with risk limits that know when the real stock market is closed.

A tokenized stock (xStocks' NVDAx) trades 24/7. The stock behind it does not. Intatto is a lending market on X Layer: new borrowing follows the US market session, a split or dividend pauses the stock, credit is capped by pool exit depth, liquidation while the market is closed is sliced, and a shortfall is paid by a gap reserve before it is written onto lenders' shares.

## The rules, in numbers

- New-borrow limit: regular hours 50%, pre-market, post-market and overnight 40%, weekend 30% falling to 20% over 64 hours, halted, corporate action or unknown 0%. A session post older than 30 minutes reads UNKNOWN.
- Liquidation threshold is 65% in every session.
- `borrow()` refuses with `IssuerPaused`, `UnknownSession`, `SessionLimit`, `StalePrice`, `PriceOutOfBand`, `CorporateActionPending`, `TickerCapReached` or `UsdgOffPeg`. `repay()` and `addCollateral()` never read a guard.
- A split or dividend pauses the stock 30 minutes before activation.
- A lower depth cap applies at once. A higher one rises at most 25% per hour.
- While the market is closed, liquidation runs in slices bounded by pool depth, with a 3% price floor (8% after a 6-hour wait). After the reopen the floor is 15%.
- Loss waterfall: proceeds repay the debt, a 5% penalty goes half to the keeper and half to the reserve, and any surplus returns to the borrower. The gap reserve pays a shortfall first. The rest is `DeficitRecognised`.
- **Lenders can lose money in a gap larger than the reserve.**

On a fork, the January 2025 NVDA gap (−12.5% at Monday's open) liquidates no position opened within the weekday limit. The synthetic 45% gap drains the reserve and records a deficit (`contracts/test/ForkScenarios.t.sol`).

## What's live

X Layer mainnet, chain 196. Addresses are from [`deployments/xlayer-mainnet.json`](deployments/xlayer-mainnet.json). All sources verified on OKLink. [`deploy/verify-sources.sh`](deploy/verify-sources.sh) submits them.

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

`npx tsx checks/mainnet.ts --deploy` compares each contract's runtime code with the build output.

## Links

- Live app: https://intatto.larinova.com
- Sandbox: https://intatto.larinova.com/sandbox
- Fork proof: https://intatto.larinova.com/sandbox/proof
- Credit API: https://intatto.larinova.com/api/credit?wallet=0x7F23b131F7312bd0f63EF79974E215Dc3E12a415&market=NVDAx
- Keeper log: https://intatto-keeper.larinova.com/log
- Sandbox RPC host: https://intatto-rpc.larinova.com

## Try it in 2 minutes

Use the sandbox. Nothing in these steps is a mainnet transaction.

1. Open [Sandbox](https://intatto.larinova.com/sandbox) and press **Start a session**.
2. Open **Borrow**. Enter a deposit and a loan, then press **Review**. The dialog title is **Review deposit & borrow**.
3. Back on **Sandbox**, open **Time travel** and press **Jump to Saturday**.
4. On **Borrow**, try to borrow more. After the contract simulation, the button reads `Refused: SessionLimit`. Under it: "This borrow would take the position above the current session's borrowing limit." and "The contract refused this in a simulation. Nothing was signed or sent." While that check is still running, the button can read `Maximum borrowable exceeded for the CLOSED session`.
5. **Repay** still opens. Its dialog title is **Review repay & withdraw**.
6. On **Sandbox**, press **Replay the January 2025 gap**, then **Run a synthetic 45% gap**. Read **Risk** and **Lend**.

## Architecture in brief

```
issuer quote → keeper (1 min) → PriceRelayAdapter → CollateralMarket
USDG holders → LendingVault → borrowers
shortfall → GapReserve → else DeficitRecognised (every lender's shares)
```

- **Contracts.** LendingVault holds USDG and issues ERC-4626 shares. CollateralMarket holds wrapped NVDAx and lends against it. SessionRiskController sets the new-borrow limit from the US session. PriceRelayAdapter takes the keeper's price. CorporateActionGuard pauses around a split or dividend. DepthCapRegistry caps debt from pool exit depth. BoundedLiquidator sells closed-market liquidations in slices. GapReserve pays a shortfall before it reaches lenders. InterestRateModel sets the rate. MarketLens is a read-only view.
- **Keeper.** A Cloudflare Worker on a one-minute cron (`* * * * *`). Each cycle posts session, price, corporate actions and depth caps, and runs bounded liquidations. The action log is a SQLite Durable Object (`KeeperState`). Rejected price posts are recorded.
- **Price.** The keeper relays the issuer's indicative quote. The quote has no source timestamp. Onchain checks bound it: fetch age, the pool's 30-minute TWAP band, a maximum move per post, and the USDG/USD peg. The app shows the keeper's fetch time.
- **Credit API.** `GET /api/credit` is free. An x402 challenge (`eip155:196`, USDG) is built and tested. It is switched on only after a real settlement. Listing files are in [`okx-ai/`](okx-ai/).
- **Sandbox.** One Cloudflare Container per session runs anvil from a snapshot of an X Layer mainnet fork. The public RPC refuses admin methods (`anvil_*`, `evm_*`, and the rest listed in `web/components/sandbox/copy.ts`). In a session the keeper posts a price simulated from the forked pool, not the live issuer quote.

## Reproduce the fork proof

In the browser, open https://intatto.larinova.com/sandbox/proof. Start a sandbox session, or pass your own RPC with `?rpc=` and `?block=`. The page checks, in order: block hashes against X Layer, external contract code, state that should be unchanged since the fork (moving values are listed apart), Intatto bytecode against the mainnet deployment or the published build, then the change ledger and a "Reproduce locally" sheet.

From a terminal:

```sh
npx tsx checks/public.ts
```

That check calls the public app health endpoint, opens a sandbox session, checks the sandbox RPC is chain 1960196, checks the fork block hash against X Layer mainnet, and checks that admin methods are refused.

## OKX integrations

- **X Layer.** The contracts, the pool, USDG and the USDG/USD feed are on X Layer mainnet (chain 196).
- **OKX AI (A2MCP).** Agent **#13907**, listing **under review** (submitted 2026-09-25). The service is `GET /api/credit`. Files are in [`okx-ai/`](okx-ai/). Price is 0.
- **Keeper.** The same cron Worker. The agents page labels it OKX AI agent #13907.

## Trust and limits, stated plainly

- The keeper is a trusted relayer of the issuer's quote and of the market session. Onchain bounds stop a price outside the pool TWAP band. The keeper does not move funds and does not bypass caps. It does choose the session and corporate-action posts, so a bad post can set the weekday limit on a weekend or pause a stock. If the keeper goes quiet, new borrowing stops (unknown session, stale price) and repay stays open. [Risk](https://intatto.larinova.com/risk) lists posts, including rejected ones.
- [`ChainlinkV10Adapter.sol`](contracts/src/ChainlinkV10Adapter.sol) verifies a Chainlink Data Streams v10 report. [`ChainlinkV10.t.sol`](contracts/test/ChainlinkV10.t.sol) says Intatto holds no Data Streams subscription and the adapter is not wired live.
- Sandbox only: the relay's USDG/USD age limit can be widened up to 30 days, because a forked Chainlink feed does not update in simulated time. The peg band stays. The mainnet keeper and owner are impersonated on the fork. Those changes are written to the session divergence ledger.
- Replay prices in [`data/replays/nvda-2025-01-gap.json`](data/replays/nvda-2025-01-gap.json) are Dukascopy CFD bid minutes, not historical X Layer liquidity. [`data/replays/synthetic-gap.json`](data/replays/synthetic-gap.json) is marked synthetic.
- SPYx is not in `deployments/xlayer-mainnet.json`. The app marks it sandbox-only.
- Seeded sandbox amounts (lender funds, reserve top-up, borrow cap, burner balances) are chosen for the fork. They are not organic mainnet activity.
- No token. No governance.

## Local development

pnpm is pinned at 10.12.1 (`packageManager` in the root `package.json`). Node is not pinned there.

```sh
pnpm install
forge test --root contracts
pnpm -C web dev
npx tsx checks/fork/self-test.ts
```

`pnpm -C web dev` runs `next dev`. Names the web app reads, values not listed here: `NEXT_PUBLIC_LIVE_DEPLOYMENT`, `LIVE_DEPLOYMENT`, `NEXT_PUBLIC_SANDBOX_API_URL`, `NEXT_PUBLIC_XLAYER_RPC_URL`, `NEXT_PUBLIC_KEEPER_LOG_URL`.

Checks, each path is in the repo:

```sh
pnpm install
forge test --root contracts
forge test --root contracts --match-contract ForkScenarios --fork-url https://xlayerrpc.okx.com
npx tsx checks/fork/self-test.ts
npx tsx checks/keeper.ts
npx tsx checks/credit-api.ts --mode sandbox
npx tsx checks/sandbox.ts
npx playwright test checks/ui
npx tsx checks/mainnet.ts --deploy
npx tsx checks/public.ts
```

## Repository

| Path | What |
|---|---|
| `contracts/` | Foundry project: protocol (`src/`), tests (`test/`), deploy scripts (`script/`) |
| `web/` | Next.js app (App Router, wagmi/viem) on Cloudflare Workers via OpenNext, including the credit API |
| `services/keeper/` | Keeper cron Worker and its SQLite Durable Object log |
| `services/sandbox/` | Sandbox Worker, Durable Objects, and one Cloudflare Container (anvil) per session |
| `checks/` | Fork harness, keeper, credit API, sandbox, Playwright UI, mainnet, public reachability |
| `config/` | X Layer addresses, deployment schema, session names, generated ABIs |
| `data/replays/` | Replay files and their provenance |
| `okx-ai/` | OKX AI listing files |
| `deploy/` | Deploy and source-verification scripts |

## License

MIT. See [LICENSE](LICENSE). A file with its own SPDX header keeps that license.
