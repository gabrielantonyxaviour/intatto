"use client"

import { formatUtc, shortAddress } from "@/components/ui/web3/format"
import { CopyButton } from "@/components/ui/ix"

export function relativeTime(timestamp: number, now = Date.now() / 1000) {
  const delta = now - timestamp
  const seconds = Math.abs(delta)
  const value = seconds < 60 ? "just now" : seconds < 3600 ? `${Math.floor(seconds / 60)} min` : seconds < 86400 ? `${Math.floor(seconds / 3600)} h` : `${Math.floor(seconds / 86400)} d`
  return value === "just now" ? value : delta < 0 ? `in ${value}` : `${value} ago`
}
export function RelativeTime({ timestamp, now }: { timestamp: number | bigint; now?: number }) {
  return <time className="tabular-nums" title={formatUtc(timestamp)} dateTime={new Date(Number(timestamp) * 1000).toISOString()}>{relativeTime(Number(timestamp), now)}</time>
}
export function ShortHash({ value, name = "hash" }: { value: string; name?: string }) {
  return <span className="inline-flex max-w-full flex-wrap items-center gap-2"><code title={value} className="text-xs">{shortAddress(value, 6)}</code><span className="[&_button]:h-6 [&_button]:border-0 [&_button]:px-1 [&_button]:text-xs [&_button]:text-muted-foreground [&_button]:shadow-none"><CopyButton value={value} name={name} /></span></span>
}
