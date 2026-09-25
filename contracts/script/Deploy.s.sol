// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LendingVault} from "../src/LendingVault.sol";
import {GapReserve} from "../src/GapReserve.sol";
import {InterestRateModel} from "../src/InterestRateModel.sol";
import {CollateralMarket} from "../src/CollateralMarket.sol";
import {CollateralMarketBase} from "../src/CollateralMarketBase.sol";
import {MarketLens} from "../src/MarketLens.sol";
import {SessionRiskController} from "../src/SessionRiskController.sol";
import {DepthCapRegistry} from "../src/DepthCapRegistry.sol";
import {PriceRelayAdapter} from "../src/PriceRelayAdapter.sol";
import {CorporateActionGuard} from "../src/CorporateActionGuard.sol";
import {BoundedLiquidator} from "../src/BoundedLiquidator.sol";
import {IXStock, IWrappedXStock} from "../src/interfaces/external/IXStock.sol";
import {IAggregatorV3} from "../src/interfaces/external/IAggregatorV3.sol";

/// @notice Deploys and wires every Intatto contract against real X Layer addresses.
/// Env: DEPLOY_KEEPER (address, defaults to the broadcaster), DEPLOY_OUT (JSON path),
/// DEPLOY_SPYX ("true" adds the SPYx market — sandbox only), DEPLOY_INITIAL_CAP_USDG (6 dec, default 50,000 USDG).
/// Writes a flat JSON that checks/fork/lib/deployment.ts turns into config/deployments.ts's schema.
contract Deploy is Script {
    address constant USDG = 0x4ae46a509F6b1D9056937BA4500cb143933D2dc8;
    address constant USDG_USD = 0x385C6bDDE06b0E438319bF4ddBfFe51C521ABf3D;
    address constant NVDAX = 0xc845b2894dBddd03858fd2D643B4eF725fE0849d;
    address constant WNVDAX = 0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5;
    address constant NVDAX_POOL = 0x2a2B11730C2b6d99a58034A869dd810D7300a7b2;
    address constant SPYX = 0x90A2a4c76b5D8c0bc892A69EA28Aa775a8f2dD48;
    address constant WSPYX = 0xE7E553Cd128F0011777323A0b44a7b96EA1CB540;
    address constant SPYX_POOL = 0x07c40850D14064D20eB0AfDEf9574675392f2c11;

    struct Core {
        LendingVault vault;
        GapReserve reserve;
        InterestRateModel rates;
        SessionRiskController session;
        DepthCapRegistry caps;
        BoundedLiquidator liquidator;
        MarketLens lens;
    }

    struct MarketOut {
        CollateralMarket market;
        PriceRelayAdapter relay;
        CorporateActionGuard guard;
    }

    function run() external virtual {
        address keeper = vm.envOr("DEPLOY_KEEPER", msg.sender);
        uint256 initialCap = vm.envOr("DEPLOY_INITIAL_CAP_USDG", uint256(50_000e6));
        bool withSpy = vm.envOr("DEPLOY_SPYX", false);
        string memory out = vm.envOr("DEPLOY_OUT", string("deployments/local.json"));
        vm.startBroadcast();
        deployAll(msg.sender, keeper, initialCap, withSpy, out);
        vm.stopBroadcast();
    }

    /// @notice Deploys and wires everything (call inside a broadcast) and writes the flat JSON to `out`.
    function deployAll(address operator, address keeper, uint256 initialCap, bool withSpy, string memory out)
        internal
        returns (Core memory c, MarketOut memory nvda)
    {
        c = _core(keeper);
        nvda = _market(c, keeper, "NVDAx", NVDAX, WNVDAX, NVDAX_POOL, initialCap);
        MarketOut memory spy;
        if (withSpy) spy = _market(c, keeper, "SPYx", SPYX, WSPYX, SPYX_POOL, initialCap);

        string memory j = "deployment";
        vm.serializeUint(j, "chainId", block.chainid);
        vm.serializeUint(j, "block", block.number);
        vm.serializeUint(j, "deployedAt", block.timestamp);
        vm.serializeAddress(j, "operator", operator);
        vm.serializeAddress(j, "keeper", keeper);
        vm.serializeAddress(j, "usdg", USDG);
        vm.serializeAddress(j, "vault", address(c.vault));
        vm.serializeAddress(j, "gapReserve", address(c.reserve));
        vm.serializeAddress(j, "sessionRisk", address(c.session));
        vm.serializeAddress(j, "depthCaps", address(c.caps));
        vm.serializeAddress(j, "liquidator", address(c.liquidator));
        vm.serializeAddress(j, "interestRateModel", address(c.rates));
        vm.serializeAddress(j, "lens", address(c.lens));
        _serializeMarket(j, "NVDAx", nvda, NVDAX, WNVDAX, NVDAX_POOL);
        string memory json = withSpy ? _serializeMarket(j, "SPYx", spy, SPYX, WSPYX, SPYX_POOL) : vm.serializeBool(j, "spyx", false);
        vm.writeJson(json, out);
    }

    function _core(address keeper) internal returns (Core memory c) {
        c.vault = new LendingVault(IERC20(USDG));
        c.reserve = new GapReserve(IERC20(USDG), address(c.vault));
        c.rates = new InterestRateModel();
        c.session = new SessionRiskController(keeper);
        c.caps = new DepthCapRegistry(keeper);
        c.liquidator = new BoundedLiquidator(c.session, c.caps);
        c.lens = new MarketLens();
    }

    function _market(
        Core memory c,
        address keeper,
        string memory symbol,
        address token,
        address wrapper,
        address pool,
        uint256 initialCap
    ) internal returns (MarketOut memory m) {
        m.relay = new PriceRelayAdapter(keeper, IWrappedXStock(wrapper), pool, USDG, IAggregatorV3(USDG_USD), c.session);
        m.guard = new CorporateActionGuard(keeper, IXStock(token), m.relay);
        m.market = new CollateralMarket(
            CollateralMarketBase.Config({
                symbol: symbol,
                token: IXStock(token),
                wrapper: IWrappedXStock(wrapper),
                usdg: IERC20(USDG),
                vault: c.vault,
                sessionRisk: c.session,
                priceSource: m.relay,
                corporateActionGuard: m.guard,
                depthCaps: c.caps,
                gapReserve: c.reserve,
                rateModel: c.rates
            })
        );
        c.vault.addMarket(address(m.market));
        c.reserve.setMarket(address(m.market), true);
        m.market.setLiquidator(address(c.liquidator));
        c.liquidator.setMarket(m.market, pool);
        c.caps.setInitialCap(address(m.market), initialCap);
    }

    function _serializeMarket(string memory j, string memory symbol, MarketOut memory m, address token, address wrapper, address pool)
        internal
        returns (string memory)
    {
        vm.serializeAddress(j, string.concat(symbol, ".market"), address(m.market));
        vm.serializeAddress(j, string.concat(symbol, ".priceRelay"), address(m.relay));
        vm.serializeAddress(j, string.concat(symbol, ".corporateActionGuard"), address(m.guard));
        vm.serializeAddress(j, string.concat(symbol, ".token"), token);
        vm.serializeAddress(j, string.concat(symbol, ".wrapper"), wrapper);
        return vm.serializeAddress(j, string.concat(symbol, ".pool"), pool);
    }
}
