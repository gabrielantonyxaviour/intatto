/** Fork proof through the real sandbox UI and independent reads from both RPCs. */
import { createPublicClient, http, fallback, keccak256, pad, toHex, erc20Abi, type Address } from 'viem'
import { xlayerRpcUrls, TICKERS, XLAYER } from '@intatto/config/xlayer'
import { readFileSync } from 'node:fs'
import type { StepArgs } from './_abel'
import * as I from './_intatto'
import * as SB from './_intatto_sandbox'
const {expect}=I
type Page=StepArgs['page']
const ids=['blocks','bytecode','state','intatto'] as const
export async function settled(page:Page){
  await expect(page.locator('[data-check]')).toHaveCount(4,{timeout:120_000})
  await expect(page.locator('[data-slot="rerun"]')).toBeEnabled({timeout:240_000})
  return Object.fromEntries(await Promise.all(ids.map(async id=>[id,await page.locator(`[data-check="${id}"]`).getAttribute('data-status')])))
}
async function rerun(page:Page){await page.getByRole('button',{name:'Re-run checks'}).click();return settled(page)}
export async function open(page:Page){
  await SB.startSessionOnScreen(page)
  const {s,client}=await SB.sessionChain()
  const calls:string[]=[];I.journey.proofCalls=calls
  page.on('request',r=>{if(r.method()==='POST')calls.push(r.url())})
  expect(await client.getChainId()).toBe(s.chainId)
  await expect(page.getByTestId('identity-fork-block')).toContainText(s.forkBlock.toLocaleString('en-US'))
  await page.getByRole('link',{name:'Prove this is a real fork',exact:true}).click()
  await expect(page).toHaveURL(/\/sandbox\/proof$/)
  await expect(page.getByRole('heading',{name:'Fork proof',exact:true})).toBeVisible()
  I.observe('chk_proof_link',`Sandbox displays fork block ${s.forkBlock}; link opens /sandbox/proof; session eth_chainId=${s.chainId}`)
}
export async function checks(page:Page){
  expect(await settled(page)).toEqual({blocks:'pass',bytecode:'pass',state:'pass',intatto:'pass'})
  const calls=I.journey.proofCalls as string[],{s}=await SB.sessionChain()
  expect(calls.some(u=>u.startsWith(s.rpcUrl))).toBe(true)
  expect(calls.some(u=>xlayerRpcUrls().some(r=>u.startsWith(r)))).toBe(true)
  for(const [id,check] of [['blocks','chk_proof_block_hashes'],['bytecode','chk_proof_bytecode'],['state','chk_proof_state'],['intatto','chk_proof_close_guard_bytecode']] as const)
    I.observe(check,`Browser's ${id} check passed; direct browser RPC POSTs observed to sandbox ${s.rpcUrl} and X Layer`)
  I.observeCall('int_proof_mainnet_rpc','Observed browser-originated POSTs to public X Layer RPC; all proof checks pass')
  I.observeCall('int_proof_sandbox_rpc',`Observed browser-originated POSTs to ${s.rpcUrl}; all proof checks pass`)
}
export async function raw(page:Page){
  const {s,client,d}=await SB.sessionChain(),blockNumber=BigInt(s.forkBlock)
  const ref=createPublicClient({transport:fallback(xlayerRpcUrls().map(u=>http(u)))})
  for(const n of [blockNumber,blockNumber-1n]){
    const [a,b]=await Promise.all([ref.getBlock({blockNumber:n}),client.getBlock({blockNumber:n})]);expect(a.hash).toBe(b.hash)
    await expect(page.locator(`[data-check="blocks"] [data-row="block-${n}"]`)).toContainText(a.hash!)
  }
  const token=TICKERS.NVDAx.token,usdg=XLAYER.usdg
  const [a,b]=await Promise.all([ref.getCode({address:token,blockNumber}),client.getCode({address:token})])
  expect(a).toBe(b)
  const codeRow=page.locator(`[data-check="bytecode"] [data-row="${token}"]`)
  await expect(codeRow).toContainText(keccak256(a!));await expect(codeRow).toHaveAttribute('data-equal','true')
  const [supply,word,wordRef]=await Promise.all([client.readContract({address:usdg,abi:erc20Abi,functionName:'totalSupply'}),client.getStorageAt({address:usdg,slot:'0x2'}),ref.getStorageAt({address:usdg,slot:'0x2',blockNumber})])
  expect(word).toBe(wordRef);expect(word).toBe(pad(toHex(supply)))
  const sr=page.locator('[data-check="state"] [data-row="u.usdg.supply"]')
  await expect(sr.locator('[data-diff="equal"]')).toContainText('= on both')
  await expect(sr.locator('[data-diff="equal"]')).toContainText(word!)
  const live=JSON.parse(readFileSync(new URL('../../deployments/xlayer-mainnet.json',import.meta.url),'utf8'))
  const [lensCode,liveCode]=await Promise.all([client.getCode({address:d.lens as Address}),ref.getCode({address:live.lens})])
  expect(keccak256(lensCode!)).toBe(keccak256(liveCode!))
  await expect(page.locator('[data-check="intatto"] [data-row="lens"]')).toContainText(keccak256(lensCode!))
  I.observe('chk_proof_raw_values',`Independent RPC reads verify block hashes at ${blockNumber}/${blockNumber-1n}, NVDAx code ${keccak256(a!)}, USDG supply ${supply} and storage ${word}, MarketLens code ${keccak256(lensCode!)}; both sides shown in raw rows`)
}
export async function commands(page:Page){
  const {s}=await SB.sessionChain(),entries=await SB.ledgerOf(s.sessionId),ledger=page.locator('[data-slot="ledger"]')
  await expect(ledger).toHaveAttribute('data-ledger','ok')
  for(const e of entries)await expect(ledger).toContainText(e.summary)
  await expect(page.getByRole('button',{name:'Copy sandbox RPC URL'})).toBeVisible()
  await expect(page.getByText(s.rpcUrl,{exact:true})).toBeVisible()
  await expect(page.getByText(`anvil --fork-url https://xlayerrpc.okx.com --fork-block-number ${s.forkBlock} --chain-id 1960196`,{exact:true})).toBeVisible()
  await expect(page.getByText('Time after the fork block is a simulation',{exact:true})).toBeVisible()
  for(const id of ids){const check=page.locator(`[data-check="${id}"]`);await check.getByText('Reproduce with cast',{exact:true}).click();await expect(check.locator('[data-slot="command-block"]')).toContainText('cast ')}
  I.observe('chk_proof_ledger',`Divergence ledger equals all ${entries.length} entries from session API`)
  I.observe('chk_proof_commands',`RPC ${s.rpcUrl}, fork-block anvil reproduction, copy buttons, four cast command sections and simulation note visible`)
  await I.edge('ec_proof_altered_slot',async()=>{
    // The session's public RPC deliberately refuses admin methods. Own isolated fork for this mutation.
    const {startForkHarness}=await import('../../checks/fork/harness.ts'),h=await startForkHarness()
    try {
      const stored={sessionId:'proof-tamper',apiUrl:'',rpcUrl:h.env.rpcUrl,chainId:h.env.chainId,forkBlock:h.env.forkBlock,deployment:h.deployment,burnerKey:h.env.burnerKey}
      await page.evaluate(v=>localStorage.setItem('intatto:sandbox',v),JSON.stringify(stored));await page.reload()
      expect((await settled(page)).state).toBe('pass')
      const old=(await h.fork.client.getStorageAt({address:XLAYER.usdg,slot:'0x2'}))!,next=pad(toHex(BigInt(old)+1n))
      await h.fork.request('anvil_setStorageAt',[XLAYER.usdg,'0x2',next])
      expect((await rerun(page)).state).toBe('fail')
      const row=page.locator('[data-check="state"] [data-row="u.usdg.supply"]')
      await expect(row.locator('[data-side="old"]')).toContainText(old);await expect(row.locator('[data-side="new"]')).toContainText(next)
      return `Owned isolated fork: USDG supply slot ${old} → ${next}; state check red, both values shown; no public admin bypass`
    } finally {await h.stop();await page.evaluate(v=>localStorage.setItem('intatto:sandbox',v),JSON.stringify(s));await page.reload()}
  })
  await I.edge('ec_proof_rpc_unreachable',async()=>{
    await page.goto(`/sandbox/proof?rpc=${encodeURIComponent('http://127.0.0.1:9')}&block=${s.forkBlock}`)
    expect(await settled(page)).toEqual({blocks:'unreachable',bytecode:'unreachable',state:'unreachable',intatto:'unreachable'})
    await expect(page.locator('[data-slot="unreachable"]').first()).toContainText('sandbox RPC')
    return 'Unreachable sandbox RPC named explicitly; all four checks unreachable, none passing'
  })
}
