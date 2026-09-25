"use client"

import { useMutation } from "@tanstack/react-query"
import { CircleAlertIcon, Loader2Icon, PlayIcon } from "lucide-react"
import { privateKeyToAccount } from "viem/accounts"
import { SANDBOX_CHAIN_ID } from "@intatto/config/xlayer"
import { sandboxSessionSchema, useIntatto, type SandboxSession } from "@/lib/chain"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { SandboxApiError, sandboxApi, type Health } from "./api"
import { START_METHOD } from "./copy"
import { CompactFacts, ProveForkLink, SessionDetailsSheet } from "./fork-identity"

/** POST /session, validated, then stored: every screen switches to the fork with the burner connected. */
export function useStartSession(base: string | null) {
  const { startSandbox } = useIntatto()
  return useMutation<SandboxSession, Error>({
    mutationKey: ["sandbox-start", base],
    mutationFn: async () => {
      if (!base) throw new Error("There is no sandbox service to start a session on.")
      const created = await sandboxApi.create(base)
      if (created.chainId !== SANDBOX_CHAIN_ID) {
        throw new SandboxApiError(0, "wrong_chain", `The service offered chain ${created.chainId}; a sandbox must use chain ${SANDBOX_CHAIN_ID}.`)
      }
      if (privateKeyToAccount(created.burnerKey as `0x${string}`).address.toLowerCase() !== created.burnerAddress.toLowerCase()) {
        throw new SandboxApiError(0, "bad_response", "The service's burner key does not match its burner address.")
      }
      const parsed = sandboxSessionSchema.safeParse({ ...created, apiUrl: base })
      if (!parsed.success) throw new SandboxApiError(0, "bad_response", "The service returned a session this page cannot store.")
      return parsed.data
    },
    onSuccess: (session) => startSandbox(session),
  })
}

/** Start control first. Fork block and chain id stay labelled text, not form fields. */
export function StartSession({ base, health, priceNote }: { base: string | null; health: Health | undefined; priceNote: string }) {
  const start = useStartSession(base)
  const ready = Boolean(base && health?.ok)
  const facts = {
    chainId: health?.chainId,
    forkBlock: health?.forkBlock,
    snapshotCreatedAt: health?.snapshotCreatedAt,
    markets: health?.markets,
    apiUrl: base,
    loading: !health && !start.isError,
    priceNote,
    startMethod: START_METHOD,
  }
  return (
    <Card data-testid="start-session">
      <CardHeader>
        <CardTitle>
          <h2>Start a session</h2>
        </CardTitle>
        <CardDescription>A fork of X Layer mainnet with a throwaway wallet.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => start.mutate()} disabled={!ready || start.isPending} aria-busy={start.isPending}>
            {start.isPending ? <Loader2Icon aria-hidden className="animate-spin" /> : <PlayIcon aria-hidden />}
            {start.isPending ? "Starting your fork…" : start.isError ? "Try again" : "Start a session"}
          </Button>
          {start.isPending ? (
            <span role="status" className="text-sm text-muted-foreground">
              Loading the snapshot, posting the session and a simulated price, funding your burner.
            </span>
          ) : null}
        </div>
        {start.isError ? (
          <Alert variant="destructive" data-testid="start-error">
            <CircleAlertIcon aria-hidden />
            <AlertTitle>The session did not start</AlertTitle>
            <AlertDescription>
              <p className="break-words">{start.error.message}</p>
            </AlertDescription>
          </Alert>
        ) : null}
        <CompactFacts {...facts} />
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-2">
        <SessionDetailsSheet {...facts} />
        <ProveForkLink />
      </CardFooter>
    </Card>
  )
}
