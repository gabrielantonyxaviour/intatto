"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export type CopyButtonProps = { name: string; value: string }

/** Copy status is reported only after the browser confirms the write. */
export function CopyButton({ name, value }: CopyButtonProps) {
  const [result, setResult] = useState<{ value: string; message: string }>()
  const [pending, setPending] = useState(false)
  async function copy() {
    setPending(true)
    try {
      await navigator.clipboard.writeText(value)
      setResult({ value, message: `${name} copied.` })
    } catch {
      setResult({ value, message: `Could not copy ${name}. Select and copy the displayed value.` })
    } finally {
      setPending(false)
    }
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={copy} disabled={pending} aria-label={`Copy ${name}`}>
        Copy {name}
      </Button>
      <span role="status" className="text-xs text-muted-foreground">{result?.value === value ? result.message : ""}</span>
    </span>
  )
}
