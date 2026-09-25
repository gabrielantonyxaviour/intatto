// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ISessionRisk} from "../../src/interfaces/ISessionRisk.sol";

/// @notice The US equity calendar the way the keeper maps the issuer's periods (checks/fork/lib/clock.ts
/// calendarSession), for the fork's week. Every scenario time falls in US daylight time (2026-03-08 to 2026-11-01),
/// so New York is UTC-4 throughout. Regular hours 09:30-16:00 ET are OPEN; pre-market (from 04:00), after-hours
/// (from 16:00) and overnight (from 20:00) are EXTENDED; Friday 20:00 ET to Sunday 20:00 ET is CLOSED.
/// Exchange holidays are ignored.
library UsCalendar {
    uint256 internal constant NY_OFFSET = 4 hours;

    /// Fork block 71,559,900 is Friday 2026-09-25 09:35:36 UTC (05:35 ET, pre-market: EXTENDED).
    uint256 internal constant FRIDAY_OPEN = 1_790_343_000; // Fri 2026-09-25 13:30 UTC = 09:30 ET
    uint256 internal constant WEEKEND_CLOSE = 1_790_380_800; // Sat 2026-09-26 00:00 UTC = Fri 20:00 ET
    uint256 internal constant SATURDAY_NOON = WEEKEND_CLOSE + 12 hours;
    uint256 internal constant MONDAY_OPEN = 1_790_602_200; // Mon 2026-09-28 13:30 UTC = 09:30 ET
    uint256 internal constant MONDAY_CLOSE = MONDAY_OPEN + 390 minutes; // 20:00 UTC = 16:00 ET
    uint256 internal constant TUESDAY_OPEN = MONDAY_OPEN + 1 days;

    /// @return s The session in force at `t`.
    /// @return periodChangedAt When the issuer's current period began (unix seconds, UTC).
    function sessionAt(uint256 t) internal pure returns (ISessionRisk.Session s, uint64 periodChangedAt) {
        uint256 et = t - NY_OFFSET; // New York wall clock, counted like unix time
        uint256 day = et - et % 1 days; // 00:00 ET of that day
        uint256 sec = et - day;
        uint256 dow = (et / 1 days + 4) % 7; // 0 = Sunday (1970-01-01 was a Thursday)
        uint256 start;
        if ((dow == 5 && sec >= 20 hours) || dow == 6 || (dow == 0 && sec < 20 hours)) {
            s = ISessionRisk.Session.CLOSED;
            start = day - ((dow + 2) % 7) * 1 days + 20 hours; // Friday 20:00 ET
        } else if (sec >= 570 minutes && sec < 16 hours) {
            (s, start) = (ISessionRisk.Session.OPEN, day + 570 minutes);
        } else {
            s = ISessionRisk.Session.EXTENDED;
            if (sec >= 20 hours) start = day + 20 hours;
            else if (sec >= 16 hours) start = day + 16 hours;
            else if (sec >= 4 hours) start = day + 4 hours;
            else start = day - 4 hours; // the previous evening's 20:00 ET
        }
        periodChangedAt = uint64(start + NY_OFFSET);
    }
}
