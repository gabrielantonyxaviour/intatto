#!/usr/bin/env bash
# X Layer mainnet deployment of Intatto by the operator (CLOSE_GUARD_OPERATOR_PK from the vault; never printed).
# 1) forge script DeployMainnet (deploys, wires, seeds the gap reserve with 0.5 USDG)
# 2) writes deployments/xlayer-mainnet.json in the shared schema
# 3) submits every contract for source verification on OKLink (X Layer explorer)
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
: "${CLOSE_GUARD_OPERATOR_PK:?operator key missing (inject from the vault)}"
RPC="${XLAYER_RPC_URL:-https://xlayerrpc.okx.com}"
cd "$REPO/contracts"
test "$(cast chain-id --rpc-url "$RPC")" = "196" || { echo "not X Layer mainnet"; exit 1; }
if [ -f "$REPO/deployments/xlayer-mainnet.json" ] && [ "${FORCE_REDEPLOY:-0}" != "1" ]; then
  echo "deployments/xlayer-mainnet.json exists; set FORCE_REDEPLOY=1 to deploy again"; exit 1
fi
forge script script/DeployMainnet.s.sol:DeployMainnet --rpc-url "$RPC" --broadcast --slow \
  --private-key "$CLOSE_GUARD_OPERATOR_PK" 2>&1 | grep -vi "private" | tail -20
cd "$REPO"
npx tsx deploy/write-deployment.ts deployments/xlayer-mainnet.flat.json deployments/xlayer-mainnet.json
rm -f deployments/xlayer-mainnet.flat.json
bash deploy/verify-sources.sh deployments/xlayer-mainnet.json || echo "source verification did not complete; rerun deploy/verify-sources.sh"
