"use client"

import Link from "next/link"
import { useIntatto } from "@/lib/chain"
import { AddressDisplay } from "@/components/ui/web3"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  KEEPER_IDENTITY,
  KEEPER_ROLE,
  LISTING_STATUS,
  PRICE_LABEL,
  SERVICE_DESCRIPTION,
  SERVICE_DOMAIN,
  SERVICE_NAME,
  VERIFIED_ON,
} from "./content"
import { ChainNotices } from "./notices"

export function AgentsCatalog() {
  const { deployment } = useIntatto()

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Ask what a wallet can borrow, or see the keeper that posts Intatto&apos;s onchain state.
        </p>
      </header>

      <ChainNotices />

      <div className="grid gap-4 md:grid-cols-2">
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
            <p className="text-sm">
              {LISTING_STATUS}. {PRICE_LABEL}. {VERIFIED_ON}.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="success-light">{PRICE_LABEL}</Badge>
              <Button asChild>
                <Link href="/agents/credit">Try it</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Keeper</CardTitle>
            <CardDescription>{KEEPER_ROLE}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {deployment?.keeper ? (
              <AddressDisplay address={deployment.keeper} chars={6} />
            ) : (
              <p className="text-sm text-muted-foreground">The keeper address appears once Intatto is deployed.</p>
            )}
            <Badge variant="outline">{KEEPER_IDENTITY}</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
