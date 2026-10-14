import { test, expect } from "./fixtures"
import { lossExample, usdg } from "../../web/components/lend/lend-format.ts"

test("monetary displays round to cents and the loss example never states more than 100%", () => {
  expect(usdg(1_497_500n, 0)).toBe("1.50 USDG")
  expect(usdg(1_497_502n)).toBe("1.50 USDG")
  expect(usdg(400_000n)).toBe("0.40 USDG")
  expect(usdg(150_500_000n, 0)).toBe("150.50 USDG")
  expect(usdg(50_150_000_000n, 0)).toBe("50,150.00 USDG")
  expect(lossExample(1_497_500n)).toBe("The vault holds 1.50 USDG today, so a write-off that size would wipe out all deposits.")
  expect(lossExample(50_150_000_000n)).toContain("by 1.994% at today's deposits")
  for (const total of [0n, 1n, 1_497_500n, 999_999_999n, 1_000_000_000n, 1_000_000_001n, 50_150_000_000n, 10n ** 18n]) {
    for (const m of lossExample(total).matchAll(/([\d.,]+)%/g)) {
      expect(Number(m[1]!.replace(/,/g, "")), lossExample(total)).toBeLessThanOrEqual(100)
    }
  }
})
