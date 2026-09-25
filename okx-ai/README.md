# Intatto credit and health (OKX AI A2MCP service)

Status: **draft**. Nothing here has been registered or submitted to OKX AI. Registering needs Gabriel's
confirmation. The listing definition is in [`credit-service.json`](./credit-service.json).

The service reports one wallet's Intatto loan on X Layer: collateral, debt, loan-to-value, health factor,
the USDG it can borrow right now, and how far the token price can fall before liquidation. Every value comes
from the Intatto contracts (`MarketLens.account`, `market` and `vault`), all read at one block.

- Endpoint: `GET https://intatto.larinova.com/api/credit`
- Health: `GET https://intatto.larinova.com/api/credit/health[?network=mainnet|sandbox][&session=<id>]` returns `{ ok, network, block }`. It is always free.
- Price: `0` (free). Paid mode exists but is off. See [Paid mode](#paid-mode-x402).

## Parameters

| Name | Required | Type | Values |
|---|---|---|---|
| `wallet` | yes | string | `0x` + 40 hex characters, all lowercase or EIP-55 checksummed |
| `market` | yes | string | `NVDAx` or `SPYx` |
| `network` | no | string | `mainnet` (default, X Layer chain 196) or `sandbox` |
| `session` | no | string | Sandbox session id (`[A-Za-z0-9_-]{1,64}`), only with `network=sandbox` |

## Example

```bash
curl -s 'https://intatto.larinova.com/api/credit?wallet=0xBc9f5CE82d10813AE411ffFc5315E7907E298755&market=NVDAx'
```

Until Intatto is deployed on mainnet, that call answers `503 {"error":"Intatto is not deployed on mainnet yet","code":"NOT_DEPLOYED"}`.
To read a sandbox fork, add `&network=sandbox&session=<id>`, where `<id>` comes from the Intatto sandbox.

The response below was produced by the route on a fork of X Layer at block 71,559,930. A burner deposited
4 NVDAx and borrowed at 30% LTV in an EXTENDED session:

```json
{
  "service": "intatto-credit",
  "version": "1",
  "network": "sandbox",
  "chainId": 1960196,
  "block": 71559930,
  "wallet": "0xBc9f5CE82d10813AE411ffFc5315E7907E298755",
  "market": "NVDAx",
  "session": { "state": "EXTENDED", "maxNewBorrowLtvBps": 4000, "periodChangedAt": "2026-09-25T08:00:00.000Z", "postedAt": "2026-09-25T09:35:48.000Z" },
  "price": { "usdPerToken": "226.187976", "fetchedAt": "2026-09-25T09:35:48.000Z", "sourceTimestamp": null, "source": "keeper relay of the xStocks issuer's indicative quote (trusted relayer, bounded onchain)" },
  "guards": { "fresh": true, "inBand": true, "pegOk": true, "corporateActionPaused": false, "issuerPaused": false },
  "position": { "collateralTokens": "3.999999999999999999", "collateralWrapperShares": "3.993206769417839329", "valueUsdg": "904.751903", "debtUsdg": "271.42557", "ltvBps": 2999, "healthFactor": "2.166666673850956636" },
  "capacity": { "borrowableNowUsdg": "90.475191", "limitBps": 4000 },
  "liquidation": { "thresholdBps": 6500, "liquidationPriceUsd": "104.394450000000000026", "gapToLiquidationBps": 5384, "liquidatableNow": false },
  "asOf": "2026-09-25T09:35:54.000Z"
}
```

## Response fields

Decimal values are strings, and each field name carries its unit (`Usdg`, `Usd`, `Tokens`, `Bps`).

| Field | Meaning |
|---|---|
| `service`, `version` | Always `"intatto-credit"` and `"1"` |
| `network`, `chainId`, `block` | Where the values were read. Every value comes from this one block |
| `wallet`, `market` | Echo of the query. The wallet is checksummed |
| `session.state` | `UNKNOWN`, `OPEN`, `EXTENDED`, `CLOSED`, `HALTED` or `CORPORATE_ACTION`. A keeper post older than 30 minutes reads as `UNKNOWN` |
| `session.maxNewBorrowLtvBps` | The highest LTV a new borrow may reach now. During `CLOSED` it falls toward 20% |
| `session.periodChangedAt`, `session.postedAt` | When the issuer's trading period began, and the keeper's last session post. ISO 8601, or null before the first post |
| `price.usdPerToken`, `price.fetchedAt` | The relayed price of one whole token, and when the keeper fetched it. `fetchedAt` shows the keeper is live, not that the market is fresh |
| `price.sourceTimestamp` | Always null, because the issuer's quote has no source timestamp |
| `guards.*` | `fresh` (price post within its liveness limit), `inBand` (inside the band around the pool's 30-minute TWAP), `pegOk` (USDG within 1% of $1), `corporateActionPaused`, `issuerPaused` |
| `position.collateralTokens`, `position.collateralWrapperShares` | Collateral as underlying tokens and as the issuer's ERC-4626 wrapper shares |
| `position.valueUsdg`, `position.debtUsdg` | Collateral value at the relayed price, and debt including accrued interest |
| `position.ltvBps` | Debt ÷ value, in bps (rounded down). Null when there is debt and no collateral value |
| `position.healthFactor` | value × threshold ÷ debt. Below 1 the position is liquidatable. Null when there is no debt |
| `capacity.borrowableNowUsdg` | USDG one borrow can take right now: the smallest of the session limit headroom, the ticker's debt cap headroom and idle vault liquidity. It is 0 when a borrow would be refused |
| `capacity.limitBps` | The session's new-borrow LTV limit |
| `capacity.reason` | Present only when a borrow would be refused. It names the contract error `CollateralMarket.borrow` would revert with, checked in the contract's order: `IssuerPaused`, `UnknownSession`, `SessionLimit`, `StalePrice`, `PriceOutOfBand`, `CorporateActionPending`, `TickerCapReached`, `UsdgOffPeg`, `InsufficientLiquidity` |
| `liquidation.thresholdBps` | The LTV above which liquidation is allowed. It does not change with the session |
| `liquidation.liquidationPriceUsd` | The token price at which the position reaches the threshold. Null when there is no debt |
| `liquidation.gapToLiquidationBps` | How far the token price can fall before the position becomes liquidatable, in bps of today's price (rounded down). 0 when it is already liquidatable. Null when there is no debt |
| `liquidation.liquidatableNow` | `CollateralMarket.isLiquidatable(wallet)` |
| `asOf` | The block's timestamp, ISO 8601 |

## Errors

Every error is `{ "error": string, "code": string }` and never includes a stack trace or raw RPC output.

| HTTP | code |
|---|---|
| 400 | `INVALID_WALLET`, `INVALID_MARKET`, `INVALID_NETWORK`, `INVALID_SESSION`, `SESSION_REQUIRED` |
| 402 | `PAYMENT_REQUIRED`, `PAYMENT_NOT_VERIFIED` (paid mode only) |
| 404 | `MARKET_NOT_LISTED`, `SESSION_NOT_FOUND` |
| 503 | `NOT_DEPLOYED`, `DEPLOYMENT_INVALID`, `CHAIN_UNAVAILABLE`, `CHAIN_MISMATCH`, `SANDBOX_UNAVAILABLE`, `PAYWALL_MISCONFIGURED` |

## Configuration (server env)

| Variable | Use |
|---|---|
| `LIVE_DEPLOYMENT` or `NEXT_PUBLIC_LIVE_DEPLOYMENT` | Mainnet deployment JSON (`config/deployments.ts` schema). If neither is set, requests answer 503 `NOT_DEPLOYED` |
| `XLAYER_RPC_URL` | Optional primary X Layer RPC. The public fallbacks from `config/xlayer.ts` follow it |
| `SANDBOX_API_URL` | Sandbox session API. Default `https://intatto-rpc.larinova.com` (`GET /session/<id>` returns `{ rpcUrl, chainId, deployment }`) |
| `CREDIT_SANDBOX_RPC`, `CREDIT_SANDBOX_DEPLOYMENT` | A local fork for `network=sandbox` without a session, as the check uses |
| `CREDIT_PAYMENT_MODE` | `free` (default) or `paid` |
| `CREDIT_PAY_TO` | Operator address that receives payments. Required in paid mode |
| `CREDIT_PRICE_USDG_UNITS` | Price in USDG minimal units (6 decimals). Default `10000`, which is 0.01 USDG |

## Paid mode (x402)

When `CREDIT_PAYMENT_MODE=paid`, a valid request that carries no payment gets HTTP 402. The body is
`{error, code:"PAYMENT_REQUIRED"}`, and a `PAYMENT-REQUIRED` header holds base64 of this x402 v2 JSON:

```json
{"x402Version":2,"error":"Payment required","resource":{"url":"<the request URL>","description":"Intatto credit and health for one wallet: collateral, debt, LTV, USDG borrowable now and the price fall to liquidation, read from X Layer.","mimeType":"application/json"},"accepts":[{"scheme":"exact","network":"eip155:196","amount":"10000","asset":"0x4ae46a509f6b1d9056937ba4500cb143933d2dc8","payTo":"<CREDIT_PAY_TO>","maxTimeoutSeconds":300,"extra":{"name":"Global Dollar","version":"1"}}]}
```

- The OKX Payment SDK (`@okxweb3/x402-core`, `@okxweb3/x402-evm`) cannot build this challenge without OKX
  seller API keys, because `x402ResourceServer.initialize()` must first fetch the facilitator's supported
  kinds. So `web/lib/credit/paywall.ts` builds it by hand in the SDK's exact shape and key order. With the
  same inputs, its header is byte-identical to what `x402HTTPResourceServer` returns. The SDK's buyer client
  (`x402HTTPClient` with `ExactEvmScheme`) parses it and signs an EIP-3009 payload for it.
- USDG supports EIP-3009. `extra` is its EIP-712 domain (`Global Dollar`, version `1`), read on chain 196.
- Verification and settlement are **not wired**. A request that carries a `PAYMENT-SIGNATURE` still gets 402
  `PAYMENT_NOT_VERIFIED`, and nothing is charged. Production stays free until a real paid settlement has
  been proven end to end.
- Invalid parameters answer 400 before any challenge, so no caller pays for a malformed request.

## Registering (not done)

On OKX AI, an A2MCP ASP is registered through Onchain OS by giving the service name, description, price and
endpoint. Values for each are in `credit-service.json`. Before registering:

1. Deploy Intatto on mainnet and set `LIVE_DEPLOYMENT`, so the curl above answers 200.
2. OKX's self-check sends a bare call (`curl -i -X POST <endpoint>`) and expects 200 from a free endpoint.
   This endpoint is GET-only and needs `wallet` and `market`, so a bare call answers 400 (or 405 for POST).
   Confirm with the reviewer that the registered endpoint may carry query parameters.
3. Get Gabriel's confirmation, then register. Do not register or submit anything before that.

## Proof

- `npx tsx checks/credit-api.ts --mode sandbox` forks X Layer and opens a real position. It compares every
  field of the response with reads taken straight from the market, relay, session risk, cap and vault
  contracts, without MarketLens. It also checks the refusal reason and the borrowable edge against simulated
  `borrow` calls, and exercises the session API path and every error code.
- `npx tsx checks/credit-api.ts --mode paid --challenge-only` decodes the 402 challenge and checks it against
  the SDK's `PaymentRequired` schema. It pays and settles nothing.
