#!/usr/bin/env bash
# Submits every Intatto contract in a deployment file for source verification on OKLink (X Layer).
# Usage: deploy/verify-sources.sh deployments/xlayer-mainnet.json   (OKLINK_API_KEY optional)
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
FILE="${1:?deployment json}"
URL="https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER"
RPC="${XLAYER_RPC_URL:-https://xlayerrpc.okx.com}"
KEY="${OKLINK_API_KEY:-none}"
j() { node -e "const d=require('$REPO/$FILE'); const v=$1; process.stdout.write(String(v))"; }
USDG=$(j d.usdg); KEEPER=$(j d.keeper); VAULT=$(j d.vault); RESERVE=$(j d.gapReserve); SESSION=$(j d.sessionRisk)
CAPS=$(j d.depthCaps); LIQ=$(j d.liquidator); RATES=$(j d.interestRateModel); LENS=$(j d.lens)
MARKET=$(j d.markets[0].market); RELAY=$(j d.markets[0].priceRelay); GUARD=$(j d.markets[0].corporateActionGuard)
TOKEN=$(j d.markets[0].token); WRAPPER=$(j d.markets[0].wrapper); POOL=$(j d.markets[0].pool)
FEED=0x385C6bDDE06b0E438319bF4ddBfFe51C521ABf3D
cd "$REPO/contracts"
v() { # address contract [constructor-args-hex]
  echo "verify $2 at $1"
  forge verify-contract "$1" "$2" --verifier oklink --verifier-url "$URL" --etherscan-api-key "$KEY" \
    --chain-id 196 --rpc-url "$RPC" ${3:+--constructor-args "$3"} --watch || echo "  (not verified: $2)"
}
v "$VAULT" src/LendingVault.sol:LendingVault "$(cast abi-encode 'c(address)' "$USDG")"
v "$RESERVE" src/GapReserve.sol:GapReserve "$(cast abi-encode 'c(address,address)' "$USDG" "$VAULT")"
v "$RATES" src/InterestRateModel.sol:InterestRateModel
v "$SESSION" src/SessionRiskController.sol:SessionRiskController "$(cast abi-encode 'c(address)' "$KEEPER")"
v "$CAPS" src/DepthCapRegistry.sol:DepthCapRegistry "$(cast abi-encode 'c(address)' "$KEEPER")"
v "$LIQ" src/BoundedLiquidator.sol:BoundedLiquidator "$(cast abi-encode 'c(address,address)' "$SESSION" "$CAPS")"
v "$LENS" src/MarketLens.sol:MarketLens
v "$RELAY" src/PriceRelayAdapter.sol:PriceRelayAdapter "$(cast abi-encode 'c(address,address,address,address,address,address)' "$KEEPER" "$WRAPPER" "$POOL" "$USDG" "$FEED" "$SESSION")"
v "$GUARD" src/CorporateActionGuard.sol:CorporateActionGuard "$(cast abi-encode 'c(address,address,address)' "$KEEPER" "$TOKEN" "$RELAY")"
v "$MARKET" src/CollateralMarket.sol:CollateralMarket "$(cast abi-encode 'c((string,address,address,address,address,address,address,address,address,address,address))' "(NVDAx,$TOKEN,$WRAPPER,$USDG,$VAULT,$SESSION,$RELAY,$GUARD,$CAPS,$RESERVE,$RATES)")"
