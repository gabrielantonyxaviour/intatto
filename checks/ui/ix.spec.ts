import { expect, test } from "@playwright/test"
import { readProtocolParams, protocolParamsResult } from "../../web/lib/chain/params"
import { priceProvenance } from "../../web/lib/chain/provenance"
import { parseDeployment } from "@intatto/config/deployments"
import { readFileSync } from "node:fs"

test.use({ trace: "off" })

const deployment = parseDeployment(JSON.parse(readFileSync("deployments/xlayer-mainnet.json", "utf8")))

test("protocol snapshot uses the selected deployment, one block and both session endpoints", async () => {
  const calls: { address: string; functionName: string; args?: readonly unknown[]; blockNumber: bigint }[] = []
  const data = await readProtocolParams({
    getBlock: async () => ({ number: 123n, timestamp: 456n }),
    readContract: async (request) => {
      calls.push(request)
      if (request.functionName === "closedDecayDuration") return 99n
      if (request.functionName === "twapWindow") return 300
      return 0n // Zero is a real value, never a missing-value fallback.
    },
  }, deployment, "NVDAx")
  expect(data.blockNumber).toBe(123n)
  expect(data.relay.twapWindow).toBe(300n)
  expect(data.market.penaltyBps).toBe(0n)
  expect(calls.every((c) => c.blockNumber === 123n)).toBe(true)
  expect(calls.find((c) => c.functionName === "LIQUIDATION_THRESHOLD_BPS")?.address)
    .toBe(deployment.markets.find((m) => m.symbol === "NVDAx")!.market)
  expect(calls.filter((c) => c.functionName === "maxLtvBpsFor").map((c) => c.args))
    .toEqual([[1, 0n], [1, 99n], [2, 0n], [2, 99n], [3, 0n], [3, 99n]])
})

test("a second deployment cannot reuse live contract addresses", async () => {
  const activeAddress = "0x1111111111111111111111111111111111111111"
  const active = { ...deployment, sessionRisk: activeAddress, liquidator: activeAddress,
    interestRateModel: activeAddress, markets: [{ ...deployment.markets[0]!, symbol: "SPYx" as const,
      market: activeAddress, priceRelay: activeAddress, corporateActionGuard: activeAddress }] }
  const addresses: string[] = []
  await readProtocolParams({ getBlock: async () => ({ number: 9n, timestamp: 10n }),
    readContract: async (request) => { addresses.push(request.address); return 1n },
  }, active, "SPYx")
  expect(addresses.length).toBeGreaterThan(20)
  expect(new Set(addresses)).toEqual(new Set([activeAddress]))
})

test("failed or malformed reads cannot produce authoritative parameters", async () => {
  const client = {
    getBlock: async () => ({ number: 123n, timestamp: 456n }),
    readContract: async () => -1n,
  }
  await expect(readProtocolParams(client, deployment, "NVDAx")).rejects.toThrow()
  await expect(readProtocolParams({ ...client, readContract: async () => { throw new Error("RPC unavailable") } }, deployment, "NVDAx"))
    .rejects.toThrow("RPC unavailable")
  await expect(readProtocolParams({ ...client, readContract: async (request) => {
    if (request.functionName === "pegBps") throw new Error("Single read failed")
    return 1n
  } }, deployment, "NVDAx")).rejects.toThrow("Single read failed")
  await expect(readProtocolParams(client, { ...deployment, markets: [{ ...deployment.markets[0]!, symbol: "SPYx" }] }, "NVDAx"))
    .rejects.toThrow("not deployed")
})

test("loading and failed refreshes suppress cached data", () => {
  const cached = { value: 6500n }
  expect(protocolParamsResult(false, false, false, cached)).toEqual({ status: "unavailable", data: undefined })
  expect(protocolParamsResult(true, true, false, cached)).toEqual({ status: "loading", data: undefined })
  expect(protocolParamsResult(true, false, true, cached)).toEqual({ status: "error", data: undefined })
  expect(protocolParamsResult(true, false, false, cached)).toEqual({ status: "success", data: cached })
})

test("price provenance distinguishes issuer quotes from simulated pool prices", () => {
  expect(priceProvenance("live").short).toBe("Keeper relay of the issuer quote")
  expect(priceProvenance("live").detail).toContain("no source timestamp")
  expect(priceProvenance("sandbox").short).toBe("Simulated keeper post (sandbox)")
  expect(priceProvenance("sandbox").detail).toContain("not the live issuer quote")
})
