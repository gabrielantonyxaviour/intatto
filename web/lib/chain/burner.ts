import { createConnector } from "wagmi"
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  hexToBigInt,
  hexToNumber,
  numberToHex,
  SwitchChainError,
  type Address,
  type Hex,
  type TypedDataDefinition,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { sandboxChain, sandboxTransport } from "./chains"
import type { SandboxSession } from "./sandbox-session"

export const BURNER_CONNECTOR_ID = "sandboxBurner"

type RpcRequest = { method: string; params?: unknown }
export type BurnerProvider = { request(args: RpcRequest): Promise<unknown> }

/** eth_sendTransaction params as wallets receive them: hex quantities. */
type RpcTransaction = {
  from?: Address
  to?: Address | null
  data?: Hex
  input?: Hex
  value?: Hex
  gas?: Hex
  nonce?: Hex
  gasPrice?: Hex
  maxFeePerGas?: Hex
  maxPriorityFeePerGas?: Hex
}

const q = (v: Hex | undefined) => (v === undefined ? undefined : hexToBigInt(v))

/**
 * An EIP-1193 provider for the sandbox burner: accounts and signing are local (the key never
 * leaves the page), transactions are signed here and sent raw to the fork RPC, and every other
 * call is forwarded to that RPC.
 */
export function createBurnerProvider(session: SandboxSession): BurnerProvider {
  const account = privateKeyToAccount(session.burnerKey)
  const chain = sandboxChain(session.rpcUrl, session.chainId)
  const transport = sandboxTransport(session.rpcUrl)
  const rpc = createPublicClient({ chain, transport })
  const wallet = createWalletClient({ account, chain, transport })

  async function sendTransaction(tx: RpcTransaction): Promise<Hex> {
    if (tx.from && getAddress(tx.from) !== account.address) {
      throw new Error(`sandbox burner cannot sign for ${tx.from}`)
    }
    const fees =
      tx.maxFeePerGas !== undefined
        ? { maxFeePerGas: q(tx.maxFeePerGas), maxPriorityFeePerGas: q(tx.maxPriorityFeePerGas) }
        : tx.gasPrice !== undefined
          ? { gasPrice: q(tx.gasPrice) }
          : {}
    const request = await wallet.prepareTransactionRequest({
      account,
      chain,
      to: tx.to ?? undefined,
      data: tx.data ?? tx.input,
      value: q(tx.value),
      gas: q(tx.gas),
      nonce: tx.nonce === undefined ? undefined : hexToNumber(tx.nonce),
      ...fees,
    })
    const signed = await wallet.signTransaction(request)
    return rpc.request({ method: "eth_sendRawTransaction", params: [signed] })
  }

  return {
    async request({ method, params }) {
      const list = (Array.isArray(params) ? params : []) as unknown[]
      switch (method) {
        case "eth_accounts":
        case "eth_requestAccounts":
          return [account.address]
        case "eth_chainId":
          return numberToHex(session.chainId)
        case "net_version":
          return String(session.chainId)
        case "wallet_requestPermissions":
        case "wallet_getPermissions":
          return [{ parentCapability: "eth_accounts" }]
        case "wallet_switchEthereumChain": {
          const target = (list[0] as { chainId?: Hex } | undefined)?.chainId
          if (target && hexToNumber(target) === session.chainId) return null
          throw Object.assign(new Error("The sandbox burner only runs on the sandbox fork."), { code: 4902 })
        }
        case "eth_sendTransaction":
          return sendTransaction(list[0] as RpcTransaction)
        case "personal_sign":
          return account.signMessage({ message: { raw: list[0] as Hex } })
        case "eth_signTypedData_v4": {
          const raw = list[1]
          const typed = (typeof raw === "string" ? JSON.parse(raw) : raw) as TypedDataDefinition
          return account.signTypedData(typed)
        }
        default:
          return rpc.request({ method, params } as never)
      }
    },
  }
}

/** wagmi connector for the sandbox burner. It is always authorized, so it connects on its own. */
export function sandboxBurner(session: SandboxSession) {
  const address = privateKeyToAccount(session.burnerKey).address
  let provider: BurnerProvider | undefined
  let connected = true

  return createConnector<BurnerProvider>((config) => ({
    id: BURNER_CONNECTOR_ID,
    name: "Sandbox burner",
    type: BURNER_CONNECTOR_ID,
    async connect({ chainId, withCapabilities } = {}) {
      if (chainId !== undefined && chainId !== session.chainId) {
        throw new SwitchChainError(new Error(`The sandbox runs on chain ${session.chainId}, not ${chainId}.`))
      }
      connected = true
      const accounts = withCapabilities ? [{ address, capabilities: {} }] : [address]
      return { accounts: accounts as never, chainId: session.chainId }
    },
    async disconnect() {
      connected = false
    },
    async getAccounts() {
      return [address]
    },
    async getChainId() {
      return session.chainId
    },
    async getProvider() {
      provider ??= createBurnerProvider(session)
      return provider
    },
    async isAuthorized() {
      return connected
    },
    async switchChain({ chainId }) {
      const chain = config.chains.find((c) => c.id === chainId)
      if (!chain || chainId !== session.chainId) {
        throw new SwitchChainError(new Error(`The sandbox runs on chain ${session.chainId}.`))
      }
      return chain
    },
    onAccountsChanged() {},
    onChainChanged() {},
    onDisconnect() {
      config.emitter.emit("disconnect")
    },
  }))
}
