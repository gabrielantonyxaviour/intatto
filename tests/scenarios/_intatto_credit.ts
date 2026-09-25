/** Public live credit endpoint: schema, independent block-pinned RPC reads, and Agents UI. No signing. */
import { z } from 'zod'
import { formatUnits, getAddress, maxUint256, type Address } from 'viem'
import { marketLensAbi } from '@intatto/config/abi'
import { SESSIONS } from '@intatto/config/session'
import { mainnet } from './_intatto_live'
import { expect, observe, observeCall, edge, journey } from './_intatto'
import type { StepArgs } from './_abel'
const base = 'https://intatto.larinova.com'
const wallet = '0x7F23b131F7312bd0f63EF79974E215Dc3E12a415'
const amount = z.string().regex(/^\d+(\.\d+)?$/), timestamp = z.string().datetime().nullable()
const schema = z.object({
  service:z.literal('intatto-credit'),version:z.literal('1'),network:z.literal('mainnet'),chainId:z.literal(196),block:z.number().int().positive(),wallet:z.string().regex(/^0x[\da-fA-F]{40}$/),market:z.literal('NVDAx'),
  session:z.object({state:z.enum(['OPEN','EXTENDED','CLOSED','HALTED','CORPORATE_ACTION','UNKNOWN']),maxNewBorrowLtvBps:z.number().int(),periodChangedAt:timestamp,postedAt:timestamp}),
  price:z.object({usdPerToken:amount.nullable(),fetchedAt:timestamp,sourceTimestamp:z.null(),source:z.string().min(1)}),
  guards:z.object({fresh:z.boolean(),inBand:z.boolean(),pegOk:z.boolean(),corporateActionPaused:z.boolean(),issuerPaused:z.boolean()}),
  position:z.object({collateralTokens:amount,collateralWrapperShares:amount,valueUsdg:amount,debtUsdg:amount,ltvBps:z.number().nullable(),healthFactor:amount.nullable()}),
  capacity:z.object({borrowableNowUsdg:amount,limitBps:z.number().int(),reason:z.string().optional()}),
  liquidation:z.object({thresholdBps:z.number().int(),liquidationPriceUsd:amount.nullable(),gapToLiquidationBps:z.number().nullable(),liquidatableNow:z.boolean()}),asOf:z.string().datetime(),
}).strict()
type Report = z.infer<typeof schema>
type Page = StepArgs['page']
export async function call(page:Page) {
  const docs = await page.request.get(`${base}/api/credit`)
  expect(docs.status()).toBe(200)
  const desc = await docs.json()
  expect(desc).toMatchObject({service:'intatto-credit',method:'GET',price:'free'})
  expect(desc.parameters.wallet).toContain('required'); expect(desc.parameters.market).toContain('NVDAx')
  journey.creditDocs = desc
  await page.goto('/agents')
  await page.getByRole('link',{name:'Try it',exact:true}).click()
  await expect(page).toHaveURL(/\/agents\/credit$/)
  await page.getByLabel('Wallet',{exact:true}).fill(wallet)
  const pending = page.waitForResponse(r=>r.url().includes('/api/credit?')&&r.request().method()==='GET')
  await page.getByRole('button',{name:'Try it',exact:true}).click()
  const res = await pending; expect(res.status()).toBe(200)
  const json = schema.parse(await res.json()); journey.credit = json
  expect(json.wallet).toBe(getAddress(wallet))
  await uiMatches(page,json)
  observe('chk_agent_response_schema',`Live GET ${res.url()} returned HTTP 200; all documented report fields pass schema; browser displays response. Public no-parameter docs say GET wallet+market, free.`)
  observeCall('int_agent_call',`Live endpoint ${res.url()} answered at X Layer block ${json.block}; free call, no payment`)
  await edge('ec_agent_invalid_input',async()=>{
    for(const query of ['wallet=bad&market=NVDAx',`wallet=${wallet}&market=INVALID`]) {
      const r=await page.request.get(`${base}/api/credit?${query}`); expect(r.status()).toBe(400)
      const b=await r.json(); expect(Object.keys(b).sort()).toEqual(['code','error']); expect(typeof b.code).toBe('string'); expect(typeof b.error).toBe('string')
      expect(JSON.stringify(b)).not.toMatch(/stack|node_modules|SELECT\s|postgres|sqlite/i)
    }
    return 'Invalid wallet and invalid market each return HTTP 400 {error,code}, without a stack or database details'
  })
}
async function uiMatches(page:Page,j:Report) {
  for(const [id,value] of [['session',j.session.state],['debt',j.position.debtUsdg],['capacity',j.capacity.borrowableNowUsdg],['price',j.price.usdPerToken??'none'],['fetched',j.price.fetchedAt??'none'],['liq-price',j.liquidation.liquidationPriceUsd??'none'],['gap',j.liquidation.gapToLiquidationBps===null?'none':String(j.liquidation.gapToLiquidationBps)]] as const)
    await expect(page.getByTestId(`credit-${id}`)).toHaveText(value)
}
export async function chain(page:Page) {
  const j=journey.credit as Report, {d,nvda,client}=mainnet(), blockNumber=BigInt(j.block)
  const [a,m,v,b,chainId]=await Promise.all([
    client.readContract({address:d.lens as Address,abi:marketLensAbi,functionName:'account',args:[nvda.market as Address,wallet],blockNumber}),
    client.readContract({address:d.lens as Address,abi:marketLensAbi,functionName:'market',args:[nvda.market as Address],blockNumber}),
    client.readContract({address:d.lens as Address,abi:marketLensAbi,functionName:'vault',args:[nvda.market as Address],blockNumber}),
    client.getBlock({blockNumber}),client.getChainId(),
  ])
  const iso=(n:bigint)=>n===0n?null:new Date(Number(n)*1000).toISOString(), fmt=formatUnits
  expect(j.chainId).toBe(chainId); expect(j.asOf).toBe(iso(b.timestamp))
  expect(j.session).toEqual({state:SESSIONS[Number(m.session)],maxNewBorrowLtvBps:Number(m.maxLtvBps),periodChangedAt:iso(m.periodChangedAt),postedAt:iso(m.sessionPostedAt)})
  expect(j.price.usdPerToken).toBe(m.priceE18===0n?null:fmt(m.priceE18,18)); expect(j.price.fetchedAt).toBe(iso(m.fetchedAt)); expect(j.price.sourceTimestamp).toBeNull()
  expect(j.price.source).toContain('trusted relayer')
  expect(j.guards).toEqual({fresh:m.fresh,inBand:m.inBand,pegOk:m.pegOk,corporateActionPaused:m.corporateActionPaused,issuerPaused:m.issuerPaused})
  expect(j.position).toEqual({collateralTokens:fmt(a.assets,18),collateralWrapperShares:fmt(a.shares,18),valueUsdg:fmt(a.valueUsdg,6),debtUsdg:fmt(a.debt,6),ltvBps:a.ltvBps===maxUint256?null:Number(a.ltvBps),healthFactor:a.healthFactorE18===maxUint256?null:fmt(a.healthFactorE18,18)})
  const gap=a.debt===0n||m.priceE18===0n?null:a.assets===0n||a.liquidationPriceE18>=m.priceE18?0:Number((m.priceE18-a.liquidationPriceE18)*10000n/m.priceE18)
  expect(j.liquidation).toEqual({thresholdBps:Number(m.liquidationThresholdBps),liquidationPriceUsd:a.debt>0n&&a.assets>0n?fmt(a.liquidationPriceE18,18):null,gapToLiquidationBps:gap,liquidatableNow:a.liquidatable})
  const nextLtv=a.valueUsdg===0n?maxUint256:((a.debt+1n)*10000n+a.valueUsdg-1n)/a.valueUsdg
  const reason=m.issuerPaused?'IssuerPaused':Number(m.session)===0?'UnknownSession':nextLtv>m.maxLtvBps?'SessionLimit':!m.fresh?'StalePrice':!m.inBand?'PriceOutOfBand':m.corporateActionPaused?'CorporateActionPending':m.totalDebt+1n>m.capUsdg?'TickerCapReached':!m.pegOk?'UsdgOffPeg':v.idle<1n?'InsufficientLiquidity':undefined
  expect(j.capacity).toEqual({borrowableNowUsdg:fmt(reason?0n:a.borrowCapacity,6),limitBps:Number(m.maxLtvBps),...(reason?{reason}:{})})
  await uiMatches(page,j)
  observe('chk_agent_fields_match_chain',`Every session, position, capacity, guard, price/fetch, liquidation and asOf field equals direct RPC reads at the response block ${j.block}; gap ${gap}; no latest-block race`)
}
export async function screen(page:Page) {
  const j=journey.credit as Report
  await uiMatches(page,j); await expect(page.getByTestId('credit-call-count')).toHaveText('1')
  await expect(page.getByText('Stored in this browser only.')).toBeVisible()
  await expect(page.getByText('OKX AI listing: under review (agent #13907)')).toBeVisible()
  await expect(page.getByText('x402 on X Layer (eip155:196) after a real paid settlement is proven')).toBeVisible()
  observe('chk_agent_screen_call','Agents shows one local browser call and its actual live response; endpoint is free, so payment receipt is not applicable and no paid settlement is claimed')
  observe('chk_agent_listing_status','Agents explicitly shows OKX AI listing: under review (agent #13907)')
  await edge('ec_agent_listing_pending',async()=>{
    await expect(page.getByText('OKX AI listing: under review (agent #13907)')).toBeVisible()
    expect(await page.locator('body').innerText()).not.toMatch(/listing: listed|listing approved/i)
    return 'Listing under review shown; no approved/listed claim'
  })
}
