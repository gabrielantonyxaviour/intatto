# Web3 UI libraries and DeFi interfaces for Intatto

Researched 2026-09-25 against the npm registry, the GitHub API and each live site. Versions and
dates below are from those sources on that day.

**Recommendation:** Don't adopt a single all-in-one Web3 kit. Stay on shadcn/ReUI. Copy in
**onchain-ui** primitives and **Morpho's MIT uikit** (`TokenAmountInput`, `TransactionButton`).
Build the LTV/health meter and the approve-then-act stepper ourselves, using the Borrow flows of
**Liquity V2** and **Aave** as the UX reference.

Why:
- OnchainKit was deprecated and its repo archived on 2026-09-22.
- Aave's interface code is "All Rights Reserved".
- None of the wallet kits ship lending components.
- Intatto's screens are meant to be "ReUI, working, no look", and only source-copied
  shadcn components fit that without bringing a second design system.

---

## Ranked shortlist: what to click

### 1. onchain-ui: adopt (copy primitives in through the shadcn CLI)

A shadcn registry of Web3 primitives. It is built on our exact stack: Next 16.2, React 19.2,
Tailwind 4, wagmi 3.7.6 and viem 2.55. MIT, v0.2.0, last commit 2026-09-09. It is listed in the
official shadcn registry directory with "healthy" status.

- **Try it:**
  - https://onchain-ui.dev: on the home page, type an amount in the Sell field and press **Max**.
  - https://example.onchain-ui.dev: a full swap app built only from the registry. Connect a
    wallet, switch the chain and edit amounts.
  - https://onchain-ui.dev/docs/components/asset-input: the **AssetInput** states (error,
    readOnly, disabled, balance footer).
  - https://onchain-ui.dev/docs/components/connect-wallet: **ConnectWallet**, **ConnectorList**
    and **WalletButton**.
- **Install:** `npx shadcn add @onchain-ui/asset-input @onchain-ui/connect-wallet @onchain-ui/token-balance @onchain-ui/asset-row @onchain-ui/sonner`
- **Gives us:**
  - `AmountInput`: a decimal-string input that doesn't lose precision, which suits 18-decimal
    xStocks.
  - `AssetInput`: slots for label, asset, balance and Max.
  - `TokenBalance`, `TokenPrice`, `TokenLogo`, `TokenStack`, `AssetRow` (market and portfolio
    rows).
  - `ChainSelect` (with an unsupported-chain state), `NetworkLogo`, `AddressDisplay`.
  - `ConnectWallet`: plain wagmi, so it picks up OKX Wallet through EIP-6963 and accepts our
    burner connector.
  - A token-themed `sonner`.
- **Missing:** the approve-then-act stepper, an LTV or health meter, and position cards.
- **X Layer:** chains come from our `wagmiConfig.chains`, which includes viem's `xLayer` (id 196).
- **Risk:** it is pre-1.0 and has one maintainer (1 star). The code is copied into our repo, so
  that risk doesn't carry over at runtime.
- **Fit:** Market 4 · Borrow 3 · Lend 3 (0–5 scale).

### 2. Morpho Lite apps: copy the MIT uikit, study the AGPL Borrow/Earn sheets

`morpho-org/morpho-lite-apps` uses React 19, Vite, shadcn, Tailwind 4 and wagmi 2.15. That is
the architecture closest to ours of any production lending UI. The repo was archived in April
2026, and the lite app now redirects to app.morpho.org.

**The licences differ within the repo:**
- `packages/uikit` is **MIT**, so its code can be copied into Intatto.
- `apps/lite` and `apps/fallback` are **AGPL-3.0**. Read them, but don't copy code from them into
  a hosted app.

- **Try it:**
  - https://fallback.morpho.org is live and runs this codebase. It shows your Morpho positions,
    with repay, add collateral and withdraw.
  - https://app.morpho.org is the production UX (closed source). Open any market and use the
    Borrow panel to see the LTV and liquidation preview.
  - To run it locally: `git clone https://github.com/morpho-org/morpho-lite-apps && pnpm i && pnpm run lite-app:dev`,
    then open http://localhost:5173.
- **Files to read:**
  - `packages/uikit/src/components/token-amount-input.tsx` (MIT): amount input with Max.
  - `packages/uikit/src/components/transaction-button.tsx` (MIT): write, then wait for the
    receipt, then a sonner toast.
  - `apps/lite/src/components/borrow-sheet-content.tsx` (AGPL): supply collateral, borrow, repay
    and withdraw tabs. It shows **LTV / Liquidation LTV, current → new**, uses an Approve button
    followed by an action button, and applies a 0.1% max haircut to cover accrued interest.
  - `earn-sheet-content.tsx`: ERC-4626 deposit and withdraw, which is the shape of our Lend
    screen.
  - `borrow-table.tsx` and `earn-table.tsx`: market tables.
- **Fit:** Market 4 · Borrow 5 · Lend 5, as patterns. It pins wagmi 2, so small hook-API updates
  may be needed on wagmi 3.

### 3. Liquity V2 (BOLD) frontend: the reference for the Borrow screen and the multi-step flow

`liquity/bold/frontend`: `app` and `uikit` are **MIT**; only the contracts are under BUSL. It uses
Next 15.3, React 19.1, wagmi 2.15 and ConnectKit. Styling is **Panda CSS**, not Tailwind, so we
would port patterns rather than paste code. Last frontend commit was 2026-07-13. Liquity V2 is
being relaunched after a stability-pool issue, so use the testnet preview.

- **Try it:**
  - https://liquity2-sepolia.vercel.app (Sepolia, the repo's own preview): **Borrow**, then
    enter collateral with Max and a borrow amount.
    - Watch **LTV, liquidation price and the risk level** update as you type.
    - Drag the **interest-rate** field.
    - Submit to reach the **transaction flow screen**, a step list with approve or permit
      status, then the action and a confirmation.
  - https://liquity.app is a mainnet community frontend.
- **Files to read:** `frontend/app/src/screens/BorrowScreen`, `LoanScreen/` (update, close and
  interest-rate panels), `TransactionsScreen/TransactionStatus.tsx` and `PermissionStatus.tsx`,
  `src/tx-flows/*` (openBorrowPosition, updateBorrowPosition, closeLoanPosition) and
  `src/services/TransactionFlow`. Every step moves through the states
  `idle → awaiting-commit → awaiting-verify → confirmed | error`. This is the cleanest
  open-source model of the approve-then-act stepper.
- **Fit:** Market 2 · Borrow 5 · Lend 3.

### 4. Aave interface: the UX benchmark only; no code reuse

It is actively maintained (commit 2026-09-24), but `LICENSE.md` reads "All Rights Reserved ©
Aave Labs". It uses the Next 15 pages router, React 18.3, MUI 5, ConnectKit and wagmi 2, so the
code isn't reusable for us anyway. It is still the best-known lending UX to benchmark against.

- **Try it at https://app.aave.com:**
  1. Open the settings gear and turn on **Testnet mode**. Pick a Sepolia market and use the
     Faucet to get test tokens.
  2. On **Dashboard**, press **Supply** on an asset. The modal has amount + Max, a transaction
     overview with **Health factor current → new**, and a two-step **Approve → Supply** button
     (with a signed-permit option).
  3. Press **Borrow**. Push the health factor toward 1 to see the risk-acknowledgement checkbox.
  4. Press **Risk details**, next to your position summary. It shows the health factor and the
     current LTV against max LTV and liquidation threshold as bars. This is the closest ready
     model for our LTV meter.
  5. The **Markets** page is the market table reference.
- **Fit (UX only):** Market 4 · Borrow 5 · Lend 4.

### Wallet connect: pick one, depending on the wagmi major version

- **wagmi 3** is current (3.7.7). Use onchain-ui `ConnectWallet`: no service, no licence strings,
  and it works with our OKX and burner connectors.
- If we want a polished modal with WalletConnect QR codes for OKX Wallet on mobile, **Reown
  AppKit** is the only wagmi-3-ready modal. It has a built-in `xLayer` network but carries
  licence conditions (below).
- **RainbowKit** is the MIT choice only if we stay on **wagmi 2**.

---

## Status snapshot (as of 2026-09-25)

| Candidate | Latest / date | Maintained? | Licence | React 19 | wagmi 3 | Matches shadcn/Tailwind? | Chain 196 | M/B/L fit |
|---|---|---|---|---|---|---|---|---|
| onchain-ui | v0.2.0 · 2026-09-09 | Yes (solo) | MIT | Yes | Yes | Native (source) | Yes, any viem chain | 4/3/3 |
| Morpho Lite uikit + apps | archived · 2026-04 | No, archived | uikit MIT, apps AGPL | Yes | No (2.15) | Native (shadcn) | Yes, any chain | 4/5/5 |
| Liquity V2 frontend | 2026-07-13 | Slow | MIT (app, uikit) | Yes | No (2.15) | No (Panda CSS) | Port | 2/5/3 |
| Aave interface | 2026-09-24 | Yes | All Rights Reserved | No (18.3) | No | No (MUI) | n/a | UX 4/5/4 |
| Coinbase OnchainKit | 1.1.3 · 2026-09-21 | **Deprecated 2026-09-22, archived** | MIT | Yes | No (^2.16) | Own CSS | Base-first; Earn is Base-only | 1/1/3 (Earn UX ref) |
| Reown AppKit | 1.8.24 · 2026-09-16 | Yes | Reown Community Licence | Yes | Yes (adapter ≥2.19.5) | CSS vars; headless costs extra | `xLayer` built in | connect only |
| RainbowKit | 2.2.11 · 2026-05-06 | Slowing | MIT | Yes | **No** (PR #2591 closed unmerged) | Theme object | Yes | connect only |
| ConnectKit | 1.9.2 · 2026-03-24 | Slow | BSD-2 | Peer says ≤18 (works in practice) | No | Themes + CSS vars | Yes | connect only |
| Privy | 3.45.0 · 2026-09-21 | Yes | SDK Apache-2.0, SaaS | Yes | Yes (`@privy-io/wagmi` ≥2) | `appearance` config | Yes, custom EVM | connect/auth only |
| Dynamic | 5.9.1 · 2026-09-22 | Yes (Fireblocks) | SDK MIT, SaaS | Yes | No (connector ^2.14) | CSS vars + dashboard | Yes, custom EVM | connect/auth only |
| thirdweb | 5.121.6 · 2026-09-22 | Yes | Apache-2.0 + clientId | Yes | Own stack (wagmi adapter) | Theme object; headless parts | Yes | 2/2/2 |
| Scaffold-ETH 2 / scaffold-ui | 0.1.12 · 2026-06-09 | Yes | SE-2 MIT; scaffold-ui has no licence file | Yes | No (2.19) | No (DaisyUI) | Add to config | 1/2/2 (dev tool) |
| w3-kit | ui repo 2026-08-07 | Yes (tiny) | MIT | Yes | Not wired (props only) | Yes (cn/Tailwind) | Props | 2/3/2 |
| shadcn.io Web3 blocks | 2026 | Yes (commercial) | Free = MIT-style; some Pro; token required | Yes | Static mock | Yes | Static | 3/3/3 (mockups) |
| Euler Lite | 2026-09-25 | Yes | MIT | **Vue/Nuxt** | n/a | Tailwind (Vue) | Config | UX ref 4/5/5 |
| ssych registry | 2026 | Yes | Not stated | Yes | Static | Yes, but look-heavy | Static | 3/2/2 (look track) |

M/B/L = Market / Borrow / Lend fit, from 0 to 5.

---

## Notes per candidate (what matters for us)

**Coinbase OnchainKit.**
- Status: the README now says "deprecated and no longer maintained … Do not use them for new
  projects". The repo was archived on 2026-09-22 and the docs were removed from base.org.
- Still useful as a UX reference only: https://onchainkit.xyz/playground is still up. Set
  Component to **Earn** (Base or Base Sepolia) to see the deposit/withdraw tabs, APY and deposited
  balance. The Transaction component there shows the calls-array → status → toast pattern.
- Earn only reads Morpho vaults through Coinbase APIs on Base, so it could never have served X
  Layer.
- Its successor, `@coinbase/cdp-react` (0.0.126), covers CDP embedded wallets only.

**Aave interface (github.com/aave/interface).**
- Its components are coupled to MUI, Lingui, Aave math-utils and Aave pool contracts.
- The licence forbids reuse, so treat it only as the UX benchmark (#4).
- `@aave/react` (MIT, v6.6) is a hooks SDK for Aave markets only, not UI.

**Reown AppKit.** Modal wallet connect for 500+ wallets through WalletConnect, plus email/social
login, swaps and onramp. Try https://demo.reown.com (theme builder) and
https://lab.reown.com/appkit?name=wagmi. Licence conditions:
- The app must use Reown's network.
- An attribution notice is required: "Portions © 2025 Reown, Inc.".
- The free plan caps embedded-wallet and SIWX MAU at 500 and RPC calls at 2.5M a month.
- Headless mode, which would let us render the connect UI in shadcn, and removing Reown branding
  both need Pro ($890 a year).
- Theming is limited to CSS variables such as `--apkt-color-mix`.

**RainbowKit.**
- Try the live modal customiser on https://rainbowkit.com.
- It is MIT and the cleanest modal, but still wagmi 2 only. A maintainer comment in May said v3
  "is out", yet npm latest is 2.2.11 with `wagmi ^2.9.0`.
- Scaffold-ETH 2 bundles it.

**ConnectKit.**
- Used by Aave and Liquity. It has a few built-in themes plus custom CSS variables.
- Its peers still declare React ≤18, and its last release was in March 2026.

**Privy / Dynamic.**
- Worth adding only if Intatto wants email or social sign-in with embedded wallets, for
  stockholders who are new to crypto.
- Neither ships DeFi components.
- Privy is free for 0–499 MAU, then $299 a month. Dynamic is free up to 1,000 MAU, then $249 a
  month.
- Demos: https://demo.privy.io, https://demo.dynamic.xyz.

**thirdweb.**
- Components:
  - `ConnectButton`
  - `TransactionButton`, with pending/success/error states and an insufficient-funds top-up
  - Headless `TokenProvider`/`TokenIcon` and `AccountBalance`
  - Swap/Bridge widgets
- It runs its own wallet stack and needs a clientId. X Layer is supported (thirdweb.com/x-layer).
- Try https://playground.thirdweb.com/bridge/transaction-button,
  https://playground.thirdweb.com/tokens/token-components and
  https://playground.thirdweb.com/wallets/sign-in/button.

**Scaffold-ETH 2 / scaffold-ui.**
- Components: `Address`, `AddressInput`, `Balance`, `EtherInput`, `IntegerInput`, plus the
  **Debug Contracts** page.
- Styling is DaisyUI, which doesn't fit our screens.
- Useful as an internal tool to poke our X Layer contracts during development.
- Try https://scaffold-ui-example.vercel.app, or run `npx create-eth@latest` and open `/debug`.

**w3-kit.**
- `DeFiPositionManager`: position rows with a **health-factor bar** and a risk badge. A good
  sketch for Borrow position cards.
- Also `StakingInterface`, `TokenSwap` and `TransactionHistory`.
- All are props-driven with no wallet wiring. Adoption is low (about 91 npm downloads a week),
  and its shadcn registry currently reports "unavailable".
- Try https://ui.w3-kit.com/defi-position-manager.

**shadcn.io Web3 blocks.**
- About 100 static blocks, including `web3-lending-borrow` (supply/borrow markets and health
  factor) and `web3-defi-dashboard`.
- Installing needs a shadcn.io account token, and some blocks are Pro.
- Useful as wireframes. Try https://www.shadcn.io/blocks/web3-lending-borrow.

**Euler Lite.**
- A full open-source lending app (lend, borrow, portfolio, rewards), MIT and very active.
- It is Nuxt/Vue, so the UX is the reference, not the code.
- Try https://app.euler.finance: open a vault and borrow to see the LTV and health
  projection.

**ssych registry.**
- Dense finance components: `health-gauge` (a 270° dial), the `amount` formatting family,
  `crypto-fiat` dual input, `holdings-table`, `market-watchlist`.
- They carry a strong look, so they belong to the look track (`/abel:apply-look`), not to
  functional screens. Check the licence before copying.
- Try https://ui.ssych.com.

**Also seen:**
- voraui: crypto market charts on Binance data. Not relevant.
- AGW Reusables (build.abs.xyz): specific to the Abstract chain.
- `@okxconnect/ui` (1.9.1, 2025-10-24): the OKX Connect modal, stale for 11 months. OKX Wallet
  already works through EIP-6963 injection and WalletConnect.
- `@web3icons/react` (MIT, React 19, 2026-09-15): token and chain icons, usable behind
  onchain-ui's `crypto-icons` adapter.

---

## What no library gives us (build on ReUI)

- **An LTV / health meter that knows about market sessions**: current → projected LTV against
  the max and liquidation thresholds, plus the weekend/closed-market haircut. Model it on Aave's
  Risk details bars and Morpho's "LTV / LLTV current → new" row.
- **An approve-then-act stepper**: an explicit list of steps (approve USDG or wNVDAx, then
  deposit/borrow/repay), each with pending, confirmed and failed states and an explorer link.
  - Model it on Liquity's tx-flows and Morpho's `TransactionButton`.
  - wagmi's `useSendCalls` (EIP-5792) can batch approve and act into one step where the wallet
    supports it. Keep the two-step path as the fallback.
- **Borrow position cards** showing collateral, debt, LTV, liquidation price and the
  corporate-action/pause state.
- **A Lend loss-absorption explainer** (the gap reserve, then lenders).
- **A Market table** with session state (open/closed/weekend), depth caps and the price source.
  Build it on the ReUI data grid, with onchain-ui `AssetRow`/`TokenPrice` cells.
