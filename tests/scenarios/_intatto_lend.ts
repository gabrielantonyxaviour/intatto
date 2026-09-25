/** Lender rehearsal: real UI transactions and direct reads on the isolated fork. */
import type { StepArgs } from './_abel'
import { erc20Abi, type Address, type Hex } from 'viem'
import { lendingVaultAbi, marketLensAbi, collateralMarketAbi } from '@intatto/config/abi'
import * as I from './_intatto'
import { usdg, sharePriceText, sharePriceNumber, lossExample } from '../../web/components/lend/lend-format.ts'
import { usdg as marketUsdg } from '../../web/components/market/format.ts'
import { formatTokenAmount } from '../../web/components/ui/web3/format.ts'
import { SANDBOX_LENDER } from '../../checks/fork/harness.ts'
import { openAtWeekdayLimit, gapReplay, syntheticGap } from '../../checks/fork/lib/scenarios.ts'
import { readFileSync } from 'node:fs'
const { expect } = I
type Page = StepArgs['page']
const access = async () => {
  const h = I.forkAccess()
  return { ...h, L: await I.lens(h.fork.client as never, h.d, h.f.burnerAddress) }
}
const read = async <T>(fn: string, args: unknown[] = []) => {
  const { fork, d } = I.forkAccess()
  return fork.read<T>(d.vault as Address, lendingVaultAbi, fn, args)
}
async function position(page: Page) {
  const { f, L } = await access(), shares = await read<bigint>('balanceOf', [f.burnerAddress])
  const value = await read<bigint>('convertToAssets', [shares])
  await expect(page.getByTestId('position-shares')).toHaveText(`${formatTokenAmount(shares, 6, { maxFractionDigits: 6 })} iUSDG`)
  await expect(page.getByTestId('position-value')).toHaveText(usdg(value, 6))
  await expect(page.getByTestId('position-wallet')).toHaveText(usdg((await L.account()).walletUsdg))
  return { shares, value }
}
export async function acceptPrimer(page: Page) {
  const primer = page.getByTestId('lend-primer')
  await expect(primer).toBeVisible({ timeout: 120_000 })
  await expect(primer.getByRole('button', { name: 'Continue' })).toBeDisabled()
  await primer.getByRole('checkbox').click()
  await primer.getByRole('button', { name: 'Continue' }).click()
  await expect(primer).toBeHidden()
}
export async function connect(page: Page) {
  const { f, d, fork, L } = await access()
  await I.seedSandbox(page, { sessionId: 'local-check', apiUrl: '', rpcUrl: f.rpcUrl, chainId: f.chainId, forkBlock: f.forkBlock, deployment: d, burnerKey: f.burnerKey })
  await page.goto('/')
  await expect(page.getByTestId('your-info-connected')).toBeVisible({ timeout: 120_000 })
  await expect(page.getByRole('button', { name: `Account ${f.burnerAddress}` })).toBeVisible()
  expect(await fork.client.getChainId()).toBe(f.chainId)
  const v = await L.vault()
  let debt = 0n
  for (const m of d.markets) {
    const s = await fork.read<{totalDebt: bigint}>(d.lens as Address, marketLensAbi, 'market', [m.market]); debt += s.totalDebt
  }
  for (const [id, value] of [['deposits', marketUsdg(v.totalAssets)], ['loans', marketUsdg(debt)], ['utilisation', I.pct(v.utilizationBps)], ['reserve', marketUsdg(v.reserveBalance)]] as const)
    await expect(page.getByTestId(`stat-${id}`).locator('[data-slot=value]')).toHaveText(value)
  await expect(page.getByTestId('market-row-USDG')).toContainText(I.pct(v.supplyRateBps))
  I.observe('chk_lend_market_vault_numbers', `Fork of X Layer 196, chain ${f.chainId}, connected burner; deposits ${v.totalAssets}, debt ${debt}, utilisation ${v.utilizationBps} bps, supply ${v.supplyRateBps} bps, reserve ${v.reserveBalance} all match RPC`)
  I.observeCall('int_lend_wallet', `Isolated fork burner ${f.burnerAddress}; eth_chainId ${f.chainId}; nonce ${await fork.client.getTransactionCount({address:f.burnerAddress})}; no mainnet signing`)
}
export async function open(page: Page) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Lend', exact: true }).click()
  await acceptPrimer(page)
  const { L } = await access(), v = await L.vault()
  expect((await position(page)).shares).toBe(0n)
  await expect(page.getByTestId('rate-supply')).toHaveText(I.pct(v.supplyRateBps))
  await expect(page.getByTestId('rate-utilisation')).toHaveText(I.pct(v.utilizationBps))
  await expect(page.getByTestId('reserve-balance')).toHaveText(usdg(v.reserveBalance))
  I.observe('chk_lend_open', `No vault shares; wallet ${(await L.account()).walletUsdg} USDG units; supply ${v.supplyRateBps} bps, utilisation ${v.utilizationBps} bps and reserve ${v.reserveBalance} match chain`)
}
async function clearToasts(page: Page) {
  await page.mouse.move(1, 1)
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 20_000 })
}
export async function deposit(page: Page) {
  const { fork, f, L, d } = await access(), before = await L.account()
  const form = page.getByTestId('deposit-form')
  await form.getByLabel('Deposit USDG').fill('250')
  await form.getByRole('button', { name: 'Review', exact: true }).click()
  const review = page.getByTestId('lend-deposit-review')
  await I.watchTxLinks(page, 'lend-deposit-review')
  await review.getByRole('button', { name: 'Approve USDG', exact: true }).click()
  const button = review.getByRole('button', { name: 'Deposit USDG', exact: true })
  await expect(button).toBeEnabled({ timeout: 60_000 })
  await clearToasts(page); await button.click()
  await expect(review.getByText(/Confirmed/)).toBeVisible({ timeout: 60_000 })
  const hash = await I.txHashIn(page, '[data-testid="lend-deposit-review"]')
  await page.keyboard.press('Escape')
  const receipt = await fork.client.getTransactionReceipt({ hash })
  expect(receipt.status).toBe('success'); expect(receipt.to?.toLowerCase()).toBe(d.vault.toLowerCase())
  expect(before.walletUsdg - (await L.account()).walletUsdg).toBe(250_000_000n)
  const p = await position(page); expect(p.shares).toBeGreaterThan(0n); expect(p.value).toBeGreaterThanOrEqual(249_999_999n)
  const links = await I.seenTxLinks(page); expect(links).toContain(hash)
  I.observe('chk_lend_deposit_tx', `Deposit 250 USDG confirmed in fork receipt ${hash}; displayed transaction hash; wallet debited 250 USDG`)
  I.observe('chk_lend_shares', `${f.burnerAddress} owns ${p.shares} iUSDG units worth ${p.value} USDG units, UI equals balanceOf/convertToAssets`)
  I.observeCall('int_lend_deposit', `Vault deposit confirmed at block ${receipt.blockNumber}`, hash)
}
export async function risk(page: Page) {
  const { L, fork, d, nvda } = await access(), v = await L.vault()
  const m = await fork.read<{totalCollateralValue:bigint}>(d.lens as Address, marketLensAbi, 'market', [nvda.market])
  for (const [id, val] of [['rate-supply', I.pct(v.supplyRateBps)], ['rate-borrow', I.pct(v.borrowRateBps)], ['rate-utilisation', I.pct(v.utilizationBps)], ['share-price', sharePriceText(v.sharePrice)], ['reserve-balance', usdg(v.reserveBalance)]] as const)
    await expect(page.getByTestId(id)).toHaveText(val)
  expect(v.totalDeficit).toBe(0n)
  await expect(page.getByTestId('loss-disclosure')).toContainText('Lenders can lose money')
  await page.getByRole('button', { name: 'Risk and reserve', exact: true }).click()
  for (const [id, val] of [['waterfall-reserve', usdg(v.reserveBalance)], ['waterfall-lenders', usdg(v.totalAssets)], ['waterfall-collateral', usdg(m.totalCollateralValue)], ['loss-example', lossExample(v.totalAssets)]] as const)
    await expect(page.getByTestId(id)).toHaveText(val)
  await expect(page.getByTestId('lend-risk-sheet')).toContainText('20% of all interest borrowers pay')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Deficits', exact: true }).click()
  await expect(page.getByTestId('deficits-empty')).toContainText('No deficits recognised')
  await page.keyboard.press('Escape')
  expect(await fork.read<bigint>(nvda.market as Address, collateralMarketAbi, 'RESERVE_FACTOR_BPS')).toBe(2_000n)
  I.observe('chk_lend_numbers_match', `Vault rates, utilization, shares, reserve, collateral and lender waterfall match lens; deficit ${v.totalDeficit}; reserve factor 2000 bps`)
  I.observe('chk_lend_loss_warning', 'Visible loss disclosure: lenders can lose money; reserve then pro-rata share losses; dynamic loss example equals vault assets')
}
export async function withdraw(page: Page) {
  const { L, fork, d, f } = await access(), before = await L.account(), shares = await read<bigint>('balanceOf', [f.burnerAddress])
  await clearToasts(page); await page.getByRole('tab', { name: 'Withdraw', exact: true }).click()
  const form = page.getByTestId('withdraw-form')
  await form.getByLabel('Withdraw USDG').fill('100')
  await form.getByRole('button', { name: 'Review', exact: true }).click()
  const review = page.getByTestId('lend-withdraw-review')
  await review.getByRole('button', { name: 'Withdraw USDG', exact: true }).click()
  await expect(review.getByText(/Confirmed/)).toBeVisible({ timeout:60_000 })
  const hash = await I.txHashIn(page, '[data-testid="lend-withdraw-review"]'), r = await fork.client.getTransactionReceipt({hash})
  await page.keyboard.press('Escape')
  expect(r.status).toBe('success'); expect(r.to?.toLowerCase()).toBe(d.vault.toLowerCase())
  const p = await position(page); expect(p.shares).toBeLessThan(shares)
  expect((await L.account()).walletUsdg-before.walletUsdg).toBe(100_000_000n)
  I.observe('chk_lend_withdraw_tx', `Confirmed ${hash}; shares ${shares} → ${p.shares}; wallet +100 USDG; remaining value ${p.value}`)
  I.observeCall('int_lend_withdraw', `Withdrawal receipt success at block ${r.blockNumber}`, hash)
  await I.edge('ec_lend_withdraw_limited', async () => {
    await openAtWeekdayLimit(I.forkAccess().ctx, '0x0000000000000000000000000000000000005ce7', 20n*10n**18n)
    const taken = (await read<bigint>('idle')) - 60_000_000n
    await fork.write(SANDBOX_LENDER, d.vault as Address, lendingVaultAbi, 'withdraw', [taken, SANDBOX_LENDER, SANDBOX_LENDER], 1_500_000n)
    try {
      await page.reload(); await page.getByRole('tab', { name:'Withdraw', exact:true }).click()
      await form.getByLabel('Withdraw USDG').fill('150')
      await expect(form.getByText('Only 60.00 USDG is idle; the rest is lent out.')).toBeVisible()
      await expect(form.getByRole('button', {name:'Only 60.00 USDG is idle'})).toBeDisabled()
      await form.getByRole('button', {name:'Max', exact:true}).click()
      await expect(form.getByLabel('Withdraw USDG')).toHaveValue('60')
      expect(await read<bigint>('idle')).toBe(60_000_000n)
      return 'Withdrawal limited to actual idle 60 USDG, Max=60 and disabled reason shown'
    } finally { await fork.write(SANDBOX_LENDER, d.vault as Address, lendingVaultAbi, 'deposit', [taken, SANDBOX_LENDER], 1_500_000n) }
  })
  await I.edge('ec_lend_deficit_history', async () => {
    const {ctx} = I.forkAccess(), load = (name:string) => JSON.parse(readFileSync(new URL(`../../data/replays/${name}.json`,import.meta.url),'utf8'))
    await gapReplay(ctx, load('nvda-2025-01-gap')); await syntheticGap(ctx, load('synthetic-gap'))
    await page.reload()
    return deficitMatches(page, fork.client, d.vault as Address, BigInt(f.forkBlock))
  })
}
export async function deficitMatches(page: Page, client: ReturnType<typeof I.forkAccess>['fork']['client'], vault: Address, fromBlock: bigint) {
  const logs = await client.getContractEvents({address:vault, abi:lendingVaultAbi, eventName:'DeficitRecognised', fromBlock, toBlock:'latest'})
  expect(logs.length, 'DeficitRecognised emitted').toBeGreaterThan(0)
  const a = logs.at(-1)!.args
  expect(a.sharePriceAfter!).toBeLessThan(a.sharePriceBefore!)
  await page.getByRole('button', { name: 'Deficits', exact: true }).click()
  await expect(page.getByTestId('deficit-amount').first()).toHaveText(usdg(a.amount!,6),{timeout:120_000})
  await expect(page.getByTestId('deficit-price').first()).toHaveText(`${sharePriceNumber(a.sharePriceBefore!)} → ${sharePriceNumber(a.sharePriceAfter!)}`)
  await page.keyboard.press('Escape')
  const price = await client.readContract({address:vault,abi:lendingVaultAbi,functionName:'sharePrice'})
  const total = await client.readContract({address:vault,abi:lendingVaultAbi,functionName:'totalDeficit'})
  await expect(page.getByTestId('share-price')).toHaveText(sharePriceText(price))
  await expect(page.getByTestId('deficit-total')).toHaveText(usdg(total,6))
  return `Deficit ${a.amount} at ${logs.at(-1)!.transactionHash}; share price ${a.sharePriceBefore} → ${a.sharePriceAfter}; UI matches event and vault total ${total}`
}
