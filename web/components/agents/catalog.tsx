"use client"

import Link from "next/link"
import { ArrowUpRightIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { KeeperAddress } from "./keeper-address"
import { ApiExample } from "./api-example"
import { TryIt } from "./try-it"
import { ChainNotices } from "./notices"
import { KEEPER_IDENTITY, KEEPER_ROLE, LISTING_STATUS, recordCall, VERIFIED_ON } from "./content"

export function AgentsCatalog() {
  return (
    <div className="mx-auto grid w-full max-w-5xl min-w-0 gap-10">
      <header className="grid gap-2">
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Build on Intatto</p>
        <h1 className="text-3xl font-semibold tracking-tight">Developers</h1>
        <p className="text-muted-foreground">Read Intatto from your agent or app.</p>
      </header>
      <ChainNotices />
      <section className="grid min-w-0 gap-6" aria-labelledby="credit-api-title">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="credit-api-title" className="text-xl font-semibold tracking-tight">Credit and health API</h2>
            <Badge variant="secondary">Free</Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Borrowing capacity, market session and liquidation distance in one read-only call.
          </p>
          <Badge variant="outline" className="max-w-full whitespace-normal" title={`${VERIFIED_ON}. Registration is not listing approval.`}>
            {LISTING_STATUS}
          </Badge>
        </div>
        <ApiExample />
        <div className="min-w-0 rounded-xl border p-4 sm:p-6">
          <TryIt onCall={(entry) => { recordCall(entry) }} />
        </div>
        <Link href="/agents/credit" className="inline-flex items-center gap-1 justify-self-start text-sm underline underline-offset-4">
          Open full reference <ArrowUpRightIcon aria-hidden className="size-3.5" />
        </Link>
      </section>
      <section className="grid gap-4 border-t pt-8" aria-labelledby="keeper-title">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="keeper-title" className="text-xl font-semibold tracking-tight">Keeper</h2>
          <Badge variant="outline">{KEEPER_IDENTITY}</Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">{KEEPER_ROLE}</p>
        <KeeperAddress />
        <Link href="/risk#keeper" className="justify-self-start text-sm underline underline-offset-4">View keeper log</Link>
      </section>
    </div>
  )
}
