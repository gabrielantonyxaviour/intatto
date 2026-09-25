// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {CorporateActionGuard} from "../src/CorporateActionGuard.sol";
import {IXStock} from "../src/interfaces/external/IXStock.sol";
import {MockPriceSource} from "./mocks/MockControllers.sol";

/// Issuer-side calls of the real NVDAx (BackedAutoFeeTokenImplementation 1.1.0) used by the rehearsal.
interface IBackedMultiplierAdmin {
    function multiplierUpdater() external view returns (address);
    function lastTimeFeeApplied() external view returns (uint256);
    function periodLength() external view returns (uint256);
    function updateMultiplierValue(uint256 newMultiplier, uint256 oldMultiplier, uint256 activationTime) external;
    function transferShares(address to, uint256 sharesAmount) external returns (bool);
}

/// Runs against an X Layer mainnet fork (chain 196) and skips anywhere else:
/// forge test --root contracts --match-contract CorporateActionForkTest --fork-url "$XLAYER_RPC_URL"
contract CorporateActionForkTest is Test {
    address constant NVDAX = 0xc845b2894dBddd03858fd2D643B4eF725fE0849d;
    uint256 constant PRICE = 180e18;

    IXStock token = IXStock(NVDAX);
    MockPriceSource ps;
    CorporateActionGuard guard;
    address keeper = makeAddr("keeper");

    function setUp() public {
        if (block.chainid != 196 || NVDAX.code.length == 0) {
            vm.skip(true);
            return;
        }
        ps = new MockPriceSource(PRICE);
        guard = new CorporateActionGuard(keeper, token, ps);
    }

    /// guard.currentMultiplier() equals a raw eth_call of getCurrentMultiplier() at the fork block.
    function test_currentMultiplierMatchesEthCallAtForkBlock() public {
        string memory params = string.concat(
            '[{"to":"',
            vm.toString(NVDAX),
            '","data":"',
            vm.toString(abi.encodeCall(IXStock.getCurrentMultiplier, ())),
            '"},"',
            _hexQuantity(block.number),
            '"]'
        );
        (uint256 rpcMultiplier,,) = abi.decode(vm.rpc("eth_call", params), (uint256, uint256, uint256));
        (uint256 direct,,) = token.getCurrentMultiplier();
        assertGt(rpcMultiplier, 0);
        assertEq(guard.currentMultiplier(), rpcMultiplier);
        assertEq(direct, rpcMultiplier);
    }

    /// With no future onchain multiplier on the token, nothing is pending and the ticker is not paused.
    function test_notPausedWithoutPendingOnchainMultiplier() public view {
        uint256 at = token.newMultiplierActivationTime();
        if (at == 0) {
            assertFalse(guard.pendingAction().active);
            assertFalse(guard.isPaused());
            (uint64 start, uint64 activationAt) = guard.pauseWindow();
            assertEq(start + activationAt, 0);
            return;
        }
        // The issuer has a live schedule at this block: the guard must see it and pause only in its window.
        assertTrue(guard.pendingAction().active);
        assertEq(guard.pendingAction().expectedMultiplier, token.newMultiplier());
        bool inWindow = block.timestamp + guard.window() >= at && block.timestamp <= at;
        assertEq(guard.isPaused(), inWindow);
    }

    /// A 10-for-1 split scheduled on the REAL token by its multiplier updater, end to end.
    function test_realTokenScheduledSplitRehearsal() public {
        IBackedMultiplierAdmin admin = IBackedMultiplierAdmin(NVDAX);
        // The issuer can only schedule inside its current fee period; move to a fresh one if it ends soon.
        uint256 period = admin.periodLength();
        uint256 last = admin.lastTimeFeeApplied();
        uint256 periodEnd = last + ((block.timestamp - last) / period + 1) * period;
        if (periodEnd < block.timestamp + 3 hours) vm.warp(periodEnd + 1);

        (uint256 m0,,) = token.getCurrentMultiplier();
        uint256 m1 = m0 * 10;
        uint64 at = uint64(block.timestamp + 2 hours);
        vm.prank(admin.multiplierUpdater());
        admin.updateMultiplierValue(m1, m0, at);
        assertEq(token.newMultiplierActivationTime(), at);
        assertEq(guard.pendingAction().activationAt, at, "lazy view of the onchain schedule");

        vm.warp(at - guard.window() - 1);
        assertFalse(guard.isPaused(), "before the window");
        guard.captureOnchainAction();
        assertEq(guard.pendingAction().preActionMultiplier, m0);
        assertEq(guard.pendingAction().preActionPrice, PRICE);
        CorporateActionGuard uncaptured = new CorporateActionGuard(keeper, token, ps);

        vm.warp(at - guard.window());
        assertTrue(guard.isPaused(), "window opens");
        assertTrue(uncaptured.isPaused(), "window opens (lazy)");

        vm.warp(at + 60);
        assertEq(guard.currentMultiplier(), m1, "real multiplier switched at activation");
        assertTrue(guard.isPaused(), "after activation, no new price");

        // The token's first transfer after activation applies the schedule and zeroes its activation time.
        vm.prank(makeAddr("anyone"));
        admin.transferShares(makeAddr("anyoneElse"), 0);
        assertEq(token.newMultiplierActivationTime(), 0);
        // Why the keeper posts or captures: an uncaptured lazy action ends with the issuer's schedule.
        assertFalse(uncaptured.isPaused(), "lazy action gone once the issuer applies it");
        assertTrue(guard.isPaused(), "captured action persists");

        ps.setPrice(PRICE);
        assertTrue(guard.isPaused(), "stale pre-split quote after activation");
        ps.setPrice(PRICE / 10);
        assertFalse(guard.isPaused(), "consistent quote");
        guard.resolve();
        assertEq(guard.lastResolvedActivation(), at);
        assertFalse(guard.isPaused());
    }

    /// JSON-RPC quantity: 0x-prefixed lowercase hex without leading zeros.
    function _hexQuantity(uint256 n) internal pure returns (string memory) {
        if (n == 0) return "0x0";
        bytes memory digits = "0123456789abcdef";
        uint256 len;
        for (uint256 x = n; x != 0; x >>= 4) {
            ++len;
        }
        bytes memory out = new bytes(len + 2);
        out[0] = "0";
        out[1] = "x";
        for (uint256 i = len; i > 0; --i) {
            out[i + 1] = digits[n & 0xf];
            n >>= 4;
        }
        return string(out);
    }
}
