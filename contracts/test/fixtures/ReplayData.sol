// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Vm} from "forge-std/Vm.sol";

/// @notice Reads the committed replays in data/replays (foundry.toml grants read access). Each file is checked
/// against the sha256 recorded in data/replays/index.json before any number is used.
/// Foundry's JSON cheatcodes reject non-integer numbers ("unsupported JSON number"), so the few decimal prices
/// are located in the file text and read as 1e6 fixed point; integers still go through vm.parseJsonUint.
library ReplayData {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    string internal constant DIR = "../data/replays/";

    /// @notice NVDA 24-27 Jan 2025 (Dukascopy CFD minute bars, CFD counterfactual prices, not X Layer liquidity).
    /// @return fridayClose anchors.fridayClose.c, USD 1e6.
    /// @return mondayOpen anchors.mondayOpen.o, USD 1e6.
    /// @return mondayClose the last bar's close (Monday 15:59 ET), USD 1e6.
    function januaryGap() internal view returns (uint256 fridayClose, uint256 mondayOpen, uint256 mondayClose) {
        bytes memory j = bytes(verified("nvda-2025-01-gap"));
        uint256 anchors = _findLast(j, '"anchors"', j.length);
        fridayClose = _numberAfter(j, _find(j, '"fridayClose"', anchors), '"c":');
        mondayOpen = _numberAfter(j, _find(j, '"mondayOpen"', anchors), '"o":');
        mondayClose = _number(j, _findLast(j, '"c":', anchors) + 4); // bars end right before "anchors"
    }

    /// @notice The synthetic gap in basis points (not market data).
    function syntheticGapBps() internal view returns (uint256) {
        return vm.parseJsonUint(verified("synthetic-gap"), ".gapBps");
    }

    /// @notice The replay file `id`, after checking its sha256 against data/replays/index.json.
    function verified(string memory id) internal view returns (string memory json) {
        json = vm.readFile(string.concat(DIR, id, ".json"));
        string memory index = vm.readFile(string.concat(DIR, "index.json"));
        for (uint256 i;; i++) {
            string memory key = string.concat("$[", vm.toString(i), "]");
            if (keccak256(bytes(vm.parseJsonString(index, string.concat(key, ".id")))) != keccak256(bytes(id))) {
                continue;
            }
            string memory hash = vm.parseJsonString(index, string.concat(key, ".sha256"));
            require(sha256(bytes(json)) == vm.parseBytes32(string.concat("0x", hash)), "replay file != index sha256");
            return json;
        }
    }

    function _find(bytes memory h, bytes memory needle, uint256 from) private pure returns (uint256) {
        for (uint256 i = from; i + needle.length <= h.length; i++) {
            if (_matches(h, needle, i)) return i;
        }
        revert("replay field not found");
    }

    /// @dev Start of the last `needle` that ends at or before `end`.
    function _findLast(bytes memory h, bytes memory needle, uint256 end) private pure returns (uint256) {
        for (uint256 i = end; i >= needle.length; i--) {
            if (_matches(h, needle, i - needle.length)) return i - needle.length;
        }
        revert("replay field not found");
    }

    function _matches(bytes memory h, bytes memory needle, uint256 at) private pure returns (bool) {
        for (uint256 k; k < needle.length; k++) {
            if (h[at + k] != needle[k]) return false;
        }
        return true;
    }

    function _numberAfter(bytes memory h, uint256 from, bytes memory key) private pure returns (uint256) {
        return _number(h, _find(h, key, from) + key.length);
    }

    /// @dev The non-negative JSON number starting at `i` (after optional spaces) as 1e6 fixed point.
    function _number(bytes memory h, uint256 i) private pure returns (uint256 v) {
        while (h[i] == " ") i++;
        uint256 decimals;
        bool fraction;
        for (; i < h.length; i++) {
            bytes1 c = h[i];
            if (c == "." && !fraction) {
                fraction = true;
                continue;
            }
            if (c < "0" || c > "9") break;
            if (fraction && decimals == 6) continue;
            v = v * 10 + (uint8(c) - 48);
            if (fraction) decimals++;
        }
        v *= 10 ** (6 - decimals);
    }
}
