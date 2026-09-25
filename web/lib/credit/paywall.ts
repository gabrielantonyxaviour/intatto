/**
 * Optional x402 v2 paywall for the credit API (CREDIT_PAYMENT_MODE=paid). Default mode is free.
 *
 * The challenge is built by hand in the exact shape the OKX Payment SDK emits, because the SDK cannot build
 * one without seller credentials: x402ResourceServer.buildPaymentRequirements() refuses until initialize() has
 * fetched the facilitator's supported kinds, and GET https://web3.okx.com/api/v6/pay/x402/supported answers
 * `{"code":"50103","msg":"Request header OK-ACCESS-KEY can not be empty."}` without an API key.
 * Shape matched against (checked 2026-09-25):
 * - @okxweb3/x402-core 0.1.0: x402ResourceServer.buildPaymentRequirements + createPaymentRequiredResponse,
 *   x402HTTPResourceServer.createHTTPPaymentRequiredResponse (header `PAYMENT-REQUIRED` = base64 of the JSON,
 *   utf-8 via safeBase64Encode), resource = { url: request.url, description, mimeType } as the Next adapter sets it.
 * - @okxweb3/x402-evm 0.2.1 exact/server ExactEvmScheme.parsePrice: an AssetAmount price keeps its own
 *   asset and extra; maxTimeoutSeconds defaults to 300.
 * - https://web3.okx.com/onchainos/dev-docs/payments/service-seller-sdk and the "Standard 402 challenge
 *   example (v2)" in https://web3.okx.com/onchainos/dev-docs/okxai/howtomcp.
 * USDG supports EIP-3009 (transferWithAuthorization through its facet); its EIP-712 domain is
 * { name: "Global Dollar", version: "1" } (DOMAIN_SEPARATOR read on chain 196), the same `extra` OKX's own
 * paid Market API advertises for USDG.
 *
 * Verification and settlement are NOT wired: a request that carries a payment is still answered with 402 and
 * nothing is charged, until a real paid settlement has been proven end to end.
 */
import { getAddress, isAddress, type Address } from "viem"
import { XLAYER } from "@intatto/config/xlayer"
import { BASE_HEADERS, errorResponse, json, type Env } from "./http"

export const X402_NETWORK = "eip155:196"
export const USDG_ASSET = XLAYER.usdg
export const USDG_EIP712 = { name: "Global Dollar", version: "1" } as const
export const DEFAULT_PRICE_UNITS = "10000" // 0.01 USDG (6 decimals)
export const MAX_TIMEOUT_SECONDS = 300
export const CREDIT_DESCRIPTION =
  "Intatto credit and health for one wallet: collateral, debt, LTV, USDG borrowable now and the price fall to liquidation, read from X Layer."

export type PaymentRequirements = {
  scheme: "exact"
  network: typeof X402_NETWORK
  amount: string
  asset: string
  payTo: Address
  maxTimeoutSeconds: number
  extra: { name: string; version: string }
}

export type PaymentRequired = {
  x402Version: 2
  error?: string
  resource: { url: string; description: string; mimeType: string }
  accepts: PaymentRequirements[]
}

export type PaywallConfig =
  | { mode: "free" }
  | { mode: "paid"; payTo: Address; amountUnits: string }
  | { mode: "misconfigured"; error: string }

export function paywallConfig(env: Env): PaywallConfig {
  const mode = (env.CREDIT_PAYMENT_MODE ?? "free").trim().toLowerCase()
  if (mode === "" || mode === "free") return { mode: "free" }
  if (mode !== "paid") return { mode: "misconfigured", error: "CREDIT_PAYMENT_MODE must be free or paid." }
  const payTo = env.CREDIT_PAY_TO?.trim() ?? ""
  if (!isAddress(payTo, { strict: true })) {
    return { mode: "misconfigured", error: "Paid mode is on but CREDIT_PAY_TO is not a valid address." }
  }
  const amountUnits = env.CREDIT_PRICE_USDG_UNITS?.trim() || DEFAULT_PRICE_UNITS
  if (!/^[1-9][0-9]{0,17}$/.test(amountUnits)) {
    return { mode: "misconfigured", error: "CREDIT_PRICE_USDG_UNITS must be a positive whole number of USDG minimal units." }
  }
  return { mode: "paid", payTo: getAddress(payTo), amountUnits }
}

/** The x402 v2 PaymentRequired object, key order identical to the SDK's so the header bytes match too. */
export function paymentRequired(resourceUrl: string, cfg: { payTo: Address; amountUnits: string }, error = "Payment required"): PaymentRequired {
  return {
    x402Version: 2,
    error,
    resource: { url: resourceUrl, description: CREDIT_DESCRIPTION, mimeType: "application/json" },
    accepts: [
      {
        scheme: "exact",
        network: X402_NETWORK,
        amount: cfg.amountUnits,
        asset: USDG_ASSET,
        payTo: cfg.payTo,
        maxTimeoutSeconds: MAX_TIMEOUT_SECONDS,
        extra: { ...USDG_EIP712 },
      },
    ],
  }
}

/** Base64 of the UTF-8 JSON, as the SDK's safeBase64Encode does (works in Workers and Node). */
export function encodePaymentRequiredHeader(value: PaymentRequired): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function carriesPayment(req: Request): boolean {
  return Boolean(req.headers.get("PAYMENT-SIGNATURE") || req.headers.get("X-PAYMENT"))
}

/** Null when the request may proceed (free mode); otherwise the response to send instead. */
export function paywall(req: Request, env: Env): Response | null {
  const cfg = paywallConfig(env)
  if (cfg.mode === "free") return null
  if (cfg.mode === "misconfigured") return errorResponse(503, cfg.error, "PAYWALL_MISCONFIGURED")
  const paid = carriesPayment(req)
  const challenge = paymentRequired(req.url, cfg, paid ? "payment_verification_unavailable" : "Payment required")
  const headers = { ...BASE_HEADERS, "PAYMENT-REQUIRED": encodePaymentRequiredHeader(challenge) }
  return paid
    ? json({ error: "Payment verification is not enabled on this deployment yet; nothing was charged.", code: "PAYMENT_NOT_VERIFIED" }, 402, headers)
    : json({ error: "Payment required: pay with x402 (see the PAYMENT-REQUIRED header) and retry.", code: "PAYMENT_REQUIRED" }, 402, headers)
}
