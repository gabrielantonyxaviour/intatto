"use client"

/** Where the console's figures come from, and the contract addresses, each one click from the header. */
import type { Deployment, MarketDeployment } from "@intatto/config/deployments"
import { AddressDisplay } from "@/components/ui/web3"
import { EvidenceSheet } from "@/components/ui/ix"
import { useIntatto } from "@/lib/chain"
import { KeeperEvidence } from "./keeper-log"
import { useRisk } from "./risk-data"
import { blockNo, utc } from "./format"

// Must stay a literal `process.env.NEXT_PUBLIC_…` read so Next inlines it at build time.
const KEEPER_URL = process.env.NEXT_PUBLIC_KEEPER_LOG_URL?.trim() || null

function keeperHost(): string | null {
  if (!KEEPER_URL) return null
  try {
    return new URL(KEEPER_URL).host
  } catch {
    return null
  }
}

function Addr({ label, address, note }: { label: string; address: string; note: string }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-sm text-muted-foreground">
        {label} <span className="text-xs">({note})</span>
      </dt>
      <dd className="min-w-0">
        <AddressDisplay address={address} explorer />
      </dd>
    </div>
  )
}

export function SourceSheets({ market, keeperOpen, onKeeperOpenChange }: { market: MarketDeployment; keeperOpen: boolean; onKeeperOpenChange: (open: boolean) => void }) {
  const { mode } = useIntatto()
  const { deployment, params, latestBlock, now } = useRisk()
  const host = keeperHost()
  const asOf = latestBlock !== null ? `Lens and vault snapshot ${blockNo(latestBlock)}, chain time ${utc(now)}` : undefined
  const sandbox = mode === "sandbox"
  return (
    <div className="flex flex-wrap gap-2">
      <EvidenceSheet
        title="Data sources"
        triggerLabel="Data sources"
        summary={sandbox ? "Reads come from this sandbox session. Prices are simulated pool posts, not the live issuer quote." : "Contract state is read in this browser from X Layer. Event history uses the log cache, then a direct read."}
        asOf={asOf}
        state="ready"
        testId="risk-sources"
        evidenceFor="sources"
      >
        <div className="grid gap-3 text-sm text-muted-foreground">
          {sandbox ? (
            <p>Contract state (market lens, guards and positions) and event history are read directly from this sandbox session. Prices here are simulated keeper posts from the forked pool, not the live issuer quote. The live mainnet keeper service is not shown; this session&apos;s actions are on the sandbox ledger.</p>
          ) : (
            <p>
              Contract state (market lens, guards and positions) is read by your browser directly from X Layer. Event history comes through Intatto&apos;s log cache (/api/risk/logs: raw eth_getLogs results, cached, not modified), and falls back to a direct X Layer read when that route fails.
              {host ? ` The keeper's own log and last issuer read come from the keeper service at ${host} (/log and /status).` : ""}
            </p>
          )}
          <p>The lens and vault figures share one captured block. Loan reads and the event scan name their own blocks on those views. A missing read stays unknown; it is not filled with a previous default.</p>
        </div>
      </EvidenceSheet>
      <ContractsSheet deployment={deployment} market={market} keeper={params.data?.keeper} owner={params.data?.owner} />
      <KeeperEvidence open={keeperOpen} onOpenChange={onKeeperOpenChange} />
    </div>
  )
}

function ContractsSheet({
  deployment,
  market,
  keeper,
  owner,
}: {
  deployment: Deployment
  market: MarketDeployment
  keeper: string | null | undefined
  owner: string | null | undefined
}) {
  const rows: { label: string; address: string; note: string }[] = [
    { label: "Operator", address: owner || deployment.operator, note: owner ? "read onchain" : "deployment record" },
    { label: "Keeper", address: keeper || deployment.keeper, note: keeper ? "read onchain" : "deployment record" },
    { label: "Market", address: market.market, note: "deployment record" },
    { label: "Lens", address: deployment.lens, note: "deployment record" },
    { label: "Vault", address: deployment.vault, note: "deployment record" },
    { label: "USDG", address: deployment.usdg, note: "deployment record" },
    { label: "Gap reserve", address: deployment.gapReserve, note: "deployment record" },
    { label: "Session controller", address: deployment.sessionRisk, note: "deployment record" },
    { label: "Depth caps", address: deployment.depthCaps, note: "deployment record" },
    { label: "Liquidator", address: deployment.liquidator, note: "deployment record" },
    { label: "Interest model", address: deployment.interestRateModel, note: "deployment record" },
    { label: "Price relay", address: market.priceRelay, note: "deployment record" },
    { label: "Corporate-action guard", address: market.corporateActionGuard, note: "deployment record" },
    { label: "Underlying token", address: market.token, note: "deployment record" },
    { label: "Wrapper", address: market.wrapper, note: "deployment record" },
    { label: "Pool", address: market.pool, note: "deployment record" },
  ]
  if (deployment.chainlinkV10Adapter) rows.push({ label: "Chainlink v10 adapter", address: deployment.chainlinkV10Adapter, note: "deployed, not the live price source" })
  return (
    <EvidenceSheet
      title="Contracts"
      triggerLabel="Contracts"
      summary={`${market.symbol} addresses for this session. Role addresses say whether they were read onchain.`}
      state="ready"
      testId="risk-contracts"
      evidenceFor="contracts"
    >
      <dl className="grid gap-3">
        {rows.map((r) => (
          <Addr key={r.label} {...r} />
        ))}
      </dl>
    </EvidenceSheet>
  )
}
