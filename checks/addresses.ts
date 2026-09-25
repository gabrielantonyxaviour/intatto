/**
 * Every configured X Layer address has code on mainnet, and the chain id is 196.
 * Run: npx tsx checks/addresses.ts
 */
import { configuredAddresses, XLAYER_CHAIN_ID } from "@intatto/config/xlayer"
import { fail, pass, xlayerClient } from "./lib/rpc.ts"

const client = xlayerClient()

const chainId = await client.getChainId()
if (chainId !== XLAYER_CHAIN_ID) fail(`chain id is ${chainId}, expected ${XLAYER_CHAIN_ID}`)
pass(`chain id ${chainId}`)

const missing: string[] = []
for (const { name, address } of configuredAddresses()) {
  const code = await client.getCode({ address })
  if (!code || code === "0x") missing.push(`${name} ${address}`)
  else pass(`${name} ${address} has ${(code.length - 2) / 2} bytes of code`)
}
if (missing.length) fail(`no code at: ${missing.join(", ")}`)
pass("every configured address has code on X Layer mainnet")
