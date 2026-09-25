import { parseDeployment, type Deployment } from "@intatto/config/deployments"

function load(): { deployment: Deployment | null; error: string | null } {
  // Must stay a literal `process.env.NEXT_PUBLIC_…` read so Next inlines it at build time.
  const raw = process.env.NEXT_PUBLIC_LIVE_DEPLOYMENT
  if (!raw || !raw.trim()) return { deployment: null, error: null }
  try {
    return { deployment: parseDeployment(JSON.parse(raw)), error: null }
  } catch (err) {
    return { deployment: null, error: err instanceof Error ? err.message : "invalid deployment JSON" }
  }
}

const loaded = load()

/** The X Layer mainnet deployment, or null while Intatto is not deployed yet. Screens must render the null state. */
export const liveDeployment: Deployment | null = loaded.deployment

/** Why NEXT_PUBLIC_LIVE_DEPLOYMENT was rejected, when it was set but did not parse. */
export const liveDeploymentError: string | null = loaded.error
