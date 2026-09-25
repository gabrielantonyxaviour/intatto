"use client"

import { useState } from "react"
import type { Address } from "viem"
import { useAccount } from "wagmi"
import { lendingVaultAbi } from "@intatto/config/abi"
import { useIntatto, type AccountState, type VaultState } from "@/lib/chain"
import { AmountInput, TokenAmount, TxButton, ValueChange } from "@/components/ui/web3"
import { SHARE_SYMBOL, USDG_DECIMALS, usdg } from "./lend-format"
import { SummaryRow } from "./summary-row"

const VAULT_REFUSALS = {
  ERC4626ExceededMaxWithdraw: "Only the vault's idle USDG can be withdrawn right now; the rest is lent out.",
  ERC4626ExceededMaxRedeem: "Only the vault's idle USDG can be withdrawn right now; the rest is lent out.",
}

/** ERC-4626 previewWithdraw (shares burned for `assets`), rounded up like the vault does. */
function sharesFor(assets: bigint, vault: VaultState): bigint {
  const num = assets * (vault.totalSupply + 1n)
  const den = vault.totalAssets + 1n
  return (num + den - 1n) / den
}

const money = (v: number | bigint) => usdg(BigInt(v))

/** Withdraw USDG, limited to idle liquidity with the reason stated; the whole deposit redeems every share. */
export function WithdrawForm({ vault, account }: { vault: VaultState; account: AccountState | undefined }) {
  const { deployment } = useIntatto()
  const { address } = useAccount()
  const [value, setValue] = useState("")
  const [amount, setAmount] = useState<bigint | null>(null)
  if (!deployment) return null

  const deposit = account?.vaultAssets ?? 0n
  const shares = account?.vaultShares ?? 0n
  const max = deposit < vault.idle ? deposit : vault.idle
  const typed = amount !== null && amount > 0n ? amount : null
  const overDeposit = typed !== null && typed > deposit
  const overIdle = typed !== null && !overDeposit && typed > vault.idle
  const idleText = usdg(vault.idle)
  const all = typed !== null && typed === deposit && !overIdle

  const disabledReason =
    account && deposit === 0n
      ? "Nothing to withdraw"
      : typed === null
        ? "Enter an amount"
        : overDeposit
          ? "More than your deposit"
          : overIdle
            ? `Only ${idleText} is idle`
            : null

  const request =
    typed === null || !address || disabledReason
      ? null
      : all
        ? { address: deployment.vault as Address, abi: lendingVaultAbi, functionName: "redeem", args: [shares, address, address] }
        : { address: deployment.vault as Address, abi: lendingVaultAbi, functionName: "withdraw", args: [typed, address, address] }

  return (
    <div className="grid gap-3" data-testid="withdraw-form">
      <AmountInput
        label="Withdraw USDG"
        token="USDG"
        decimals={USDG_DECIMALS}
        value={value}
        onChange={(v, a) => {
          setValue(v)
          setAmount(a)
        }}
        balance={account ? deposit : undefined}
        balanceLabel="Your deposit"
        max={account ? max : undefined}
        tooLargeMessage={
          overDeposit ? `More than your deposit of ${usdg(deposit)}.` : `Only ${idleText} is idle; the rest is lent out.`
        }
        name="withdraw-amount"
      />
      <dl className="grid gap-2 rounded-lg border p-3" aria-label="Withdrawal summary">
        <ValueChange
          label="Your deposit"
          before={deposit}
          after={typed !== null && !overDeposit ? deposit - typed : null}
          format={money}
        />
        <SummaryRow label="Shares burned">
          {typed !== null && !overDeposit ? (
            <>
              ≈{" "}
              <TokenAmount
                value={all ? shares : sharesFor(typed, vault)}
                decimals={USDG_DECIMALS}
                maxFractionDigits={6}
                symbol={SHARE_SYMBOL}
              />
            </>
          ) : (
            "–"
          )}
        </SummaryRow>
        <SummaryRow label="Idle in the vault" testId="withdraw-idle">
          {idleText}
        </SummaryRow>
      </dl>
      <p className="text-xs text-muted-foreground">
        You can withdraw up to the vault&apos;s idle USDG. What is lent out comes back as borrowers repay or are
        liquidated.
      </p>
      <TxButton
        label="Withdraw USDG"
        request={request}
        disabledReason={disabledReason}
        reasons={VAULT_REFUSALS}
        successMessage="Withdrawal confirmed"
        onSuccess={() => {
          setValue("")
          setAmount(null)
        }}
      />
    </div>
  )
}
