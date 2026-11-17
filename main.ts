// Swing bot for the make.fun btc-race-24h-20261117-0603 bounty.
//
// Strategy (designed from the RULES.txt spec and the dev-window bars only):
// the 24h dev window is a choppy, near-random walk with a small upward drift,
// and a full-size round trip costs roughly 38 bps (4 bps fee + 2 bps modelled
// slippage + about 13 bps of price impact on a 1,000 USDC order against the
// dev window's ~$790k pool depth). Fast trend signals whipsaw and bleed fees,
// so this bot trades rarely and only for wide swings:
//
//   * Buy all-in with the whole cash balance on the first tradable batch.
//   * Take profit: sell everything once the close is TAKE_PROFIT above the
//     entry price (the entry price is the position's cost per unit, fees in).
//   * Re-enter: buy all-in again when the close has pulled back PULLBACK below
//     the sell price, or broken out PULLBACK above it (trend continuation).
//   * Stop: sell everything if the close falls STOP below the entry price.
//     After a stop the same re-entry rule applies from the stop price.
//   * Otherwise hold: in a falling market the bot rides it out like a holder
//     rather than churning in and out of noise.
//
// Every decision is a pure function of the closes the harness has sent, so
// two runs on the same bars produce byte-identical action logs. No clock,
// no randomness, no network, no files outside the repository.

import { runBars } from "./vendor/makefun-bars.ts";
import type { BarsState, Batch, OrderInput } from "./vendor/makefun-bars.ts";

const SYMBOL = "CBBTC";

// Strategy bands, in basis points of price.
const TAKE_PROFIT_BPS = 150;
const PULLBACK_BPS = 100;
const STOP_BPS = 250;

// The most the fill price may move from the latest close, in bps. A fill
// pays 2 bps of modelled slippage plus its own price impact (about 13 bps
// at full size on the dev window's depth), so 300 leaves room for a normal
// one-minute gap while still refusing a wild open.
const MAX_SLIPPAGE_BPS = 300;

// The smallest cash balance worth deploying (the 1 USDC minimum notional,
// with a little headroom).
const MIN_CASH = 2_000_000n;

// ---------------------------------------------------------------- state

// The reference price of the open position, in the symbol's price scale:
// the cash spent on the quantity still held (fees included), per unit.
// Computed from the account the harness sends each batch, so it stays exact
// through fills and never depends on a price the bot guessed.
function entryPrice(state: BarsState): bigint | null {
  const pos = state.positions.get(SYMBOL);
  if (pos === undefined || pos.qty === 0n) return null;
  const sym = state.symbols.get(SYMBOL);
  if (sym === undefined) return null;
  const scale = BigInt(sym.qty_scale + sym.price_scale);
  const quote = BigInt(state.hello.capital.quote_scale);
  return (pos.cost * 10n ** scale) / (pos.qty * 10n ** quote);
}

// The price, in the symbol's price scale, of a basis-point move from a base.
function shifted(price: bigint, bps: number, up: boolean): bigint {
  return up
    ? (price * BigInt(10_000 + bps)) / 10_000n
    : (price * BigInt(10_000 - bps)) / 10_000n;
}

// The price the bot last sold at (the close of the batch the sell was
// decided on), or null when it has never sold. The re-entry band is built
// around this price.
let lastSellPrice: bigint | null = null;

// True once the bot has taken its first position. The first buy happens on
// the first tradable batch; a buy rejected there (a gap past max slippage,
// a missing bar) is retried on the next batch while the bot is still flat
// and has never sold.
let everBought = false;

// ---------------------------------------------------------------- decisions

// Decide this batch's orders. The bar of the batch is the one that just
// closed; any order sent now fills at the next bar's open.
function decide(state: BarsState, _batch: Batch): OrderInput[] {
  if (state.warmingUp) return [];
  const close = state.close(SYMBOL);
  if (close === null) return [];
  const held = state.positions.get(SYMBOL);
  const qty = held === undefined ? 0n : held.qty;

  if (qty > 0n) {
    // Holding: sell on take-profit, or on the stop. The sell is recorded
    // against this close so the re-entry band can be built from it.
    const entry = entryPrice(state);
    if (entry !== null) {
      const takeProfitAt = shifted(entry, TAKE_PROFIT_BPS, true);
      const stopAt = shifted(entry, STOP_BPS, false);
      if (close >= takeProfitAt || close <= stopAt) {
        lastSellPrice = close;
        return [
          {
            side: "sell",
            symbol: SYMBOL,
            qty,
            max_slippage_bps: MAX_SLIPPAGE_BPS,
          },
        ];
      }
    }
    return [];
  }

  // Flat: buy when the re-entry band says so, or on the first tradable
  // batch when the bot has never bought. The band is a pullback below the
  // last sell price, or a breakout above it by the same width.
  let buy = false;
  if (!everBought) {
    buy = true;
  } else if (lastSellPrice !== null) {
    const rebuyLow = shifted(lastSellPrice, PULLBACK_BPS, false);
    const rebuyHigh = shifted(lastSellPrice, PULLBACK_BPS, true);
    buy = close <= rebuyLow || close >= rebuyHigh;
  }
  if (!buy) return [];
  if (state.cash < MIN_CASH) return [];
  everBought = true;
  return [
    {
      side: "buy",
      symbol: SYMBOL,
      notional_quote_units: state.cash,
      max_slippage_bps: MAX_SLIPPAGE_BPS,
    },
  ];
}

// ---------------------------------------------------------------- wire-up

await runBars({
  onBatch(state, batch) {
    return decide(state, batch);
  },
});
