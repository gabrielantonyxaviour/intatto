// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LendingVault} from "../src/LendingVault.sol";
import {GapReserve} from "../src/GapReserve.sol";
import {InterestRateModel} from "../src/InterestRateModel.sol";
import {SessionRiskController} from "../src/SessionRiskController.sol";
import {DepthCapRegistry} from "../src/DepthCapRegistry.sol";
import {BoundedLiquidator} from "../src/BoundedLiquidator.sol";
import {MarketLens} from "../src/MarketLens.sol";
import {Deploy} from "./Deploy.s.sol";

/// @notice Sandbox only: deploys the SPYx market (PriceRelayAdapter, CorporateActionGuard, CollateralMarket) on top
/// of an existing Intatto core — the live mainnet contracts on a fork — and wires it exactly as Deploy.s.sol does:
/// vault.addMarket, reserve.setMarket, market.setLiquidator, liquidator.setMarket, caps.setInitialCap.
/// Broadcast as the core's owner (on a fork: `--unlocked --sender <owner>` with the owner impersonated).
/// Env: CORE_VAULT, CORE_RESERVE, CORE_SESSION, CORE_CAPS, CORE_LIQUIDATOR, CORE_RATES (addresses),
/// DEPLOY_KEEPER (defaults to the broadcaster), DEPLOY_INITIAL_CAP_USDG (6 dec, default 50,000 USDG),
/// DEPLOY_OUT (flat JSON with SPYx.* keys, as Deploy.s.sol writes them).
contract DeploySecondMarket is Deploy {
    function run() external override {
        require(block.chainid != 196, "DeploySecondMarket: sandbox forks only, never X Layer mainnet");
        Core memory c = Core({
            vault: LendingVault(vm.envAddress("CORE_VAULT")),
            reserve: GapReserve(vm.envAddress("CORE_RESERVE")),
            rates: InterestRateModel(vm.envAddress("CORE_RATES")),
            session: SessionRiskController(vm.envAddress("CORE_SESSION")),
            caps: DepthCapRegistry(vm.envAddress("CORE_CAPS")),
            liquidator: BoundedLiquidator(vm.envAddress("CORE_LIQUIDATOR")),
            lens: MarketLens(address(0))
        });
        address keeper = vm.envOr("DEPLOY_KEEPER", msg.sender);
        uint256 initialCap = vm.envOr("DEPLOY_INITIAL_CAP_USDG", uint256(50_000e6));
        string memory out = vm.envOr("DEPLOY_OUT", string("cache/second-market.json"));

        vm.startBroadcast();
        MarketOut memory spy = _market(c, keeper, "SPYx", SPYX, WSPYX, SPYX_POOL, initialCap);
        vm.stopBroadcast();

        string memory j = "secondMarket";
        vm.serializeUint(j, "block", block.number);
        vm.serializeAddress(j, "keeper", keeper);
        vm.writeJson(_serializeMarket(j, "SPYx", spy, SPYX, WSPYX, SPYX_POOL), out);
    }
}
