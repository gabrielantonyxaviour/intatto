import type { Abi, Address } from "viem"

/** A contract write described the way viem's simulateContract / writeContract take it. */
export type ContractRequest = {
  address: Address
  abi: Abi
  functionName: string
  args?: readonly unknown[]
  value?: bigint
}

/** An ERC-20 the UI moves. */
export type TokenInfo = {
  address: Address
  symbol: string
  decimals: number
}
