"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const rpcUrlSchema = z
  .string()
  .trim()
  .url("Enter a full URL, like http://127.0.0.1:8545")
  .refine((u) => /^https?:\/\//i.test(u), "Only http and https RPC URLs")
export const blockSchema = z
  .string()
  .trim()
  .regex(/^\d{1,12}$/, "A block number, digits only")

/** Shown when there is no sandbox session and no ?rpc=: nothing to compare yet. */
export function NoSandbox({ invalid }: { invalid?: string | null }) {
  const router = useRouter()
  const [rpc, setRpc] = useState("")
  const [block, setBlock] = useState("")
  const [error, setError] = useState<string | null>(invalid ?? null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const r = rpcUrlSchema.safeParse(rpc)
    if (!r.success) return setError(r.error.issues[0]?.message ?? "Invalid RPC URL")
    const b = block.trim() ? blockSchema.safeParse(block) : null
    if (b && !b.success) return setError(b.error.issues[0]?.message ?? "Invalid block")
    const params = new URLSearchParams({ rpc: r.data })
    if (b?.success) params.set("block", b.data)
    router.push(`/sandbox/proof?${params.toString()}`)
  }

  return (
    <Card data-slot="no-sandbox" className="gap-4">
      <CardHeader className="gap-1.5">
        <h1 className="text-xl font-semibold">Fork proof</h1>
        <CardDescription>
          Start a sandbox session to compare its block history, code and state with X Layer.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Button asChild className="w-fit">
          <Link href="/sandbox">Start a sandbox session</Link>
        </Button>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <details className="min-w-0">
          <summary className="cursor-pointer text-sm font-medium">Check a custom RPC</summary>
          <form onSubmit={submit} className="mt-3 grid max-w-xl gap-3" noValidate>
            <div className="grid gap-1.5">
              <Label htmlFor="proof-rpc">RPC URL</Label>
              <Input id="proof-rpc" value={rpc} onChange={(e) => setRpc(e.target.value)} placeholder="http://127.0.0.1:8545" inputMode="url" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="proof-block">Fork block (optional for a local anvil, which reports its own)</Label>
              <Input id="proof-block" value={block} onChange={(e) => setBlock(e.target.value)} placeholder="71559900" inputMode="numeric" />
            </div>
            <Button type="submit" variant="outline" className="w-fit">
              Check this RPC
            </Button>
          </form>
        </details>
      </CardContent>
    </Card>
  )
}
