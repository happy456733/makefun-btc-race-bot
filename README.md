# makefun-btc-race-bot

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/happy456733/makefun-btc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/happy456733/makefun-btc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

A swing trading bot for cbBTC/USDC that races a BTC trading bot live for 24 hours on make.fun. It buys all-in on the first tradable minute bar, takes profit at +1.5% over its entry price, re-enters on a 1.0% pullback below (or breakout above) its last sell price, and stops out at −2.5% below entry. It trades rarely on purpose: on the choppy dev window a full-size round trip costs roughly 38 bps in fees, slippage and price impact, so fast signals only bleed fees.

## Run it

```sh
node main.ts
```

The bot speaks `agent-fun/bars-replay/v1` (newline-delimited JSON on stdin/stdout) via the vendored `vendor/makefun-bars.ts` shim. It needs no network, no clock and no randomness: every decision is a pure function of the closes the harness has sent, so two runs on the same bars produce byte-identical action logs.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>
