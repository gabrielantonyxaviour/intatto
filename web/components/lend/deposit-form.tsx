"use client"

import { useRef, useState } from "react"
import type { Address } from "viem"
import { useAccount } from "wagmi"
import { lendingVaultAbi } from "@intatto/config/abi"
import { useIntatto, type AccountState, type VaultState } from "@/lib/chain"
import { Button } from "@/components/ui/button"
import { DefinitionPopover, ReviewDialog } from "@/components/ui/ix"
import { AmountInput, ApproveThenAct, TokenAmount, ValueChange, shortAddress } from "@/components/ui/web3"
import { SHARE_SYMBOL, USDG_DECIMALS, amount6, bpsText, marketList, projectedEarnings, usdg } from "./lend-format"
import { useLendMarkets } from "./use-lend-reads"
import { SummaryRow } from "./summary-row"

/** ERC-4626 previewDeposit with OpenZeppelin's virtual share and asset (decimals offset 0), rounded down. */
function previewShares(assets: bigint, vault: VaultState): bigint {
  return (assets * (vault.totalSupply + 1n)) / (vault.totalAssets + 1n)
}

const money = (v: number | bigint) => usdg(BigInt(v))

/** Deposit USDG. Earnings sit in one popover. Approval and submission sit in the review dialog. */
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
  const reviewRef = useRef<HTMLButtonElement>(null)
  const [value, setValue] = useState("")
  const [amount, setAmount] = useState<bigint | null>(null)
  const [review, setReview] = useState(false)
  const markets = useLendMarkets()
  if (!deployment) return null

  const wallet = account?.walletUsdg
  const current = account?.vaultAssets ?? 0n
  const typed = amount !== null && amount > 0n ? amount : null
  const after = typed !== null ? current + typed : null
  const rate = vault.supplyRateBps
  const symbols = deployment.markets.map((m) => m.symbol)
  const lentTo =
    markets.data?.length === 1
      ? `${markets.data[0]!.symbol} · ${bpsText(markets.data[0]!.state.liquidationThresholdBps, 0)} liquidation threshold`
      : marketList(symbols)

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
      </dl>
      <div className="flex items-center gap-1 text-sm">
        <span>Earnings</span>
        <DefinitionPopover
          term="Earnings"
          side="bottom"
          contentTestId="lend-earnings"
          source="Estimate only: simple interest at today's supply rate. The rate moves with utilisation."
        >
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
        </DefinitionPopover>
      </div>
      {!termsAccepted ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3 text-sm">
          <span className="text-muted-foreground">Read how lending works before your first deposit.</span>
          <Button variant="outline" size="sm" onClick={onOpenPrimer}>
            Read and accept
          </Button>
        </div>
      ) : null}
      <Button ref={reviewRef} type="button" disabled={disabledReason !== null} onClick={() => setReview(true)}>
        {disabledReason ?? "Review"}
      </Button>
      <ReviewDialog
        open={review}
        onOpenChange={setReview}
        title="Review deposit"
        amount={typed !== null ? amount6(typed) : "0"}
        asset="USDG"
        chain={chain.name}
        returnFocusRef={reviewRef}
        testId="lend-deposit-review"
        actionLabel="Deposit USDG"
        beforeAfter={<ValueChange label="Your deposit" before={current} after={after} format={money} />}
        limit={<p>Wallet balance: {wallet !== undefined ? usdg(wallet) : "still reading"}.</p>}
        walletSteps={
          <ol className="list-decimal pl-4 text-sm">
            <li>Approve USDG for the vault.</li>
            <li>Deposit USDG.</li>
          </ol>
        }
        action={
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
        }
      >
        {typed !== null ? (
          <dl className="grid gap-2 rounded-lg border p-3" aria-label="Deposit receipt" data-testid="deposit-receipt">
            <SummaryRow label="From">{address ? `Your wallet (${shortAddress(address)})` : "Your wallet"}</SummaryRow>
            <SummaryRow label="To">Intatto USDG vault</SummaryRow>
            <SummaryRow label="Lent to">{lentTo}</SummaryRow>
            <SummaryRow label="Supply rate">
              <span className="text-success-foreground">{bpsText(rate)}</span>
            </SummaryRow>
            <SummaryRow label="You receive">
              ≈ <TokenAmount value={previewShares(typed, vault)} decimals={USDG_DECIMALS} maxFractionDigits={6} symbol={SHARE_SYMBOL} />
            </SummaryRow>
          </dl>
        ) : null}
      </ReviewDialog>
    </div>
  )
}
