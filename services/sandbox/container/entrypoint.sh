#!/bin/sh
# Starts anvil for one sandbox session from the baked snapshot. meta.json (pretty-printed by the snapshot
# builder) supplies the fork block and chain id; UPSTREAM_RPC is the X Layer mainnet RPC to fork from.
set -eu

META=/snapshot/meta.json
read_number() { sed -n "s/^  \"$1\": \([0-9][0-9]*\),\{0,1\}\$/\1/p" "$META" | head -n 1; }

FORK_BLOCK="$(read_number forkBlock)"
CHAIN_ID="$(read_number chainId)"
if [ -z "$FORK_BLOCK" ] || [ -z "$CHAIN_ID" ]; then
  echo "sandbox: $META has no forkBlock/chainId" >&2
  exit 1
fi

exec anvil \
  --fork-url "${UPSTREAM_RPC:-https://xlayerrpc.okx.com}" \
  --fork-block-number "$FORK_BLOCK" \
  --chain-id "$CHAIN_ID" \
  --network optimism \
  --load-state /snapshot/state.json \
  --host 0.0.0.0 \
  --port 8545 \
  --retries 8 \
  --timeout 60000
