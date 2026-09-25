# One Intatto sandbox chain: anvil forked from X Layer mainnet at the snapshot's pinned block, with the snapshot
# (Intatto deployed, lender and gap reserve seeded, first keeper posts) loaded. Cloudflare Containers run
# linux/amd64; wrangler builds for that platform. Rebuild the snapshot first: scripts/build-snapshot.ts.
FROM ghcr.io/foundry-rs/foundry:v1.7.1

COPY --chmod=755 entrypoint.sh /usr/local/bin/sandbox-entrypoint
COPY snapshot/meta.json snapshot/state.json /snapshot/

ENV UPSTREAM_RPC=https://xlayerrpc.okx.com
EXPOSE 8545
ENTRYPOINT ["/usr/local/bin/sandbox-entrypoint"]
