// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Market session posted by the keeper from the issuer's trading period and halt flags,
/// and the maximum loan-to-value a NEW borrow may reach in that session.
/// The liquidation threshold never depends on the session; only new-borrow capacity does.
interface ISessionRisk {
    /// Order is mirrored by config/session.ts SESSIONS.
    enum Session {
        UNKNOWN,
        OPEN,
        EXTENDED,
        CLOSED,
        HALTED,
        CORPORATE_ACTION
    }

    event SessionPosted(Session session, uint64 periodChangedAt, uint64 postedAt);

    /// @notice Keeper only. `periodChangedAt` is when the issuer's current period began (unix seconds).
    function postSession(Session session, uint64 periodChangedAt) external;

    /// @notice The session in force now: UNKNOWN when the last post is older than the liveness limit.
    function currentSession() external view returns (Session);

    /// @notice Max new-borrow LTV in basis points for the session in force now.
    function maxLtvBps() external view returns (uint256);

    /// @notice Max new-borrow LTV in basis points for `session`, `elapsed` seconds after its period began.
    function maxLtvBpsFor(Session session, uint256 elapsed) external view returns (uint256);

    /// @notice The raw last post.
    function lastPost() external view returns (Session session, uint64 periodChangedAt, uint64 postedAt);

    function keeper() external view returns (address);
    function livenessLimit() external view returns (uint256);
}
