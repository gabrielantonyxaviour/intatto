/**
 * A local fork of X Layer mainnet with Intatto deployed on it, as UI checks receive it.
 * The fork harness produces one; checks/ui/fixtures turns it into the app's sandbox session.
 */
import { privateKeyToAccount } from "viem/accounts"
import type { Deployment } from "@intatto/config/deployments"

export type ForkEnv = {
  rpcUrl: string
  chainId: number
  forkBlock: number
  deployment: Deployment
  /** Funded throwaway key on the fork; the app signs with it through the "Sandbox burner" connector. */
  burnerKey: `0x${string}`
  burnerAddress: `0x${string}`
  /** Sandbox session API, when the checks run against a hosted session instead of a bare fork. */
  sessionApiUrl?: string
}

/** Builds a ForkEnv, deriving the burner address from its key. */
export function forkEnv(input: Omit<ForkEnv, "burnerAddress">): ForkEnv {
  return { ...input, burnerAddress: privateKeyToAccount(input.burnerKey).address }
}
