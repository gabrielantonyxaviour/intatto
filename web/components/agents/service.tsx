"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronDownIcon } from "lucide-react"
import { explorerTx } from "@intatto/config/xlayer"
import { useIntatto } from "@/lib/chain"
import { AddressDisplay } from "@/components/ui/web3"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EndpointList, ParameterList } from "./endpoints"
import { TryIt } from "./try-it"
import { ChainNotices } from "./notices"
import { CopyButton } from "./copy-button"
import {
  A2MCP_SUMMARY,
  curlFor,
  KEEPER_IDENTITY,
  DEMO_WALLET,
  LISTING_STATUS,
  PAYMENT_NOTE,
  REGISTRATION_TX,
  PRICE_LABEL,
  publicEndpointUrl,
  readCalls,
  recordCall,
  SERVICE_DESCRIPTION,
  SERVICE_DOMAIN,
  SERVICE_NAME,
  type CallLog,
} from "./content"

type Client = "curl" | "okx" | null

export function CreditService() {
  const { deployment } = useIntatto()
  const [calls, setCalls] = useState<CallLog[]>([])
  const [client, setClient] = useState<Client>(null)

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

      <header className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        <div className="grid gap-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{SERVICE_NAME}</h1>
            <Badge variant="outline">v1</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{SERVICE_DESCRIPTION}</p>
          <p className="font-mono text-sm break-all">{SERVICE_DOMAIN}</p>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline">
                  Try with
                  <ChevronDownIcon aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => setClient("curl")}>curl</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setClient("okx")}>OKX AI agents via A2MCP</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <CopyButton value={publicEndpointUrl("/api/credit")} label="Copy service URL" />
          </div>
          <p className="text-sm">
            <span className="font-medium">{PRICE_LABEL}</span> per call. {PAYMENT_NOTE}.
          </p>
          <p className="text-sm">
            {LISTING_STATUS}{" "}
            <a
              href={explorerTx(REGISTRATION_TX)}
              target="_blank"
              rel="noreferrer noopener"
              className="font-mono break-all underline underline-offset-4"
            >
              {REGISTRATION_TX}
            </a>
          </p>
        </div>
        <dl className="grid gap-3 rounded-lg border p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Resources</dt>
            <dd className="font-medium">2</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-muted-foreground">Tags</dt>
            <dd className="flex flex-wrap gap-1">
              <Badge variant="outline">credit</Badge>
              <Badge variant="outline">health</Badge>
              <Badge variant="outline">session</Badge>
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-muted-foreground">Addresses</dt>
            <dd className="grid gap-1">
              {deployment?.keeper ? <AddressDisplay address={deployment.keeper} chars={6} /> : <span>No keeper yet</span>}
              <Link href="/risk" className="underline underline-offset-4">
                see every keeper post on the Risk console
              </Link>
              <span className="text-muted-foreground">Pay-to: none while the call is free.</span>
            </dd>
          </div>
        </dl>
      </header>

      {client === "curl" ? (
        <div className="grid gap-2 rounded-lg border p-3">
          <p className="text-sm font-medium">curl</p>
          <pre className="max-w-full overflow-x-auto font-mono text-xs">{example}</pre>
          <CopyButton value={example} label="Copy example curl" />
        </div>
      ) : null}
      {client === "okx" ? (
        <div className="grid gap-2 rounded-lg border p-3 text-sm">
          <p className="font-medium">OKX AI agents via A2MCP</p>
          <p className="text-muted-foreground">{A2MCP_SUMMARY}</p>
          <p>{KEEPER_IDENTITY}.</p>
          <p>
            {LISTING_STATUS}{" "}
            <a href={explorerTx(REGISTRATION_TX)} target="_blank" rel="noreferrer noopener" className="underline underline-offset-4">
              registration tx
            </a>
          </p>
        </div>
      ) : null}

      <ChainNotices />
      <Usage calls={calls} />
      <EndpointList />
      <ParameterList />
      <TryIt onCall={(entry) => setCalls(recordCall(entry))} />
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
