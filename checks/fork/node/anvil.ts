/** Starts anvil forked from X Layer mainnet at a pinned block with the sandbox chain id (Node only). */
import { spawn, type ChildProcess } from "node:child_process"
import { createServer } from "node:net"
import { SANDBOX_CHAIN_ID, xlayerRpcUrls } from "@intatto/config/xlayer"

/** Pinned so every check forks the same state (and anvil's RPC cache makes reruns fast). */
export const PINNED_FORK_BLOCK = 71_559_900

export type Anvil = { rpcUrl: string; port: number; forkBlock: number; chainId: number; stop: () => Promise<void> }

export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address()
      srv.close(() => (typeof address === "object" && address ? resolve(address.port) : reject(new Error("no port"))))
    })
  })
}

export async function startAnvil(opts: { forkBlock?: number; port?: number; loadState?: string; chainId?: number } = {}): Promise<Anvil> {
  const port = opts.port ?? (await freePort())
  const forkBlock = opts.forkBlock ?? Number(process.env.XLAYER_FORK_BLOCK ?? PINNED_FORK_BLOCK)
  const chainId = opts.chainId ?? SANDBOX_CHAIN_ID
  const args = [
    "--fork-url", xlayerRpcUrls()[0],
    "--fork-block-number", String(forkBlock),
    "--chain-id", String(chainId),
    "--network", "optimism",
    "--host", "127.0.0.1",
    "--port", String(port),
    "--retries", "8",
    "--timeout", "60000",
    "--silent",
  ]
  if (opts.loadState) args.push("--load-state", opts.loadState)
  const proc: ChildProcess = spawn("anvil", args, { stdio: ["ignore", "ignore", "pipe"] })
  let stderr = ""
  proc.stderr?.on("data", (b) => (stderr += String(b)))
  const rpcUrl = `http://127.0.0.1:${port}`
  const deadline = Date.now() + 90_000
  for (;;) {
    if (proc.exitCode !== null) throw new Error(`anvil exited (${proc.exitCode}): ${stderr.slice(-500)}`)
    try {
      const res = await fetch(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }) })
      const body = (await res.json()) as { result?: string }
      if (body.result && Number(body.result) === chainId) break
    } catch {}
    if (Date.now() > deadline) throw new Error("anvil did not become ready in 90s")
    await new Promise((r) => setTimeout(r, 300))
  }
  const stop = async () => {
    if (proc.exitCode !== null) return
    proc.kill("SIGTERM")
    await new Promise((r) => setTimeout(r, 300))
  }
  process.once("exit", () => proc.kill("SIGKILL"))
  return { rpcUrl, port, forkBlock, chainId, stop }
}
