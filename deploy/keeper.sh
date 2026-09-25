#!/usr/bin/env bash
# Deploys the keeper cron Worker against X Layer mainnet (after deploy/mainnet.sh wrote deployments/xlayer-mainnet.json).
# The operator key goes in as a Worker secret from the environment (vault), never printed or written to disk.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
: "${CLOSE_GUARD_OPERATOR_PK:?operator key missing (inject from the vault)}"
test -f "$REPO/deployments/xlayer-mainnet.json" || { echo "no mainnet deployment yet"; exit 1; }
LIVE="$(tr -d '\n ' < "$REPO/deployments/xlayer-mainnet.json")"
cd "$REPO/services/keeper"
node -e '
const fs=require("fs"); const src=fs.readFileSync("wrangler.jsonc","utf8").replace(/^\s*\/\/.*$/mg,"");
const c=JSON.parse(src); c.routes=[{pattern:"intatto-keeper.larinova.com",custom_domain:true}];
c.vars={...c.vars, LIVE_DEPLOYMENT: process.argv[1]}; fs.writeFileSync("wrangler.deploy.json", JSON.stringify(c,null,2));
' "$LIVE"
trap 'rm -f wrangler.deploy.json' EXIT
npx wrangler deploy --config wrangler.deploy.json
printf '%s' "$CLOSE_GUARD_OPERATOR_PK" | npx wrangler secret put OPERATOR_PK --config wrangler.deploy.json >/dev/null
if [ -n "${RECEIPT_TOKEN:-}" ]; then printf '%s' "$RECEIPT_TOKEN" | npx wrangler secret put RECEIPT_TOKEN --config wrangler.deploy.json >/dev/null; fi
echo "keeper deployed; OPERATOR_PK secret set${RECEIPT_TOKEN:+; RECEIPT_TOKEN set}"
