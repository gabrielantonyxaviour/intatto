**Product.** Intatto is a lending market on X Layer, live on mainnet at intatto.larinova.com. Deposit tokenized stocks like NVDAx and borrow USDG against them, any day of the week. The borrowing limit follows the real US market session: 50% LTV while the market is open, lower while it's closed. The 65% liquidation threshold never moves, so a weekend close never pushes an open loan toward liquidation.

**Intended user.** Holders of the ~$90M of tokenized stocks on X Layer who want USDG without selling; nothing onchain lends against them today. Also USDG lenders, who earn 80% of the interest while 20% funds a gap reserve, and AI agents that check a wallet's borrowing capacity.

**Core integration.**
- X Layer mainnet: contracts, USDG loans, and prices checked against the X Layer pool's 30-min average; credit capped by the pool's sell depth.
- xStocks: NVDAx and SPYx collateral; a keeper relays the price and market session onchain.
- OKX AI: agent #13907 (listing under review), with an A2MCP service "Borrow capacity and health" returning session, limit, LTV and liquidation price read from the chain.
- Mainnet fork sandbox for trying any point in the market week.
