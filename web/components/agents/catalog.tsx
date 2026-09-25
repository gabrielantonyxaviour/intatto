"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useIntatto } from "@/lib/chain"
import { AddressDisplay } from "@/components/ui/web3"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  AGENT_LABEL,
  KEEPER_IDENTITY,
  KEEPER_ROLE,
  LISTING_STATUS,
  PRICE_LABEL,
  SERVICE_DESCRIPTION,
  SERVICE_DOMAIN,
  SERVICE_NAME,
} from "./content"
import { ChainNotices } from "./notices"

export function AgentsCatalog() {
  const { deployment } = useIntatto()
  const [query, setQuery] = useState("")
  const [adding, setAdding] = useState(false)
  const needle = query.trim().toLowerCase()

  const showService = useMemo(() => {
    if (!needle) return true
    return [SERVICE_NAME, SERVICE_DESCRIPTION, SERVICE_DOMAIN, "credit", "health", "borrow"].some((part) =>
      part.toLowerCase().includes(needle),
    )
  }, [needle])

  const showKeeper = useMemo(() => {
    if (!needle) return true
    const blob = `keeper ${KEEPER_ROLE} ${KEEPER_IDENTITY} ${deployment?.keeper ?? ""}`
    return blob.toLowerCase().includes(needle)
  }, [needle, deployment?.keeper])

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Services an agent can call, and the keeper that posts Intatto&apos;s onchain state.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setAdding((v) => !v)}>
          Add your API
        </Button>
      </header>

      {adding ? (
        <Alert>
          <AlertTitle>Intatto lists its own service</AlertTitle>
          <AlertDescription>
            Outside APIs are not added here. The credit service is the one call an agent can make. {LISTING_STATUS}.
          </AlertDescription>
        </Alert>
      ) : null}

      <ChainNotices />

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Try: credit, health, borrow limit, keeper"
        aria-label="Search services"
      />

      {!showService && !showKeeper ? (
        <p className="text-sm text-muted-foreground">No service matches that. Try credit, health, or keeper.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {showService ? <ServiceCard /> : null}
          {showKeeper ? <KeeperCard keeper={deployment?.keeper ?? null} /> : null}
        </div>
      )}
    </div>
  )
}

function ServiceCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Link href="/agents/credit" className="hover:underline">
            {SERVICE_NAME}
          </Link>
        </CardTitle>
        <CardDescription>{SERVICE_DESCRIPTION}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="font-mono text-sm break-all">{SERVICE_DOMAIN}</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="success-light">{PRICE_LABEL}</Badge>
            <Badge variant="outline">{AGENT_LABEL}</Badge>
          </span>
          <Button asChild>
            <Link href="/agents/credit">Try it</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function KeeperCard({ keeper }: { keeper: string | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Keeper</CardTitle>
        <CardDescription>{KEEPER_ROLE}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {keeper ? <AddressDisplay address={keeper} chars={6} /> : (
          <p className="text-sm text-muted-foreground">The keeper address appears once Intatto is deployed.</p>
        )}
        <Badge variant="warning-light">{KEEPER_IDENTITY}</Badge>
        <Badge variant="outline">{AGENT_LABEL}</Badge>
      </CardContent>
    </Card>
  )
}
