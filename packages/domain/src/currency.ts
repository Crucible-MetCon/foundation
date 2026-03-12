/** Supported currency codes */
export type CurrencyCode = "USD" | "ZAR" | "XAU" | "XAG" | "XPT" | "XPD";

/** Trade side */
export type TradeSide = "BUY" | "SELL";

/** Supported trading symbols */
export type TradingSymbol = "XAUUSD" | "USDZAR" | "XAGUSD" | "XPTUSD" | "XPDUSD";

/** Grams per troy ounce */
export const GRAMS_PER_TROY_OUNCE = 31.1035;

/** Symbol base/quote decomposition */
export const SYMBOL_PAIRS: Record<
  TradingSymbol,
  { base: CurrencyCode; quote: CurrencyCode }
> = {
  XAUUSD: { base: "XAU", quote: "USD" },
  USDZAR: { base: "USD", quote: "ZAR" },
  XAGUSD: { base: "XAG", quote: "USD" },
  XPTUSD: { base: "XPT", quote: "USD" },
  XPDUSD: { base: "XPD", quote: "USD" },
};

/**
 * Calculate debit/credit amounts from a trade.
 *
 * XAUUSD BUY: credit XAU (receive metal), debit USD (pay cash)
 * XAUUSD SELL: debit XAU (deliver metal), credit USD (receive cash)
 * USDZAR BUY: credit USD, debit ZAR
 * USDZAR SELL: debit USD, credit ZAR
 */
export function computeDebitCredit(
  symbol: TradingSymbol,
  side: TradeSide,
  quantity: number,
  price: number
): Record<CurrencyCode, { debit: number; credit: number }> {
  const result: Record<CurrencyCode, { debit: number; credit: number }> = {
    USD: { debit: 0, credit: 0 },
    ZAR: { debit: 0, credit: 0 },
    XAU: { debit: 0, credit: 0 },
    XAG: { debit: 0, credit: 0 },
    XPT: { debit: 0, credit: 0 },
    XPD: { debit: 0, credit: 0 },
  };

  const pair = SYMBOL_PAIRS[symbol];
  if (!pair) return result;

  const baseAmount = Math.abs(quantity);
  const quoteAmount = Math.abs(quantity * price);

  if (side === "BUY") {
    result[pair.base].credit = baseAmount;
    result[pair.quote].debit = quoteAmount;
  } else {
    result[pair.base].debit = baseAmount;
    result[pair.quote].credit = quoteAmount;
  }

  return result;
}

/** Convert grams to troy ounces */
export function gramsToOunces(grams: number): number {
  return grams / GRAMS_PER_TROY_OUNCE;
}

/** Convert troy ounces to grams */
export function ouncesToGrams(ounces: number): number {
  return ounces * GRAMS_PER_TROY_OUNCE;
}
