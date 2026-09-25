"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { explorerTx } from "@intatto/config/xlayer"
import { useIntatto } from "@/lib/chain"
import { AddressDisplay } from "@/components/ui/web3"
import { Badge } from "@/components/ui/badge"
import { DefinitionPopover, EvidenceSheet } from "@/components/ui/ix"
import { EndpointList, ParameterList } from "./endpoints"
import { TryIt } from "./try-it"
import { ChainNotices } from "./notices"
import {
  A2MCP_SUMMARY,
  curlFor,
  DEMO_WALLET,
  LISTING_STATUS,
  PAYMENT_NOTE,
  PRICE_LABEL,
  REGISTRATION_TX,
  publicEndpointUrl,
  readCalls,
  recordCall,
  SERVICE_DESCRIPTION,
  SERVICE_NAME,
  VERIFIED_ON,
  type CallLog,
} from "./content"

export function CreditService() {
  const { deployment } = useIntatto()
  const [calls, setCalls] = useState<CallLog[]>([])

  useEffect(() => {
    setCalls(readCalls())
  }, [])

  const example = curlFor(
    `${publicEndpointUrl("/api/credit")}?wallet=${DEMO_WALLET}&market=NVDAx&network=mainnet`,
  )

  return (
    <div className="grid min-w-0 gap-6">
      <p className="text-sm text-muted-foreground">
        <Link href="/agents" className="hover:underline">
          Agents
        </Link>
        <span> / {SERVICE_NAME}</span>
      </p>

      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{SERVICE_NAME}</h1>
          <Badge variant="outline">v1</Badge>
        </div>
        <p className="max-w-xl text-sm text-muted-foreground">{SERVICE_DESCRIPTION}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="success-light">{PRICE_LABEL}</Badge>
          <span>No paid receipt.</span>
          <DefinitionPopover term="Payment details" side="bottom" source={VERIFIED_ON}>
            <p>{PAYMENT_NOTE}.</p>
            <p>This call is free. Opening this note is not a payment, and no paid receipt exists.</p>
          </DefinitionPopover>
        </div>
        <p className="text-sm">{LISTING_STATUS}</p>
        <p className="text-sm text-muted-foreground">{VERIFIED_ON}. Registration is not listing approval.</p>
        <div className="flex flex-wrap items-center gap-3">
          <EvidenceSheet
            title="Agent details"
            triggerLabel="Agent details"
            summary="Keeper address and the OKX registration transaction from the listing record"
            asOf={VERIFIED_ON}
            state="ready"
            evidenceFor="agent"
            testId="agent-details"
          >
            <AgentRecord keeper={deployment?.keeper} />
          </EvidenceSheet>
          <Link href="/risk" className="text-sm underline underline-offset-4">
            see every keeper post on the Risk console
          </Link>
        </div>
      </header>

      <ChainNotices />
      <TryIt onCall={(entry) => setCalls(recordCall(entry))} />
      <Usage calls={calls} />

      <details className="min-w-0 rounded-lg border">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">API reference</summary>
        <div className="grid min-w-0 gap-6 border-t p-4">
          <EndpointList />
          <ParameterList />
          <div className="grid min-w-0 gap-2">
            <p className="text-sm font-medium">Example</p>
            <pre className="max-w-full overflow-x-auto font-mono text-xs">{example}</pre>
          </div>
          <p className="text-sm text-muted-foreground">{A2MCP_SUMMARY}</p>
        </div>
      </details>
    </div>
  )
}

function AgentRecord({ keeper }: { keeper?: string }) {
  return (
    <div className="grid gap-3 text-sm">
      <div className="grid gap-1">
        <span className="text-muted-foreground">Keeper</span>
        {keeper ? <AddressDisplay address={keeper} chars={6} /> : <span>No keeper yet</span>}
      </div>
      <div className="grid gap-1">
        <span className="text-muted-foreground">Registration transaction</span>
        <a
          href={explorerTx(REGISTRATION_TX)}
          target="_blank"
          rel="noreferrer noopener"
          className="font-mono break-all underline underline-offset-4"
        >
          {REGISTRATION_TX}
        </a>
      </div>
      <p>Pay-to: none while the call is free.</p>
    </div>
  )
}

function Usage({ calls }: { calls: CallLog[] }) {
  return (
    <section className="grid gap-2">
      <h2 className="text-lg font-medium">Calls from this page</h2>
      <p className="text-sm text-muted-foreground">
        Stored in this browser only. This is not a count of calls on the network.
      </p>
      <p className="text-3xl font-semibold" data-testid="credit-call-count">
        {calls.length}
      </p>
      {calls.length === 0 ? (
        <p className="text-sm text-muted-foreground">No calls from this page yet.</p>
      ) : (
        <ul className="grid gap-1 text-sm">
          {calls.slice(0, 5).map((call) => (
            <li key={`${call.at}-${call.wallet}`} className="font-mono break-all text-muted-foreground">
              {call.at} · {call.market} · {call.wallet}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
