/** CLOSED-floor failure path on an owned isolated fork; no mainnet transaction. */
import {parseAbi,type Address} from 'viem'
import {boundedLiquidatorAbi} from '@intatto/config/abi'
import {startForkHarness} from '../../checks/fork/harness.ts'
import {openAtWeekdayLimit,stepDown,weekend,keeperTick,liquidateWatched} from '../../checks/fork/lib/scenarios.ts'
import {arbitrageDown} from '../../checks/fork/lib/actors.ts'
import {mondayOpenAfter} from '../../checks/fork/lib/clock.ts'
import {expect} from './_intatto'
export async function closedFloor(){
  const h=await startForkHarness(),who='0x0000000000000000000000000000000000005cE8' as Address
  try {
    const m=h.deployment.markets.find(m=>m.symbol==='NVDAx')!,liquidator=h.deployment.liquidator as Address
    await openAtWeekdayLimit(h.ctx,who,20n*10n**18n)
    await stepDown(h.ctx,3500,'closed floor edge: make the position unhealthy')
    const {close}=await weekend(h.ctx)
    await h.ctx.keeper.cap(50_000n*10n**6n,1_000n*10n**6n) // Fresh deployments have no CLOSED slice posted yet.
    await arbitrageDown(h.fork,1000) // Move spot below the fresh CLOSED floor; keep the next quote inside the 15% move guard.
    const plan=await h.fork.client.readContract({address:liquidator,abi:boundedLiquidatorAbi,functionName:'previewSlice',args:[m.market as Address,who]})
    expect(Number(plan.session)).toBe(3);expect(plan.waiting).toBe(true)
    const position=()=>h.fork.client.readContract({address:m.market as Address,abi:parseAbi(['function positions(address) view returns (uint256 shares, uint256 debtShares)']),functionName:'positions',args:[who]})
    const before=await position()
    const hash=await h.ctx.keeper.liquidate(who),r=await h.fork.client.getTransactionReceipt({hash})
    const waiting=await h.fork.client.getContractEvents({address:liquidator,abi:boundedLiquidatorAbi,eventName:'SliceWaiting',fromBlock:r.blockNumber,toBlock:r.blockNumber})
    const sold=await h.fork.client.getContractEvents({address:liquidator,abi:boundedLiquidatorAbi,eventName:'SliceExecuted',fromBlock:r.blockNumber,toBlock:r.blockNumber})
    expect(waiting).toHaveLength(1);expect(sold).toHaveLength(0)
    expect(await position()).toEqual(before) // Debt shares stay fixed; debtOf can still grow as interest accrues.
    await h.fork.warpTo(mondayOpenAfter(close),'closed floor edge: reopen')
    expect((await keeperTick(h.ctx)).accepted).toBe(true)
    const filled=await liquidateWatched(h.ctx,12);expect(filled.length).toBeGreaterThan(0)
    const start=(await h.fork.client.getTransactionReceipt({hash:filled[0]!})).blockNumber
    const events=await h.fork.client.getContractEvents({address:liquidator,abi:boundedLiquidatorAbi,eventName:'SliceExecuted',fromBlock:start,toBlock:'latest'})
    expect(events.length).toBeGreaterThan(0)
    for(const e of events){expect(Number(e.args.session)).toBe(1);expect(e.args.proceeds!).toBeGreaterThanOrEqual(e.args.sharesSold!*e.args.floorPrice!/10n**18n)}
    return `Owned isolated fork: CLOSED preview waiting at floor ${plan.floorPrice}; ${hash} emitted SliceWaiting and no SliceExecuted; collateral and debt shares unchanged. After Monday OPEN, ${events.length} slice(s) met minimum output.`
  } finally {await h.stop()}
}
