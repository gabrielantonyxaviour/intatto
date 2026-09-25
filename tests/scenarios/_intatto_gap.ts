/** Sandbox replay journey; every waterfall number comes from receipts and contract reads. */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { erc20Abi, parseEventLogs, type Address } from 'viem'
import { boundedLiquidatorAbi, collateralMarketAbi, gapReserveAbi } from '@intatto/config/abi'
import type { StepArgs } from './_abel'
import * as I from './_intatto'
import * as SB from './_intatto_sandbox'
import { acceptPrimer, deficitMatches } from './_intatto_lend'
const {expect}=I
type Page=StepArgs['page']
const borrower='0x0000000000000000000000000000000000005Ce7' as Address
const logs=async()=>{const {client,d,s}=await SB.sessionChain();return client.getContractEvents({address:d.liquidator as Address,abi:boundedLiquidatorAbi,eventName:'SliceExecuted',fromBlock:BigInt(s.forkBlock),toBlock:'latest'})}
async function provenance(page:Page,name:'gap-2025-01'|'synthetic-gap',file:string) {
  await page.getByRole('button',{name:'View ledger',exact:true}).click()
  const entries=await SB.ledgerMatchesApi(page), e=entries.find(e=>e.summary.startsWith(`scenario ${name} started:`))!
  expect(e).toBeDefined()
  const detail=e.detail as {fileSha256:string;sources:{url:string;retrievedAt:string;sha256:string}[];kind:string}
  expect(detail.fileSha256).toBe(createHash('sha256').update(readFileSync(new URL(`../../data/replays/${file}`,import.meta.url))).digest('hex'))
  const replay=JSON.parse(readFileSync(new URL(`../../data/replays/${file}`,import.meta.url),'utf8'))
  expect(detail.sources).toEqual(replay.sources.map(({url,retrievedAt,sha256}: {url:string;retrievedAt:string;sha256:string})=>({url,retrievedAt,sha256})))
  if(name==='gap-2025-01') expect(detail.sources.length).toBeGreaterThan(0)
  const row=page.getByTestId('ledger-row').filter({hasText:e.summary})
  for(const src of detail.sources) {
    expect(src.sha256).toMatch(/^[a-f0-9]{64}$/);expect(Number.isNaN(Date.parse(src.retrievedAt))).toBe(false)
    await expect(row).toContainText(src.url);await expect(row).toContainText(`${src.sha256.slice(0,10)}…${src.sha256.slice(-6)}`)
  }
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('ledger')).not.toBeVisible()
  return {entries,detail}
}
export async function january(page:Page) {
  await SB.startSessionOnScreen(page)
  const {L}=await SB.sessionChain();I.journey.gapBefore=await L.vault();I.journey.gapStart=await logs()
  await expect(page.getByTestId('scenario-gap-2025-01')).toContainText('CFD')
  await expect(page.getByTestId('scenario-gap-2025-01')).toContainText('Dukascopy')
  const r=await SB.adminAction(page,'Replay the January 2025 gap','scenario');expect(r.status).toBe(200)
  const {entries,detail}=await provenance(page,'gap-2025-01','nvda-2025-01-gap.json')
  const finished=entries.find(e=>e.summary.startsWith('gap replay finished:'))!
  expect(Number(finished.detail!.openGapBps)).toBeGreaterThan(1200);expect(Number(finished.detail!.openGapBps)).toBeLessThan(1300)
  I.observe('chk_gap_cfd_label','January replay explicitly labelled Dukascopy CFD counterfactual, not historical X Layer liquidity')
  I.observe('chk_gap_ledger_provenance',`Ledger source URLs, retrieval timestamps and SHA256 match replay file ${detail.fileSha256}; Monday open ${finished.detail!.openGapBps} bps down`)
  I.observeCall('int_gap_replay_jan',`HTTP ${r.status}; replay completed, ledger reports ${JSON.stringify(finished.detail)}`)
  const a=await L.account(borrower),m=await L.market(),v=await L.vault(),before=I.journey.gapBefore as I.LensVault
  expect(a.debt).toBeGreaterThan(0n);expect(a.ltvBps).toBeLessThan(m.liquidationThresholdBps)
  expect((await logs()).length).toBe((I.journey.gapStart as unknown[]).length)
  expect(v.reserveBalance).toBe(before.reserveBalance);expect(v.totalDeficit).toBe(before.totalDeficit)
  await SB.go(page,'Risk');await page.getByRole('navigation',{name:'Risk analyses'}).getByRole('link',{name:'Liquidations',exact:true}).click()
  await expect(page.getByText('No liquidation has run in the scanned blocks.')).toBeVisible({timeout:120_000})
  I.observe('chk_gap_jan_no_liquidation',`Scenario position debt ${a.debt}, LTV ${a.ltvBps} below ${m.liquidationThresholdBps}; zero new SliceExecuted events; Risk says no liquidation`)
  I.observe('chk_gap_jan_reserve_unchanged',`Reserve ${before.reserveBalance} → ${v.reserveBalance}; deficit ${before.totalDeficit} → ${v.totalDeficit}`)
  I.journey.gapJanuaryEnd=await logs();I.journey.gapSyntheticBefore=v
}
export async function synthetic(page:Page) {
  await SB.go(page,'Sandbox');await expect(page.getByTestId('scenario-synthetic-gap')).toContainText('Synthetic')
  await expect(page.getByTestId('scenario-synthetic-gap')).toContainText('45%')
  const r=await SB.adminAction(page,'Run a synthetic 45% gap','scenario');expect(r.status).toBe(200)
  const {detail}=await provenance(page,'synthetic-gap','synthetic-gap.json')
  expect(detail.kind.toLowerCase()).toContain('synthetic')
  expect((await logs()).length).toBeGreaterThan((I.journey.gapJanuaryEnd as unknown[]).length)
  I.observe('chk_gap_synthetic_label',`Synthetic 45% replay labelled on screen and ledger; no external market sources, matching synthetic fixture; file sha256 ${detail.fileSha256}; new liquidation events`)
  I.observeCall('int_gap_replay_synthetic','POST sandbox scenario returned 200; synthetic replay completed with actual liquidation receipts')
  await I.edge('ec_gap_synthetic_label',async()=>`Synthetic 45% label and provenance verified on Sandbox and ledger (${detail.kind})`)
}
export async function slices(page:Page) {
  const {client,d,nvda,L}=await SB.sessionChain(), events=await logs(),m=await L.market()
  expect(events.length).toBeGreaterThan(0)
  await SB.go(page,'Risk');await page.getByRole('navigation',{name:'Risk analyses'}).getByRole('link',{name:'Liquidations',exact:true}).click()
  const seen:string[]=[]
  for(const ev of events) {
    const a=ev.args, receipt=await client.getTransactionReceipt({hash:ev.transactionHash})
    expect(receipt.status).toBe('success');expect(a.proceeds!).toBeGreaterThanOrEqual(a.sharesSold!*a.floorPrice!/10n**18n)
    // The contract depth cap applies in CLOSED only; OPEN can close the whole position.
    if(a.session===3) expect(a.sharesSold!*a.oraclePrice!/10n**18n).toBeLessThanOrEqual(m.sliceUsdg)
    const row=page.locator(`[data-row="slice"][data-tx-hash="${ev.transactionHash}"]:visible`)
    await expect(row).toContainText(I.wnvdax(a.sharesSold!),{timeout:120_000})
    await expect(row).toContainText(I.usdg(a.proceeds!))
    await expect(row).toContainText(`${I.usdg(a.oraclePrice!).replace(' USDG','')} USDG/share`)
    seen.push(`${ev.transactionHash}: sold ${a.sharesSold}, proceeds ${a.proceeds}, floor ${a.floorPrice}, session ${a.session}`)
  }
  const pos=await client.readContract({address:nvda.market as Address,abi:collateralMarketAbi,functionName:'positionOf',args:[borrower]})
  expect(pos).toEqual([0n,0n])
  I.observe('chk_gap_slices_bounded',seen.join('; '));I.observe('chk_gap_position_closed',`positionOf(${borrower})=[0,0]; January had zero slices; synthetic closed position`)
  I.observeCall('int_gap_slices',`${events.length} mined successful receipts; minimum proceeds satisfied; CLOSED slice limits checked`,events.at(-1)!.transactionHash)
}
export async function reserve(page:Page) {
  const {client,d,nvda,s,L}=await SB.sessionChain(),fromBlock=BigInt(s.forkBlock)
  const settlements=await client.getContractEvents({address:nvda.market as Address,abi:collateralMarketAbi,eventName:'LiquidationSettled',args:{borrower},fromBlock,toBlock:'latest'})
  const covers=await client.getContractEvents({address:d.gapReserve as Address,abi:gapReserveAbi,eventName:'ShortfallCovered',fromBlock,toBlock:'latest'})
  expect(covers.length).toBeGreaterThan(0)
  let covered=0n,deficit=0n
  for(const e of settlements){const a=e.args;expect(a.repaid!).toBeLessThanOrEqual(a.proceeds!);covered+=a.reserveCovered!;deficit+=a.deficit!}
  expect(covered).toBe(covers.reduce((n,e)=>n+e.args.covered!,0n));expect(deficit).toBeGreaterThan(0n)
  for(const e of covers){
    let available=await client.readContract({address:d.gapReserve as Address,abi:gapReserveAbi,functionName:'balance',blockNumber:e.blockNumber-1n})
    const receipt=await client.getTransactionReceipt({hash:e.transactionHash})
    const transfers=parseEventLogs({abi:erc20Abi,eventName:'Transfer',logs:receipt.logs.filter(l=>l.address.toLowerCase()===d.usdg.toLowerCase()&&l.logIndex<e.logIndex)})
    for(const t of transfers){if(t.args.to.toLowerCase()===d.gapReserve.toLowerCase())available+=t.args.value;if(t.args.from.toLowerCase()===d.gapReserve.toLowerCase())available-=t.args.value}
    // cover() emits after transferring; restore that outgoing amount to get the actual pre-cover balance.
    available+=e.args.covered!
    expect(e.args.covered).toBe(e.args.requested!<available?e.args.requested!:available)
  }
  const v=await L.vault();expect(v.totalDeficit).toBe(deficit)
  await expect(page.getByRole('region',{name:'Liquidations',exact:true})).toContainText(`${I.usdg(covered)} · ${I.usdg(deficit)}`)
  await expect(page.getByRole('region',{name:'Liquidations',exact:true})).toContainText(I.usdg(v.reserveBalance))
  I.observe('chk_gap_reserve_paid',`Settlement events: proceeds repay debt; reserve covers ${covered} (min(requested, balance including same-transaction funding)); remainder ${deficit} equals totalDeficit; reserve now ${v.reserveBalance}; Risk matches`)
}
export async function lend(page:Page) {
  const {client,d,s}=await SB.sessionChain()
  await SB.go(page,'Lend');await acceptPrimer(page)
  const actual=await deficitMatches(page,client as never,d.vault as Address,BigInt(s.forkBlock))
  I.observe('chk_gap_deficit_amount',actual);I.observe('chk_gap_share_value',actual)
  await I.edge('ec_gap_closed_floor',async()=> (await import('./_intatto_floor')).closedFloor())
}
