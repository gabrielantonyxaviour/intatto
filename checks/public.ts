/**
 * Reachability from outside the network: the public app answers its health endpoint over HTTPS, a sandbox session
 * can be created with a funded burner, and the public sandbox RPC reports chain 1960196, refuses admin methods and
 * matches X Layer mainnet's block hash at the fork block.
 * Run: npx tsx checks/public.ts   (PUBLIC_URL and SANDBOX_URL override the defaults)
 */
import { createPublicClient, erc20Abi, http, type Address, type Hex } from "viem"
import { SANDBOX_CHAIN_ID, TICKERS, XLAYER } from "@intatto/config/xlayer"
import { fail, pass, xlayerClient } from "./lib/rpc.ts"

const APP = process.env.PUBLIC_URL ?? "https://intatto.larinova.com"
const SANDBOX = process.env.SANDBOX_URL ?? "https://intatto-rpc.larinova.com"

async function getJson<T>(url: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } })
  return { status: res.status, body: (await res.json().catch(() => ({}))) as T }
}

const health = await getJson<{ ok?: boolean; deployed?: boolean }>(`${APP}/api/health`)
if (health.status !== 200 || !health.body.ok) fail(`${APP}/api/health answered ${health.status}`)
pass(`${APP}/api/health ok over HTTPS (mainnet deployed: ${health.body.deployed})`)

const sandboxHealth = await getJson<{ ok?: boolean; forkBlock?: number }>(`${SANDBOX}/health`)
if (!sandboxHealth.body.ok || !sandboxHealth.body.forkBlock) fail(`${SANDBOX}/health answered ${sandboxHealth.status}`)
const forkBlock = sandboxHealth.body.forkBlock!
pass(`${SANDBOX}/health ok, fork block ${forkBlock}`)

const session = await getJson<{ sessionId?: string; rpcUrl?: string; burnerAddress?: Address; chainId?: number }>(`${SANDBOX}/session`, {
  method: "POST",
  body: "{}",
})
if (session.status !== 201 || !session.body.rpcUrl || !session.body.burnerAddress) fail(`POST /session answered ${session.status}: ${JSON.stringify(session.body).slice(0, 200)}`)
const { rpcUrl, burnerAddress, sessionId } = session.body as { rpcUrl: string; burnerAddress: Address; sessionId: string }
pass(`sandbox session ${sessionId} created; burner ${burnerAddress}`)

const sandbox = createPublicClient({ transport: http(rpcUrl, { timeout: 60_000 }) })
const chainId = await sandbox.getChainId()
if (chainId !== SANDBOX_CHAIN_ID) fail(`sandbox RPC reports chain ${chainId}, expected ${SANDBOX_CHAIN_ID}`)
pass(`public sandbox RPC reports chain ${chainId}`)

const nvdax = await sandbox.readContract({ address: TICKERS.NVDAx.token, abi: erc20Abi, functionName: "balanceOf", args: [burnerAddress] })
const usdg = await sandbox.readContract({ address: XLAYER.usdg, abi: erc20Abi, functionName: "balanceOf", args: [burnerAddress] })
if (nvdax === 0n || usdg === 0n) fail(`burner not funded (NVDAx ${nvdax}, USDG ${usdg})`)
pass(`burner funded from a real holder: ${Number(nvdax) / 1e18} NVDAx, ${Number(usdg) / 1e6} USDG`)

for (const method of ["anvil_setBalance", "evm_increaseTime", "evm_mine", "anvil_impersonateAccount", "hardhat_setBalance", "eth_sendTransaction"]) {
  const res = await getJson<{ error?: { code?: number } }>(rpcUrl, { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [] }) })
  if (res.body.error?.code !== -32601) fail(`${method} was not refused (${JSON.stringify(res.body).slice(0, 120)})`)
}
pass("admin methods refused with -32601 on the public RPC")

const mainnet = xlayerClient()
const blockTag = BigInt(forkBlock)
const [a, b] = await Promise.all([sandbox.getBlock({ blockNumber: blockTag }), mainnet.getBlock({ blockNumber: blockTag })])
if ((a.hash as Hex) !== (b.hash as Hex)) fail(`fork block ${forkBlock} hash differs: sandbox ${a.hash} vs mainnet ${b.hash}`)
pass(`block ${forkBlock} hash ${a.hash} matches X Layer mainnet`)
