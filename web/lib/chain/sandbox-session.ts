import { z } from "zod"
import { deploymentSchema, type Deployment } from "@intatto/config/deployments"

/** A fork session the app runs against instead of X Layer mainnet. */
export type SandboxSession = {
  sessionId: string
  /** Base URL of the sandbox session API ("" for a local fork with no API). */
  apiUrl: string
  rpcUrl: string
  chainId: number
  forkBlock: number
  deployment: Deployment
  /** Private key of the throwaway burner account funded on the fork. Never a real wallet. */
  burnerKey: `0x${string}`
}

export const SANDBOX_STORAGE_KEY = "intatto:sandbox"
/** Fired on window after this tab writes or clears the session. */
export const SANDBOX_CHANGE_EVENT = "intatto:sandbox-change"

export const sandboxSessionSchema = z.object({
  sessionId: z.string().min(1),
  apiUrl: z.string(),
  rpcUrl: z.string().url(),
  chainId: z.number().int().positive(),
  forkBlock: z.number().int().nonnegative(),
  deployment: deploymentSchema,
  burnerKey: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, "expected a 32-byte hex private key")
    .transform((k) => k as `0x${string}`),
})

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

function announce() {
  try {
    window.dispatchEvent(new Event(SANDBOX_CHANGE_EVENT))
  } catch {
    // no window (server) or events blocked: nothing listens anyway
  }
}

/** The stored sandbox session, or null when none is stored, storage is blocked, or the entry is malformed. */
export function readSandboxSession(): SandboxSession | null {
  try {
    const raw = storage()?.getItem(SANDBOX_STORAGE_KEY)
    if (!raw) return null
    const parsed = sandboxSessionSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** Stores the session; returns false when it is invalid or storage is unavailable. */
export function writeSandboxSession(session: SandboxSession): boolean {
  const parsed = sandboxSessionSchema.safeParse(session)
  if (!parsed.success) return false
  try {
    const s = storage()
    if (!s) return false
    s.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(parsed.data))
    announce()
    return true
  } catch {
    return false
  }
}

export function clearSandboxSession(): void {
  try {
    storage()?.removeItem(SANDBOX_STORAGE_KEY)
  } catch {
    // storage blocked: nothing was stored
  }
  announce()
}
