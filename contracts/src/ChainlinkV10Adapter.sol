// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Chainlink Data Streams verifier proxy. X Layer mainnet: 0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7.
interface IVerifierProxy {
    /// @return verifierResponse The verified report body, ABI-encoded per its schema.
    function verify(bytes calldata payload, bytes calldata parameterPayload)
        external
        payable
        returns (bytes memory verifierResponse);

    function s_feeManager() external view returns (address);
}

/// @title ChainlinkV10Adapter
/// @notice Verifies a Chainlink Data Streams Tokenized Asset (v10) report through the verifier proxy and returns
/// its price, market status and multiplier fields after enforcing feed, expiry, age and market-status rules.
/// BUILT AND UNIT-TESTED, NOT WIRED LIVE: no Intatto market reads it; the relayed issuer quote stays the source.
/// @dev Fees. Data Streams bills by subscription and the X Layer proxy has no fee manager (s_feeManager() == 0,
/// checked 2026-09-25), so the adapter passes an empty parameterPayload and rejects msg.value. If a fee manager is
/// set, it passes abi.encode(feeToken) and forwards msg.value; it does NOT approve LINK or recover native-fee
/// refunds, which a live integration would have to add.
contract ChainlinkV10Adapter is Ownable {
    /// @dev v10 report body. Field order from Chainlink's data-streams-sdk v10 ABI (go/report/v10/data.go:
    /// feedId, validFromTimestamp, observationsTimestamp, nativeFee, linkFee, expiresAt, lastUpdateTimestamp,
    /// price, marketStatus, currentMultiplier, newMultiplier, activationDateTime, tokenizedPrice) and
    /// docs.chain.link/data-streams/reference/report-schema-v10 (types; that table omits validFromTimestamp).
    /// Second-resolution timestamps are uint32 as in Chainlink's onchain ReportV3/ReportV8 structs; each is one
    /// 32-byte ABI word either way, and abi.decode reverts if a value does not fit.
    struct ReportV10 {
        bytes32 feedId;
        uint32 validFromTimestamp;
        uint32 observationsTimestamp;
        uint192 nativeFee;
        uint192 linkFee;
        uint32 expiresAt;
        uint64 lastUpdateTimestamp; // nanoseconds
        int192 price;
        uint32 marketStatus; // 0 Unknown, 1 Closed, 2 Open (docs: Data Streams market hours, v10)
        int192 currentMultiplier;
        int192 newMultiplier;
        uint32 activationDateTime; // seconds, 0 if none scheduled
        int192 tokenizedPrice;
    }

    /// The schema version is the first two bytes of a report's data and of its feed id.
    uint16 public constant SCHEMA_V10 = 0x000A;

    IVerifierProxy public immutable verifierProxy;
    bytes32 public feedId;
    /// @notice Largest accepted age of observationsTimestamp, seconds.
    uint256 public maxAge = 5 minutes;
    /// @notice The marketStatus value that counts as open (2 for v10 per Chainlink's market-hours table).
    uint32 public openMarketStatus = 2;
    address public feeToken;

    event FeedIdSet(bytes32 feedId);
    event MaxAgeSet(uint256 maxAge);
    event OpenMarketStatusSet(uint32 status);
    event FeeTokenSet(address feeToken);
    event ReportVerified(bytes32 indexed feedId, int192 price, uint32 observationsTimestamp, uint32 marketStatus);

    error ZeroAddress();
    error WrongSchema(uint16 version);
    error WrongFeed(bytes32 feedId);
    error Expired(uint32 expiresAt);
    error TooOld(uint32 observationsTimestamp);
    error MarketClosed(uint32 marketStatus);
    error NoFeeExpected();
    error InvalidMaxAge();
    error InvalidMarketStatus();

    constructor(IVerifierProxy verifierProxy_, bytes32 feedId_, address feeToken_) Ownable(msg.sender) {
        if (address(verifierProxy_) == address(0)) revert ZeroAddress();
        verifierProxy = verifierProxy_;
        _setFeedId(feedId_);
        feeToken = feeToken_;
        emit FeeTokenSet(feeToken_);
    }

    /// @notice Verifies `signedReport` (the Streams API fullReport) and returns its fields.
    /// Reverts: WrongSchema (not v10), WrongFeed (feedId != configured), Expired (expiresAt < now),
    /// TooOld (now - observationsTimestamp > maxAge; a future observation counts as age 0),
    /// MarketClosed (marketStatus != openMarketStatus), NoFeeExpected (value sent with no fee manager).
    function verifyAndRead(bytes calldata signedReport)
        external
        payable
        returns (
            int192 price,
            uint32 observationsTimestamp,
            uint32 marketStatus,
            int192 currentMultiplier,
            int192 newMultiplier,
            uint32 activationDateTime
        )
    {
        ReportV10 memory r = _verify(signedReport);
        if (r.feedId != feedId) revert WrongFeed(r.feedId);
        if (r.expiresAt < block.timestamp) revert Expired(r.expiresAt);
        if (block.timestamp > r.observationsTimestamp && block.timestamp - r.observationsTimestamp > maxAge) {
            revert TooOld(r.observationsTimestamp);
        }
        if (r.marketStatus != openMarketStatus) revert MarketClosed(r.marketStatus);
        emit ReportVerified(r.feedId, r.price, r.observationsTimestamp, r.marketStatus);
        return (r.price, r.observationsTimestamp, r.marketStatus, r.currentMultiplier, r.newMultiplier,
            r.activationDateTime);
    }

    function setFeedId(bytes32 feedId_) external onlyOwner {
        _setFeedId(feedId_);
    }

    /// @notice 0 < maxAge <= 1 day.
    function setMaxAge(uint256 maxAge_) external onlyOwner {
        if (maxAge_ == 0 || maxAge_ > 1 days) revert InvalidMaxAge();
        maxAge = maxAge_;
        emit MaxAgeSet(maxAge_);
    }

    /// @notice Nonzero: 0 is Unknown in every Data Streams market-status table.
    function setOpenMarketStatus(uint32 status) external onlyOwner {
        if (status == 0) revert InvalidMarketStatus();
        openMarketStatus = status;
        emit OpenMarketStatusSet(status);
    }

    function setFeeToken(address feeToken_) external onlyOwner {
        feeToken = feeToken_;
        emit FeeTokenSet(feeToken_);
    }

    /// @dev The payload is abi.encode(bytes32[3] reportContext, bytes reportData, bytes32[] rs, bytes32[] ss,
    /// bytes32 rawVs); the version is checked before verification so a wrong schema costs no verification.
    function _verify(bytes calldata signedReport) internal returns (ReportV10 memory) {
        (, bytes memory reportData) = abi.decode(signedReport, (bytes32[3], bytes));
        uint16 version = reportData.length < 2 ? 0 : (uint16(uint8(reportData[0])) << 8) | uint8(reportData[1]);
        if (version != SCHEMA_V10) revert WrongSchema(version);
        bytes memory parameterPayload;
        if (verifierProxy.s_feeManager() != address(0)) parameterPayload = abi.encode(feeToken);
        else if (msg.value != 0) revert NoFeeExpected();
        bytes memory verified = verifierProxy.verify{value: msg.value}(signedReport, parameterPayload);
        return abi.decode(verified, (ReportV10));
    }

    function _setFeedId(bytes32 feedId_) internal {
        if (uint16(bytes2(feedId_)) != SCHEMA_V10) revert WrongSchema(uint16(bytes2(feedId_)));
        feedId = feedId_;
        emit FeedIdSet(feedId_);
    }
}
