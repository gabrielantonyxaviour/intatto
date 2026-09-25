// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Deploy} from "./Deploy.s.sol";

/// @notice X Layer mainnet deployment: the operator deploys, is the keeper, and seeds the gap reserve.
/// NVDAx only (SPYx is sandbox-only). Writes ../deployments/xlayer-mainnet.flat.json; deploy/mainnet.sh turns it
/// into deployments/xlayer-mainnet.json. Run with the operator key from the vault, never printed.
contract DeployMainnet is Deploy {
    uint256 constant INITIAL_CAP_USDG = 1_000e6; // raised by the keeper's depth sampling, one step per hour
    uint256 constant RESERVE_SEED_USDG = 500_000; // 0.5 USDG

    function run() external override {
        require(block.chainid == 196, "DeployMainnet: not X Layer mainnet");
        address operator = msg.sender;
        vm.startBroadcast();
        (Core memory c,) = deployAll(operator, operator, INITIAL_CAP_USDG, false, "../deployments/xlayer-mainnet.flat.json");
        uint256 seed = vm.envOr("RESERVE_SEED_USDG", RESERVE_SEED_USDG);
        if (seed > 0) {
            IERC20(USDG).approve(address(c.reserve), seed);
            c.reserve.fund(seed);
        }
        vm.stopBroadcast();
    }
}
