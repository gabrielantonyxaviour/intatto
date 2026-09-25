"use client"

import { useState } from "react"
import type { Address } from "viem"
import { useAccount } from "wagmi"
import { lendingVaultAbi } from "@intatto/config/abi"
import { useIntatto, type AccountState, type VaultState } from "@/lib/chain"
import { Button } from "@/components/ui/button"
import { AmountInput, ApproveThenAct, TokenAmount, ValueChange, shortAddress } from "@/components/ui/web3"
import { SHARE_SYMBOL, USDG_DECIMALS, bpsText, projectedEarnings, usdg } from "./lend-format"
import { SummaryRow } from "./summary-row"

/** ERC-4626 previewDeposit with OpenZeppelin's virtual share and asset (decimals offset 0), rounded down. */
function previewShares(assets: bigint, vault: VaultState): bigint {
  return (assets * (vault.totalSupply + 1n)) / (vault.totalAssets + 1n)
}

const money = (v: number | bigint) => usdg(BigInt(v))

/** Deposit USDG: amount with wallet balance and Max, projected earnings as you type, a receipt, approve → deposit. */
export function DepositForm({
  vault,
  account,
  termsAccepted,
  onOpenPrimer,
}: {
  vault: VaultState
  account: AccountState | undefined
  termsAccepted: boolean
  onOpenPrimer: () => void
}) {
  const { deployment, chain } = useIntatto()
  const { address } = useAccount()
  const [value, setValue] = useState("")
  const [amount, setAmount] = useState<bigint | null>(null)
  if (!deployment) return null

  const wallet = account?.walletUsdg
  const current = account?.vaultAssets ?? 0n
  const typed = amount !== null && amount > 0n ? amount : null
  const after = typed !== null ? current + typed : null
  const rate = vault.supplyRateBps

  const disabledReason = !termsAccepted
    ? "Accept the lending terms first"
    : typed === null
      ? "Enter an amount"
      : wallet !== undefined && typed > wallet
        ? "Insufficient USDG balance"
        : null

  return (
    <div className="grid gap-3" data-testid="deposit-form">
      <AmountInput
        label="Deposit USDG"
        token="USDG"
        decimals={USDG_DECIMALS}
        value={value}
        onChange={(v, a) => {
          setValue(v)
          setAmount(a)
        }}
        balance={wallet}
        balanceLabel="Wallet"
        max={wallet}
        tooLargeMessage="Insufficient USDG balance"
        name="deposit-amount"
      />
      <dl className="grid gap-2 rounded-lg border p-3" aria-label="Deposit summary">
        <SummaryRow label="Network">{chain.name}</SummaryRow>
        <ValueChange label="Your deposit" before={current} after={after} format={money} />
        <SummaryRow label="Supply rate" testId="deposit-supply-rate">
          {bpsText(rate)}
        </SummaryRow>
        <ValueChange
          label="Projected monthly earnings"
          before={projectedEarnings(current, rate, 1)}
          after={after !== null ? projectedEarnings(after, rate, 1) : null}
          format={money}
        />
        <ValueChange
          label="Projected yearly earnings"
          before={projectedEarnings(current, rate, 12)}
          after={after !== null ? projectedEarnings(after, rate, 12) : null}
          format={money}
        />
      </dl>
      {typed !== null ? (
        <dl className="grid gap-2 rounded-lg border p-3" aria-label="Deposit receipt" data-testid="deposit-receipt">
          <SummaryRow label="From">{address ? `Your wallet (${shortAddress(address)})` : "Your wallet"}</SummaryRow>
          <SummaryRow label="To">Intatto USDG vault</SummaryRow>
          <SummaryRow label="Lent to">NVDAx market · 65% liquidation threshold</SummaryRow>
          <SummaryRow label="Supply rate">
            <span className="text-success-foreground">{bpsText(rate)}</span>
          </SummaryRow>
          <SummaryRow label="You receive">
            ≈ <TokenAmount value={previewShares(typed, vault)} decimals={USDG_DECIMALS} maxFractionDigits={6} symbol={SHARE_SYMBOL} />
          </SummaryRow>
        </dl>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Projections use today&apos;s supply rate as simple interest. The rate moves with utilisation.
      </p>
      {!termsAccepted ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3 text-sm">
          <span className="text-muted-foreground">Read how lending works before your first deposit.</span>
          <Button variant="outline" size="sm" onClick={onOpenPrimer}>
            Read and accept
          </Button>
        </div>
      ) : null}
      <ApproveThenAct
        token={{ address: deployment.usdg as Address, symbol: "USDG", decimals: USDG_DECIMALS }}
        spender={deployment.vault as Address}
        amount={typed}
        action={
          typed !== null && address
            ? { address: deployment.vault as Address, abi: lendingVaultAbi, functionName: "deposit", args: [typed, address] }
            : null
        }
        actionLabel="Deposit USDG"
        disabledReason={disabledReason}
        successMessage="Deposit confirmed"
        onSuccess={() => {
          setValue("")
          setAmount(null)
        }}
      />
    </div>
  )
}
