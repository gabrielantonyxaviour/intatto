// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ChainlinkV10Adapter, IVerifierProxy} from "../src/ChainlinkV10Adapter.sol";

/// Test double for Chainlink's verifier proxy: it "verifies" by returning the report body from the payload,
/// so reports generated here decode exactly as a verified v10 report would. It records the fee arguments.
contract TestVerifierProxy {
    address public s_feeManager;
    bytes public lastParameterPayload;
    uint256 public lastValue;

    function setFeeManager(address feeManager) external {
        s_feeManager = feeManager;
    }

    function verify(bytes calldata payload, bytes calldata parameterPayload) external payable returns (bytes memory) {
        lastParameterPayload = parameterPayload;
        lastValue = msg.value;
        (, bytes memory reportData) = abi.decode(payload, (bytes32[3], bytes));
        return reportData;
    }
}

/// This proves decoding and the adapter's rules, NOT live entitlement: no DON signature is checked here, and
/// Intatto holds no Data Streams subscription for a v10 feed on X Layer. The adapter is built, not wired live.
contract ChainlinkV10Test is Test {
    bytes32 constant FEED = 0x000a7ea0c1c4d1d2c0b9d6bf1b2c0a5d9e3f4a5b6c7d8e9f0a1b2c3d4e5f6071; // a v10 feed id
    bytes32 constant OTHER_FEED = 0x000a00000000000000000000000000000000000000000000000000000000beef;
    bytes32 constant V3_FEED = 0x0003f9b553e393ced311551efd30d1decedb63d76ad41737462e2cdbbdff1578;
    uint32 constant NOW = 1_790_000_000;

    TestVerifierProxy proxy;
    ChainlinkV10Adapter adapter;
    address feeToken = makeAddr("LINK");

    function setUp() public {
        vm.warp(NOW);
        proxy = new TestVerifierProxy();
        adapter = new ChainlinkV10Adapter(IVerifierProxy(address(proxy)), FEED, feeToken);
    }

    function _report() internal pure returns (ChainlinkV10Adapter.ReportV10 memory r) {
        r.feedId = FEED;
        r.validFromTimestamp = NOW - 2;
        r.observationsTimestamp = NOW - 2;
        r.nativeFee = 3e15;
        r.linkFee = 5e16;
        r.expiresAt = NOW + 1 days;
        r.lastUpdateTimestamp = uint64(NOW - 3) * 1e9;
        r.price = 181.42e18;
        r.marketStatus = 2;
        r.currentMultiplier = 1.0017e18;
        r.newMultiplier = 2.0034e18;
        r.activationDateTime = NOW + 3 days;
        r.tokenizedPrice = 181.6e18;
    }

    /// The Streams API fullReport layout: (reportContext, reportData, rs, ss, rawVs).
    function _payload(ChainlinkV10Adapter.ReportV10 memory r) internal pure returns (bytes memory) {
        bytes32[3] memory context = [bytes32(uint256(1)), bytes32(uint256(2)), bytes32(uint256(3))];
        return abi.encode(context, abi.encode(r), new bytes32[](2), new bytes32[](2), bytes32(uint256(7)));
    }

    function _expectRevert(bytes4 selector, uint256 arg, ChainlinkV10Adapter.ReportV10 memory r) internal {
        vm.expectRevert(abi.encodeWithSelector(selector, arg));
        adapter.verifyAndRead(_payload(r));
    }

    function test_passingCase_decodesEveryReturnedField() public {
        ChainlinkV10Adapter.ReportV10 memory r = _report();
        vm.expectEmit(address(adapter));
        emit ChainlinkV10Adapter.ReportVerified(FEED, r.price, r.observationsTimestamp, 2);
        (int192 price, uint32 observedAt, uint32 status, int192 current, int192 next, uint32 activation) =
            adapter.verifyAndRead(_payload(r));
        assertEq(price, 181.42e18);
        assertEq(observedAt, NOW - 2);
        assertEq(status, 2);
        assertEq(current, 1.0017e18);
        assertEq(next, 2.0034e18);
        assertEq(activation, NOW + 3 days);
        assertEq(proxy.lastParameterPayload().length, 0, "no fee manager: empty parameterPayload");
        assertEq(proxy.lastValue(), 0);
    }

    function test_revert_wrongFeed() public {
        ChainlinkV10Adapter.ReportV10 memory r = _report();
        r.feedId = OTHER_FEED;
        _expectRevert(ChainlinkV10Adapter.WrongFeed.selector, uint256(OTHER_FEED), r);
    }

    function test_revert_wrongSchema_beforeVerification() public {
        ChainlinkV10Adapter.ReportV10 memory r = _report();
        r.feedId = V3_FEED;
        vm.expectCall(address(proxy), abi.encodeWithSelector(TestVerifierProxy.verify.selector), 0);
        _expectRevert(ChainlinkV10Adapter.WrongSchema.selector, 3, r);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkV10Adapter.WrongSchema.selector, uint256(3)));
        adapter.setFeedId(V3_FEED);
    }

    function test_revert_expired() public {
        ChainlinkV10Adapter.ReportV10 memory r = _report();
        r.expiresAt = NOW - 1;
        _expectRevert(ChainlinkV10Adapter.Expired.selector, NOW - 1, r);
        r.expiresAt = NOW; // expiresAt >= now is valid
        adapter.verifyAndRead(_payload(r));
    }

    function test_revert_tooOld() public {
        ChainlinkV10Adapter.ReportV10 memory r = _report();
        r.observationsTimestamp = NOW - 5 minutes - 1;
        _expectRevert(ChainlinkV10Adapter.TooOld.selector, NOW - 5 minutes - 1, r);
        r.observationsTimestamp = NOW - 5 minutes; // exactly maxAge
        adapter.verifyAndRead(_payload(r));
        r.observationsTimestamp = NOW + 2; // ahead of the block clock reads as age 0
        adapter.verifyAndRead(_payload(r));
    }

    function test_revert_marketClosed() public {
        ChainlinkV10Adapter.ReportV10 memory r = _report();
        r.marketStatus = 1; // Closed
        _expectRevert(ChainlinkV10Adapter.MarketClosed.selector, 1, r);
        r.marketStatus = 0; // Unknown
        _expectRevert(ChainlinkV10Adapter.MarketClosed.selector, 0, r);
    }

    function test_fees_feeTokenOnlyWithFeeManager() public {
        vm.deal(address(this), 1 ether);
        vm.expectRevert(ChainlinkV10Adapter.NoFeeExpected.selector);
        adapter.verifyAndRead{value: 1}(_payload(_report()));

        proxy.setFeeManager(makeAddr("feeManager"));
        adapter.verifyAndRead{value: 1e15}(_payload(_report()));
        assertEq(proxy.lastParameterPayload(), abi.encode(feeToken));
        assertEq(proxy.lastValue(), 1e15);
    }

    function test_setters_ownerOnlyBoundedAndEmit() public {
        assertEq(adapter.feedId(), FEED);
        assertEq(adapter.maxAge(), 5 minutes);
        assertEq(adapter.openMarketStatus(), 2);
        assertEq(adapter.feeToken(), feeToken);
        assertEq(address(adapter.verifierProxy()), address(proxy));

        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        adapter.setMaxAge(60);
        vm.expectRevert(ChainlinkV10Adapter.InvalidMaxAge.selector);
        adapter.setMaxAge(0);
        vm.expectRevert(ChainlinkV10Adapter.InvalidMaxAge.selector);
        adapter.setMaxAge(1 days + 1);
        vm.expectRevert(ChainlinkV10Adapter.InvalidMarketStatus.selector);
        adapter.setOpenMarketStatus(0);
        vm.expectRevert(ChainlinkV10Adapter.ZeroAddress.selector);
        new ChainlinkV10Adapter(IVerifierProxy(address(0)), FEED, feeToken);

        vm.expectEmit(address(adapter));
        emit ChainlinkV10Adapter.FeedIdSet(OTHER_FEED);
        adapter.setFeedId(OTHER_FEED);
        vm.expectEmit(address(adapter));
        emit ChainlinkV10Adapter.MaxAgeSet(60);
        adapter.setMaxAge(60);
        vm.expectEmit(address(adapter));
        emit ChainlinkV10Adapter.OpenMarketStatusSet(5);
        adapter.setOpenMarketStatus(5);
        vm.expectEmit(address(adapter));
        emit ChainlinkV10Adapter.FeeTokenSet(address(0));
        adapter.setFeeToken(address(0));

        ChainlinkV10Adapter.ReportV10 memory r = _report();
        r.feedId = OTHER_FEED;
        r.marketStatus = 5;
        r.observationsTimestamp = NOW - 60;
        adapter.verifyAndRead(_payload(r)); // the new feed, status and age apply
        r.observationsTimestamp = NOW - 61;
        _expectRevert(ChainlinkV10Adapter.TooOld.selector, NOW - 61, r);
    }
}
