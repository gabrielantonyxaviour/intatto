import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem"

export type DecodedTxError = {
  kind: "refused" | "rejected" | "failed"
  /** Custom error name for a contract refusal (e.g. "SessionLimit"). */
  errorName: string | null
  /** One line for the UI. */
  message: string
  /** Full error text for a "More details" disclosure. */
  details: string
}

function hasCode(e: unknown, code: number): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === code
}

/** Classifies a viem/wagmi error: a contract refusal (with its custom error name), a wallet rejection, or a failure. */
export function decodeTxError(error: unknown, reasons: Record<string, string> = {}): DecodedTxError {
  const details = error instanceof Error ? error.message : String(error)
  if (error instanceof BaseError) {
    const rejected = error.walk((e) => e instanceof UserRejectedRequestError || hasCode(e, 4001))
    if (rejected) {
      return { kind: "rejected", errorName: null, message: "You rejected the request in your wallet.", details }
    }
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError)
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName ?? null
      const message = (name && reasons[name]) || revert.reason || revert.shortMessage
      return { kind: "refused", errorName: name, message, details }
    }
    return { kind: "failed", errorName: null, message: error.shortMessage, details }
  }
  if (hasCode(error, 4001)) {
    return { kind: "rejected", errorName: null, message: "You rejected the request in your wallet.", details }
  }
  return { kind: "failed", errorName: null, message: details.split("\n")[0] ?? "Something went wrong.", details }
}
