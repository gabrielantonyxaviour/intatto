// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Price of ONE underlying xStock token unit (e.g. 1 NVDAx = 1e18 units) in USD, 18 decimals.
/// The keeper relays the issuer's indicative quote, which carries no source timestamp:
/// `fetchedAt` is the keeper's fetch time and proves keeper liveness only, never market freshness.
/// Collateral held as wrapper shares is valued as wrapper.convertToAssets(shares) * price / 1e18;
/// never multiply by the issuer multiplier again.
interface IPriceSource {
    struct GuardStatus {
        /// The last accepted post is within the keeper liveness limit.
        bool fresh;
        /// The implied wrapper price is inside the band around the pool's 30-minute TWAP right now.
        bool inBand;
        /// Chainlink USDG/USD is positive, not future-dated, younger than 26h and within 1% of $1.
        bool pegOk;
    }

    /// @return priceE18 USD per 1e18 token units, 18 decimals. Zero before the first accepted post.
    /// @return fetchedAt The keeper's fetch time of the accepted quote (unix seconds).
    function latestPrice() external view returns (uint256 priceE18, uint64 fetchedAt);

    function guardStatus() external view returns (GuardStatus memory);
}
