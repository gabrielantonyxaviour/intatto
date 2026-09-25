#!/usr/bin/env bash
# Deploys the hosted sandbox (Worker + Durable Objects + one Cloudflare Container per session) to intatto-rpc.larinova.com.
# Builds the linux/amd64 container image locally with Docker (the committed snapshot is baked in).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO/services/sandbox"
test -f container/snapshot/state.json || { echo "no snapshot: run npx tsx services/sandbox/scripts/build-snapshot.ts"; exit 1; }
node -e '
const fs=require("fs"); const src=fs.readFileSync("wrangler.jsonc","utf8").replace(/^\s*\/\/.*$/mg,"");
const c=JSON.parse(src); c.routes=[{pattern:"intatto-rpc.larinova.com",custom_domain:true}];
fs.writeFileSync("wrangler.deploy.json", JSON.stringify(c,null,2));'
trap 'rm -f wrangler.deploy.json' EXIT
npx wrangler deploy --config wrangler.deploy.json
