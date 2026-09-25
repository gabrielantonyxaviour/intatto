/**
 * Response helpers for the credit API. Every error body is `{ error, code }`; nothing from a caught
 * exception (message, stack, RPC payload) is ever copied into a response.
 */

export type Env = Record<string, string | undefined>

/** An error whose message and code are safe to show to the caller. */
export class CreditError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = "CreditError"
  }
}

/** Browser agents may call the API directly and must be able to read the x402 challenge header. */
export const BASE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
  "Cache-Control": "no-store",
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...BASE_HEADERS, ...headers } })
}

export function errorResponse(status: number, error: string, code: string, headers: Record<string, string> = {}): Response {
  return json({ error, code }, status, headers)
}

/** Maps anything thrown while serving a request to a safe response. */
export function fromError(e: unknown): Response {
  if (e instanceof CreditError) return errorResponse(e.status, e.message, e.code)
  return errorResponse(503, "Could not read the chain right now. Try again in a moment.", "CHAIN_UNAVAILABLE")
}

/** process.env where it exists (Node, and Workers with nodejs_compat); an empty map elsewhere. */
export function processEnv(): Env {
  return typeof process !== "undefined" && process.env ? process.env : {}
}
