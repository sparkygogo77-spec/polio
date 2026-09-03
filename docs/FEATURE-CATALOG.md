# Trading Terminal Feature Catalog

Reference for Solcano (Solana) and the Pons / Robinhood Chain dual-trader project.

**Contents:** Feature Catalog (85 features from Axiom, Photon, BullX, GMGN, DexScreener and similar) · Match Features (PvP product only) · Glossary · Data Sources.

**Cost:** S = hours · M = days · L = a week or more, or needs its own service.

**Priority / Status** columns are blank for you to fill in. Priority: P0 / P1 / P2 / SKIP. Status: Planned / Building / Done.

**Data Source** is the column that decides feasibility — a feature is cheap or expensive almost entirely because of where its number comes from.

**Chain Notes** flags where a Solana concept does not map cleanly to EVM, or vice versa.

### Caveats

- Terminal product names drift. These are the common vocabulary, not guaranteed current labels for any one product.
- Pons mechanics come from docs.ponsfamily.com plus secondary sources, which disagree on Uniswap V3 vs V4 and on whether a bonding curve exists. Verify against the factory before building.
- Graduation threshold of 4.2 ETH paired WETH is from the Pons docs.
- Cost estimates assume the existing Next.js stack and one developer.

---

## Feature Catalog

| ID | Category | Feature Name | Also Known As | Description | Data Source | Chain Notes (SOL vs EVM) | Cost | Priority | Status |
|---|---|---|---|---|---|---|---|---|---|
| F01 | Discovery Feed | Three-Column Pulse | Pulse (Axiom) / Memescope (Photon) / Pump Vision (BullX) | The core discovery screen: three live columns splitting tokens by lifecycle stage. Left = brand new, middle = approaching graduation, right = graduated. Each column streams independently. | Factory TokenLaunched events + pool reserve reads, streamed over websocket. | Identical pattern both chains. On Pons the three stages key off paired WETH vs the 4.2 ETH threshold. | L |  |  |
| F02 | Discovery Feed | New Pairs Column | New Creations / Newly Created | Tokens launched seconds-to-minutes ago. Highest volume of rows, lowest signal. Usually the noisiest column and the one people filter hardest. | Factory creation event subscription. | Same both chains. | S |  |  |
| F03 | Discovery Feed | Final Stretch Column | About to Graduate / Almost Bonded | Tokens between roughly 50-99% of the graduation threshold. The highest-attention column because graduation is a liquidity and visibility event. | Pool paired-asset balance vs threshold constant. | On Pons: paired WETH / 4.2 ETH. | S |  |  |
| F04 | Discovery Feed | Migrated Column | Graduated / Bonded / Raydium'd | Tokens that crossed the threshold. On most launchpads this means liquidity moved to a real DEX pool; on Pons per docs nothing migrates, so it is a label not a move. | Threshold-crossed flag, or DEX pool creation event. | Verify Pons behaviour on-chain — docs and secondary sources disagree. | S |  |  |
| F05 | Discovery Feed | Live Row Streaming | Realtime feed | Rows appear and update without refresh, via websocket rather than polling. The single biggest perceived-quality difference between a terminal and a website. | eth_subscribe logs (EVM) or geyser/websocket (SOL). | EVM websockets are simpler and more reliable here. | M |  |  |
| F06 | Discovery Feed | New-Row Flash | Highlight animation | Brief colour flash on a newly inserted or updated row so the eye catches movement in a fast feed. | Client-side only. | Same. | S |  |  |
| F07 | Discovery Feed | Pause On Hover | Freeze feed | Feed stops auto-scrolling while the cursor is over a column, so a row cannot slide away mid-click. Small feature, disproportionately loved. | Client-side only. | Same. | S |  |  |
| F08 | Discovery Feed | Sound Alerts | Audio ping | Configurable sound when a row matching a saved filter appears. | Client-side, fired off filter match. | Same. | S |  |  |
| F09 | Discovery Feed | Density Toggle | Compact / comfortable view | Switch between tall cards and tight rows. Power users run maximum density. | Client-side only. | Same. | S |  |  |
| F10 | Discovery Feed | Column Config | Custom columns / layout presets | User picks which stage each column tracks and which metrics show, then saves the layout. | Local storage or user profile. | Same. | M |  |  |
| F11 | Token Card | Token Card Row | Coin card / pair row | The atomic unit of the feed: avatar, ticker, name, age, market cap, volume, socials, metric badges, quick-buy. Everything else hangs off this. | Composite of all card-level sources. | Same. | M |  |  |
| F12 | Token Card | Market Cap | MC / MCap / FDV | Price x circulating supply. Note this is NOT depth — a token can show $1M MC on a few ETH of real liquidity. Most-displayed and most-misread number on the screen. | Pool spot price x total supply. | Same. Fully-diluted vs circulating differs by launchpad; on fixed-supply launches they converge. | S |  |  |
| F13 | Token Card | Volume | V / Vol | Traded value over the card's window, usually 5m/1h/24h selectable. | Sum of swap event amounts in window. | Same. | S |  |  |
| F14 | Token Card | Liquidity | Liq / Pooled / Reserve | Actual paired asset sitting in the pool. The number that determines what trade size the token can absorb. Far more important than MC for anything execution-related. | Direct pool contract balance read. | On Pons read paired WETH from the Uniswap pool. | S |  |  |
| F15 | Token Card | Transaction Count | TX / Txns, often split B/S | Number of swaps in the window, usually broken into buys vs sells. Buy/sell skew is a common momentum read. | Swap event count, direction inferred from amounts. | Same. | S |  |  |
| F16 | Token Card | Age | Created / Launch time | Time since launch, formatted tightly (2s, 14m, 7h). Drives the column a token belongs in. | Block timestamp of creation event. | Same. | S |  |  |
| F17 | Token Card | Holder Count | Holders | Unique addresses with non-zero balance. Expensive to compute exactly, usually approximated by an indexer. | Indexer aggregating Transfer events. Not cheap — this is the classic 'looks simple, costs a week' metric. | Same cost problem both chains. | L |  |  |
| F18 | Token Card | Bonding / Graduation Progress | Progress bar / curve % | Percentage of the way to the graduation threshold, usually a thin coloured bar under the card. | Paired asset balance / threshold. | Pons: /4.2 ETH. | S |  |  |
| F19 | Token Card | Socials Row | Links cluster | Inline icons for X, Telegram, website, plus a search icon that queries X for the contract address. The search icon matters more than the links — it surfaces whether anyone is actually talking. | Token metadata + X search deeplink. | Same. | S |  |  |
| F20 | Token Card | Contract Copy | CA copy button | One-click copy of the contract address. Trivial, universally present, immediately noticed when missing. | Client-side. | Same. | S |  |  |
| F21 | Token Card | Paid Listing Badge | DS / DEX Paid / Boosted | Marks that someone paid for enhanced listing on an aggregator. A weak spend signal — it means someone put money behind visibility. | Aggregator API. | Depends on which aggregators cover the chain. | S |  |  |
| F22 | Token Card | Hide / Blur Toggle | Eye icon | Blur or hide a column's content — used for screen-sharing and streaming without leaking positions. | Client-side. | Same. | S |  |  |
| F23 | Holder Intel | Dev Holding % | DH / Creator % | Share of supply still held by the deployer. Rising is neutral, falling fast is the classic exit signal. | Creator balance / supply, tracked over time. | Same. | M |  |  |
| F24 | Holder Intel | Top 10 Holders % | T10 / Concentration | Combined share of the ten largest non-pool wallets. The standard concentration read. | Indexed balance ranking, pool and burn addresses excluded. | Same. | M |  |  |
| F25 | Holder Intel | Sniper % | Snipers | Supply captured by wallets that bought in the first block or few blocks. High sniper share means the float is held by fast money that will sell into the first bid. | Buyers within N blocks of creation, from swap events. | Cleaner on EVM — block boundaries are unambiguous in logs. | M |  |  |
| F26 | Holder Intel | Bundled % | Bundlers / Bundle buys | Supply bought in coordinated same-block transactions at launch — usually the deployer seeding wallets to fake distribution. | Same-block multi-wallet buy clustering. | SOL term comes from Jito bundles; on EVM detect same-block co-ordinated buys. Concept ports, mechanism differs. | L |  |  |
| F27 | Holder Intel | Insider % | Linked wallets | Supply held by wallets connected to the deployer through funding history. Requires walking the funding graph backwards. | Funding-graph traversal over native transfers. | Same approach both chains, meaningful indexing cost. | L |  |  |
| F28 | Holder Intel | Fresh Wallet % | New wallets | Share held by addresses with little or no prior history. High values suggest manufactured distribution. | First-seen timestamp and tx count per holder. | Same. | M |  |  |
| F29 | Holder Intel | Smart Money Count | Pro traders / KOL holders | How many wallets from a curated profitable-trader list currently hold. The highest-signal single number on most cards, and the hardest to build because the list is the product. | Your own labelled wallet set, scored on realised PnL. | Same. Building the list is the real work, not the display. | L |  |  |
| F30 | Holder Intel | Bubble Map | Holder graph / cluster map | Force-directed graph of holders with edges for transfers between them. Clusters reveal one entity behind many wallets. | Transfer graph between top holders. | Same. | L |  |  |
| F31 | Holder Intel | Holder Distribution Chart | Supply breakdown | Bar or pie of supply across holder tiers — pool, dev, top 10, everyone else. | Indexed balances. | Same. | M |  |  |
| F32 | Holder Intel | Dev History | Deployer's other tokens | Every prior token from the same deployer with its outcome. The single best rug predictor available. | Factory events filtered by creator address. | Trivial on EVM with the Pons TokenLaunched topic. This is a strong argument for the EVM build. | M |  |  |
| F33 | Safety & Audit | Mint Authority Check | Can mint more | Whether supply can still be inflated. On SOL a specific authority field; on EVM you must inspect the contract for a callable mint path. | SOL: mint authority field. EVM: bytecode/ABI inspection for mint and owner. | Materially harder on EVM — no standard field, needs source or bytecode analysis. | M |  |  |
| F34 | Safety & Audit | Freeze / Blacklist Check | Can freeze transfers | Whether the deployer can block a holder from selling. SOL freeze authority; EVM pausable or blacklist modifiers. | SOL: freeze authority. EVM: contract inspection. | Same asymmetry as F33. | M |  |  |
| F35 | Safety & Audit | LP Lock / Burn Status | Liquidity locked | Whether pool liquidity can be pulled. The most direct rug vector. | LP token holder / lock contract state. | On Pons this is locked permanently by protocol design, so it becomes a constant rather than a check. | S |  |  |
| F36 | Safety & Audit | Honeypot Test | Can sell / sellability | Simulates a sell to confirm exit is actually possible. Catches contracts that accept buys and silently block sells. | eth_call simulation against the router. | Cleaner on EVM — simulation is a first-class RPC feature. | M |  |  |
| F37 | Safety & Audit | Buy / Sell Tax | Transfer fee | Percentage skimmed on trade. Detected by simulating and comparing expected vs received. | Simulation diff. | EVM-native concept; less common on SOL. | M |  |  |
| F38 | Safety & Audit | Rug Score | Safety score / risk badge | Composite of the above into one number or colour. Convenient, and dangerous if users treat it as a guarantee. | Derived from other checks. | Same. Label it clearly as heuristic. | M |  |  |
| F39 | Safety & Audit | Contract Verification | Source verified | Whether verified source is published on the explorer. Unverified is not automatically bad but limits every other check. | Explorer API. | EVM-specific and central; no clean SOL equivalent. | S |  |  |
| F40 | Charting | Advanced Chart | TradingView widget | Full candlestick chart with drawing tools, indicators, and timeframes. Nearly every terminal embeds TradingView rather than building this. | OHLCV series from an indexer or aggregated from swaps. | Same. Building OHLCV from raw swaps is the real cost. | L |  |  |
| F41 | Charting | MC / Price Toggle | Denomination switch | Plot market cap instead of unit price. Preferred in memecoin trading because unit prices are unintuitively small. | Same series, multiplied by supply. | Same. | S |  |  |
| F42 | Charting | Currency Toggle | USD / ETH denomination | Show values in the native asset or in dollars. Matters because the native asset itself moves. | Chart series x native price feed. | Same. | S |  |  |
| F43 | Charting | Your Trades On Chart | Trade markers / entry-exit pins | Your buys and sells pinned on the candles at their execution price. Directly the feature you want for the dual-player replay. | Your own fills joined to the price series by timestamp. | Same. Straightforward once fills are indexed. | M |  |  |
| F44 | Charting | Holder Count Overlay | Holders line | Holder count plotted over price. Divergence — price up, holders flat — is a distribution tell. | Time-series holder snapshots. | Requires holder indexing (F17) first. | L |  |  |
| F45 | Charting | Dev Activity Markers | Dev sold pin | Markers where the deployer bought, sold, or moved supply. | Creator-address swaps and transfers. | Same. | M |  |  |
| F46 | Charting | Live Trade Tape | Transactions table | Scrolling table of every swap — time, side, size, price, wallet. Usually below the chart. | Swap event stream. | Same. | M |  |  |
| F47 | Trade Execution | Quick Buy | Instant buy / lightning buy | One-click buy at a preset size straight from the feed card, no confirmation dialog. The defining terminal feature — it is why people use a terminal instead of a DEX. | Router swap call with pre-set params. | Same. Custody model determines how the click signs. | M |  |  |
| F48 | Trade Execution | Preset Slots | P1 / P2 / P3 | Saved trade configurations — size, slippage, priority fee, tip — switchable with one click. Visible in your screenshot. | User profile storage. | Same. | S |  |  |
| F49 | Trade Execution | Slippage Control | Max slippage | Tolerance before a trade reverts. Critical on thin pools, which is most of them. | Router minOut parameter. | Same. | S |  |  |
| F50 | Trade Execution | Priority Fee | Gas boost / bribe / tip | Extra payment for faster inclusion. | Transaction fee params. | SOL uses Jito tips; EVM uses priority fee. Robinhood Chain runs a sequencer, so the competitive dynamic is different from L1 — worth measuring before exposing the control. | S |  |  |
| F51 | Trade Execution | Anti-MEV Toggle | Private RPC / protected send | Route through a private mempool so the trade cannot be sandwiched. | Alternate RPC endpoint. | Depends entirely on Robinhood Chain sequencer policy. Verify before promising protection. | M |  |  |
| F52 | Trade Execution | Sell Percentage Chips | 25/50/100% buttons | One-tap partial exits at fixed fractions of the position. | Balance read x fraction. | Same. | S |  |  |
| F53 | Trade Execution | Auto-Approve | Pre-approval / session key | Skip the per-trade token approval so buys are one signature. Big UX win, real security tradeoff — spell it out to users. | ERC-20 approve, or a session-scoped key. | EVM-specific problem. SOL has no approval step, which is why SOL terminals feel faster. | M |  |  |
| F54 | Order Types | Limit Order | Trigger buy / sell | Execute when price reaches a level. Needs an off-chain keeper to watch and fire. | Keeper service + price feed. | Same. Keeper is the cost, not the UI. | L |  |  |
| F55 | Order Types | Take Profit / Stop Loss | TP/SL / auto-sell | Automatic exit at a target or a floor, often laddered across several levels. | Keeper service. | Same. | L |  |  |
| F56 | Order Types | Trailing Stop | Trailing SL | Stop that follows price up and locks in gains on reversal. | Keeper tracking running max. | Same. | L |  |  |
| F57 | Order Types | DCA / Scaled Orders | Ladder / split entry | Split an entry or exit across time or price levels. | Keeper service. | Same. | M |  |  |
| F58 | Order Types | Auto-Buy Rules | Sniper rules | Buy automatically when a new token matches a saved filter. The most powerful and most dangerous feature in any terminal. | Filter engine wired to execution. | Same. Needs hard caps and a kill switch. | L |  |  |
| F59 | Positions & PnL | Positions Table | Holdings / open positions | Every open position with size, average entry, current value, unrealised PnL. | Balances + cost basis from your fills. | Same. | M |  |  |
| F60 | Positions & PnL | Cost Basis | Average entry | Average price paid, needing a documented convention — FIFO or weighted average — because the two disagree on partial exits. | Computed from fill history. | Same. Pick one convention and state it. | M |  |  |
| F61 | Positions & PnL | Realised vs Unrealised | PnL split | Separates locked-in profit from marks. The distinction that matters for your match scoring — realised is manipulation-resistant, unrealised is not. | Fill history vs current mark. | Same. Directly relevant to the PvP design. | M |  |  |
| F62 | Positions & PnL | Shareable PnL Card | Flex card / PnL image | Generated image of a trade's return, styled for sharing. Pure growth mechanic, cheap to build, high return. | Server-rendered image from position data. | Same. Obvious fit for match results. | M |  |  |
| F63 | Positions & PnL | Portfolio Summary | Balance overview | Total value, day change, allocation across holdings. | Aggregated balances x prices. | Same. | M |  |  |
| F64 | Positions & PnL | Trade History | Fills / journal | Every historical fill, exportable to CSV. Users want this for taxes and for reviewing their own decisions. | Indexed own-wallet swaps. | Same. | M |  |  |
| F65 | Wallet Intel | Wallet Tracker | Follow wallet / watchlist | Live feed of chosen wallets' trades. The backbone of most copy-trading features. | Filtered swap subscription per address. | Same. | M |  |  |
| F66 | Wallet Intel | Copy Trading | Mirror trading | Automatically mirror a followed wallet's trades at your own size. Heaviest feature in this list, and carries the most regulatory weight — you are executing on someone's behalf based on someone else's activity. | Tracker + execution engine + risk limits. | Same. Get advice before shipping. | L |  |  |
| F67 | Wallet Intel | Wallet PnL Profile | Trader scorecard | Full history for any address — win rate, realised PnL, average hold, best and worst trades. This is also exactly your match-scoring engine, so build it once. | Full swap history + cost basis. | Same. Shared component with the PvP product. | L |  |  |
| F68 | Wallet Intel | Wallet Labels | Known entity tags | Human-readable tags — exchange, bot, known trader — on addresses. | Own labelling plus third-party datasets. | Coverage on a new chain will be thin; expect to build your own. | L |  |  |
| F69 | Wallet Intel | Common Holders | Cross-holding overlap | Which wallets hold two given tokens. Reveals coordinated groups. | Indexed balances intersected. | Same. | M |  |  |
| F70 | Social & Signals | X / Twitter Tracker | CA mention feed | Live feed of posts mentioning a contract address or ticker, ideally weighted by account reach. | X API, which is a real cost line. | Same. Budget for it explicitly. | L |  |  |
| F71 | Social & Signals | Ticker Collision Warning | Duplicate name alert | Flags that a ticker matches existing tokens — the impersonation vector. | Own token index. | Same. | S |  |  |
| F72 | Social & Signals | Social Freshness | Account age / follower check | Age and following of the linked X account. New account plus large following is a bought-audience tell. | X API. | Same. | M |  |  |
| F73 | Social & Signals | Trending List | Hot / gainers | Ranked by volume, transactions, or holder growth over a window. | Aggregated metrics. | Same. | M |  |  |
| F74 | Social & Signals | Watchlist | Favourites / starred | User-curated token list with its own feed. | User profile storage. | Same. | S |  |  |
| F75 | Filtering & Alerts | Filter Panel | Filters / screener | Multi-criteria filtering on every card metric — liquidity floor, holder count, dev holding ceiling, age band. The sliders icon in your screenshot. | Query layer over indexed data. | Same. Design the index for these queries up front. | L |  |  |
| F76 | Filtering & Alerts | Saved Filter Presets | Named filters | Save and switch named filter sets. Power users live in three or four. | User profile storage. | Same. | S |  |  |
| F77 | Filtering & Alerts | Blacklist | Blocked devs / tokens | Permanently hide tokens from specified deployers. | User profile + creator index. | Same. | S |  |  |
| F78 | Filtering & Alerts | Price Alerts | MC / price triggers | Notify at a price or market cap level. | Keeper + notification channel. | Same. | M |  |  |
| F79 | Filtering & Alerts | New Token By Dev Alert | Deployer alert | Fires when a watched deployer launches anything new. High signal if your deployer list is good. | Factory events filtered by creator. | Cheap on EVM with the Pons event topic. | S |  |  |
| F80 | UX & Performance | Keyboard Shortcuts | Hotkeys | Buy, sell, switch preset, focus search without the mouse. Separates a terminal from a website. | Client-side. | Same. | M |  |  |
| F81 | UX & Performance | Virtualised Lists | Windowing | Render only visible rows. Mandatory — a thousand live rows without it will lock the tab. | Client-side. | Same. Do this early, retrofitting is painful. | M |  |  |
| F82 | UX & Performance | Optimistic UI | Instant feedback | Show the trade as pending the instant it is signed rather than waiting for confirmation. | Client-side state. | Same. Matters more on slow chains; less so at 100ms blocks. | M |  |  |
| F83 | UX & Performance | Multi-Wallet | Wallet switcher | Hold several wallets and switch or trade across them. | Key management. | Same. Custody model decides difficulty. | L |  |  |
| F84 | UX & Performance | Mobile Layout | Responsive / PWA | A usable phone layout. Three live columns do not survive a narrow screen — this is a redesign, not a media query. | Client-side. | Same. | L |  |  |
| F85 | UX & Performance | Referral System | Ref links / fee share | Referral codes with a share of fees. Standard growth loop in this category. | Attribution store + fee split. | Same. | M |  |  |


## Match Features

| ID | Phase | Feature Name | Also Known As | Description / Why It Matters | Importance | Priority | Status |
|---|---|---|---|---|---|---|---|
| M01 | Match Setup | Match Lobby | Open challenges / matchmaking | List of open matches with stake, mode, and token. Where a match is created or joined. | High |  |  |
| M02 | Match Setup | Dual Approval Handshake | Both-sign initiation | Match starts only once both parties have deposited and signed. Neither can be committed unilaterally. | High |  |  |
| M03 | Match Setup | Matched Stake Escrow | Vault deposit | Equal stakes held by a per-match vault contract for the duration. | High |  |  |
| M04 | Match Setup | Token Selection Post-Audit | Curated pool | Match token drawn from a vetted list that passed audit and liquidity screening. | High |  |  |
| M05 | Match Setup | Liquidity-Derived Trade Cap | Position limit | Max trade size computed from pool depth, not market cap. Slippage is roughly trade size / paired WETH — size limits off that. | High |  |  |
| M06 | Match Setup | Mode: Synchronised Entry | Same-block buy | Contract buys for both players in one transaction at an identical fill. Removes entry skill and ordering luck; contest is purely exit timing. Cleanest fair version. | High |  |  |
| M07 | Match Setup | Mode: Free Entry Window | Open entry | Players enter when they choose inside the window. Richer game, but reintroduces mutual price impact and ordering luck. | Med |  |  |
| M08 | Match Setup | Mode: No Forced Entry | Optional participation | Sitting out is a legal move. Makes patience a strategy and prevents forced bad entries. | Med |  |  |
| M09 | Match Setup | Token Reveal At Start | Sealed selection | Token is not disclosed until the bell, so outsiders cannot pre-position against both players. | High |  |  |
| M10 | Match Setup | Win Condition Config | Time / threshold | Match ends on a timer, on a market-cap threshold, or whichever comes first. | High |  |  |
| M11 | Live View | Split-Screen Dual Chart | Head-to-head view | One shared price chart with both players' fills marked in their own colour. | High |  |  |
| M12 | Live View | Live PnL Race Bar | Head-to-head meter | Single bar showing who currently leads and by how much. The signature spectator element. | High |  |  |
| M13 | Live View | Countdown Timer | Match clock | Prominent remaining time, with a visible final-minute state change. | High |  |  |
| M14 | Live View | Opponent Action Feed | Live opponent trades | Opponent's fills as they happen. Decide deliberately whether this is visible — hidden creates poker, visible creates racing. | High |  |  |
| M15 | Live View | Position Panel Per Player | Dual holdings | Each side's current size, average entry, realised and unrealised split. | High |  |  |
| M16 | Live View | Spectator Mode | Watch match | Read-only live view for non-participants. The growth surface for the whole product. | Med |  |  |
| M17 | Live View | Slippage Warning | Impact preview | Pre-trade estimate of price impact given current depth. Necessary on thin pools. | High |  |  |
| M18 | Scoring | Realised-Only Scoring | Exit-to-settle | Only completed round-trips count. The core anti-manipulation choice — unrealised marks on thin tokens are gameable. | High |  |  |
| M19 | Scoring | Forced Liquidation At Bell | Auto-close | Contract closes open positions at expiry so both settle in the same asset at the same price. | High |  |  |
| M20 | Scoring | ROI Formula Display | Scoring transparency | The exact formula shown in the UI. Every dispute you avoid is worth more than the screen space. | High |  |  |
| M21 | Scoring | Fee-Inclusive Accounting | Net of costs | Gas, swap fees, and impact charged to the player who incurred them. | High |  |  |
| M22 | Scoring | Tie Handling | Draw rules | Explicit rule for equal or both-negative outcomes. Decide whether best-of-two-losses wins or stakes return. | High |  |  |
| M23 | Settlement | Optimistic Settlement | Challenge window | Result posted, dispute window opens, payout if unchallenged. Removes you as trusted referee — the single most important architectural choice here. | High |  |  |
| M24 | Settlement | Verifiable Replay | Recompute from logs | Anyone can rerun scoring from public chain data and reach the same result. What makes the challenge window meaningful rather than decorative. | High |  |  |
| M25 | Settlement | Post-Match Replay | Trade timeline | Both players' trades replayed over the candles after settlement. Your stated must-have. | High |  |  |
| M26 | Settlement | Rake Configuration | Platform fee | Transparent cut, ideally capped, visible before the match starts. | Med |  |  |
| M27 | Settlement | Match History | Past matches | Archive of completed matches with full replay. | Med |  |  |
| M28 | Settlement | Leaderboard / Rating | ELO / ranking | Skill rating across matches. Adds retention and creates the sybil and collusion surface you will then have to police. | Med |  |  |
| M29 | Settlement | Abandonment Handling | Timeout / forfeit | What happens when a player disconnects or never trades. Needs a rule before launch, not after the first incident. | High |  |  |
| M30 | Settlement | Emergency Pause | Circuit breaker | Halt matches and return stakes if the token is rugged or the pool breaks mid-match. Non-negotiable for a contract holding funds. | High |  |  |


## Glossary

| Term | Full Name | Definition |
|---|---|---|
| MC / MCap | Market capitalisation | Price x supply. Not liquidity, not depth. A token can show $1M MC on a few ETH of real pool. |
| FDV | Fully diluted valuation | Price x total supply including unreleased. Converges with MC on fixed-supply launches. |
| Liq / Pooled | Liquidity | Paired asset actually in the pool. Determines absorbable trade size. |
| Depth | Market depth | How much size the book absorbs at a given impact. For constant-product AMMs, avg slippage is approximately trade size / paired reserve. |
| V / Vol | Volume | Traded value in the selected window. |
| TX (B/S) | Transactions, buys/sells | Swap count, usually split by direction. Skew is a momentum read. |
| Age | Time since launch | Displayed tightly — 2s, 14m, 7h. |
| Bonding curve | Pricing curve | Pricing mechanism before graduation. Note Pons docs claim no bonding curve — verify on-chain. |
| Graduation | Bonding complete | Crossing the liquidity threshold. On Pons this is 4.2 ETH paired and per docs involves no migration. |
| Migration | Pool move | Moving liquidity from launchpad to a DEX. Absent on Pons per docs — the pool is real from launch. |
| DH | Dev holding | Deployer's remaining share of supply. |
| T10 | Top 10 holders | Combined share of ten largest non-pool wallets. |
| Sniper | First-block buyer | Bought within the first block or few blocks of launch. |
| Bundler | Bundled buyer | Bought in coordinated same-block transactions, usually deployer-linked. From Jito bundles on SOL. |
| Insider | Linked wallet | Connected to the deployer through funding history. |
| Fresh wallet | New address | Little or no prior history. Suggests manufactured distribution. |
| Smart money | Tracked profitable wallet | On a curated list of historically profitable traders. |
| Honeypot | Unsellable token | Accepts buys, blocks sells. |
| Rug | Liquidity removal | Deployer pulls the pool. Structurally impossible where liquidity is permanently locked. |
| Soft rug | Abandonment | Team walks away without pulling liquidity. Not detectable on-chain. |
| LP burn / lock | Liquidity locked | LP tokens destroyed or time-locked so the pool cannot be pulled. |
| Mint authority | Supply control | Ability to create more supply. A named field on SOL; on EVM requires contract inspection. |
| Freeze authority | Transfer control | Ability to block transfers. EVM equivalent is a pausable or blacklist modifier. |
| Slippage | Execution deviation | Difference between quoted and filled price. |
| Price impact | Your own effect | How much your trade moves the price. Distinct from slippage, often conflated. |
| MEV | Extractable value | Value taken by reordering transactions around yours. |
| Sandwich | MEV attack | Attacker buys ahead of you and sells behind you. |
| Priority fee | Inclusion bid | Extra payment for faster inclusion. Jito tip is the SOL analogue. |
| Quick buy | One-click buy | Preset-size buy with no confirmation step. |
| Preset (P1/P2/P3) | Saved trade config | Stored size, slippage, and fee settings. |
| Pulse / Memescope | Discovery feed | The three-column live launch feed. Names vary by terminal. |
| Final stretch | Near graduation | Approaching the liquidity threshold. |
| PnL card | Flex card | Shareable image of a trade's return. |
| Cost basis | Average entry | Average price paid. FIFO and weighted-average disagree on partial exits — pick one and document it. |
| Realised PnL | Locked-in profit | From completed round-trips. Manipulation-resistant. |
| Unrealised PnL | Mark-to-market | On open positions. Gameable on thin liquidity. |
| TWR | Time-weighted return | Return that neutralises deposit and withdrawal timing. Unnecessary if stakes are fixed for the match. |
| Wash trading | Self-dealing | Trading with yourself to fake volume or price. The primary attack on any PnL contest. |
| Optimistic settlement | Challenge-window payout | Post result, allow dispute, pay if unchallenged. |


## Data Sources

| Source | Feeds Which Features | How To Query | Endpoint / Address | Cost | Notes |
|---|---|---|---|---|---|
| Factory events | Token creations, creator attribution | eth_getLogs on TokenLaunched | Active 0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB / Legacy 0x0c37a24F5D23A486FA692d1500881d698B1F77a4 | Free (own RPC) | Replaces the entire Solana history-scan approach. |
| Pool reserves | Liquidity, price, graduation % | Direct contract read | Uniswap pool per token | Free (own RPC) | Verify V3 vs V4 — docs and secondary sources disagree. |
| Swap events | Volume, txns, tape, fills, PnL | eth_getLogs / eth_subscribe | Pool contracts | Free (own RPC) | Foundation of scoring and every PnL feature. |
| Transfer events | Holders, distribution, clusters | Indexed Transfer logs | Token contracts | Indexer cost | The expensive one. Needs its own database. |
| OHLCV | Charts | Aggregate swaps, or buy a feed | Own indexer or data vendor | Build or subscribe | Building candles from raw swaps is the hidden cost behind 'add a chart'. |
| Simulation | Honeypot, tax, impact preview | eth_call against router | Router contract | Free (own RPC) | Much cleaner on EVM than SOL. |
| Contract inspection | Mint, freeze, blacklist checks | Explorer API or bytecode analysis | Block explorer | Free tier likely | No standard field on EVM — harder than the SOL equivalent. |
| Social | X mentions, account age | X API | X / Twitter | Paid, non-trivial | Budget explicitly. Common surprise line item. |
| Native price | USD denomination | Price oracle or exchange API | Any | Free tier likely | You already have a working pattern for this in Solcano. |
| Wallet labels | Smart money, entity tags | Own labelling | Own indexer | Build | Third-party coverage on a new chain will be thin. |

