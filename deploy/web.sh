#!/usr/bin/env bash
# Builds the committed web app (HEAD) in a clean worktree and deploys it to intatto.larinova.com.
# Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment (inject from the vault / .env.local).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${DEPLOY_WORKTREE:-$REPO/../.intatto-deploy-web}"
rm -rf "$WORK"; git -C "$REPO" worktree prune
git -C "$REPO" worktree add --detach "$WORK" HEAD >/dev/null
trap 'git -C "$REPO" worktree remove --force "$WORK" >/dev/null 2>&1 || true' EXIT
cd "$WORK"
pnpm install --prefer-offline --no-frozen-lockfile >/dev/null
LIVE=""
if [ -f "$REPO/deployments/xlayer-mainnet.json" ]; then LIVE="$(tr -d '\n' < "$REPO/deployments/xlayer-mainnet.json")"; fi
export NEXT_PUBLIC_LIVE_DEPLOYMENT="$LIVE"
export NEXT_PUBLIC_SANDBOX_API_URL="${NEXT_PUBLIC_SANDBOX_API_URL:-https://intatto-rpc.larinova.com}"
export NEXT_PUBLIC_KEEPER_LOG_URL="${NEXT_PUBLIC_KEEPER_LOG_URL:-https://intatto-keeper.larinova.com}"
export LIVE_DEPLOYMENT="$LIVE"
export SANDBOX_API_URL="$NEXT_PUBLIC_SANDBOX_API_URL"
pnpm -C web exec opennextjs-cloudflare build
# OpenNext inlines .env files it finds (including the monorepo root) into next-env.mjs: refuse to ship any vault name.
if grep -qE "_PK|API_TOKEN|API_KEY|PRIVATE" web/.open-next/cloudflare/next-env.mjs 2>/dev/null; then
  echo "refusing to deploy: secrets were inlined into web/.open-next/cloudflare/next-env.mjs"; exit 1
fi
cp "$REPO/deploy/wrangler.web.jsonc" web/wrangler.deploy.jsonc
cd web && npx wrangler deploy --config wrangler.deploy.jsonc \
  --var "LIVE_DEPLOYMENT:${LIVE:-}" --var "SANDBOX_API_URL:$SANDBOX_API_URL"
