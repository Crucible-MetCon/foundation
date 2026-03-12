/**
 * Hedging Comparison Domain Logic
 *
 * Compares TradeMC metal bookings against PMX/StoneX trades to determine
 * whether each trade is fully hedged (metal position closed + USD position flat).
 */

import { GRAMS_PER_TROY_OUNCE } from "./currency";

export interface TradeMcBooking {
  refNumber: string;
  weightGrams: number;
  companyName: string;
  status: string;
  tradeTimestamp: string;
}

export interface PmxHedgeTrade {
  orderId: string;       // Trade number
  symbol: string;        // XAUUSD or USDZAR
  side: string;          // BUY or SELL
  quantity: number;
  price: number;
}

export interface HedgingRow {
  tradeNum: string;
  tmWeightG: number;
  tmWeightOz: number;
  companyName: string;
  stonexBuyOz: number;
  stonexSellOz: number;
  stonexNetOz: number;     // SELL - BUY (positive = net sold gold)
  stonexHedgeG: number;
  pmxNetUsd: number;       // Net USD position from all trades
  hedgeNeedG: number;      // tmWeightG - stonexHedgeG
  metalNeedOz: number;
  usdNeed: number;
  metalHedged: boolean;
  usdHedged: boolean;
  hedged: boolean;
  hedgeStatus: string;     // "Hedged" | "USD to cut" | "Metal to hedge" | "Metal + USD"
}

export interface HedgingSummary {
  totalTrades: number;
  fullyHedged: number;
  partiallyHedged: number;
  unhedged: number;
  totalMetalGapG: number;
  totalMetalGapOz: number;
  totalUsdRemaining: number;
}

/**
 * Build hedging comparison between TradeMC bookings and PMX trades.
 *
 * @param bookings - TradeMC confirmed trades with ref_number (grouped by refNumber)
 * @param pmxTrades - PMX trades with orderId matching refNumber
 * @param metalToleranceG - Metal tolerance in grams (default 32g ≈ 1oz)
 * @param usdTolerance - USD tolerance (default $1.00)
 */
export function buildHedgingComparison(
  bookings: TradeMcBooking[],
  pmxTrades: PmxHedgeTrade[],
  metalToleranceG = 32,
  usdTolerance = 1,
): HedgingRow[] {
  // Group TradeMC bookings by normalized refNumber
  const tmByRef: Record<string, { weightG: number; companyName: string }> = {};
  for (const b of bookings) {
    const ref = normalizeRef(b.refNumber);
    if (!ref) continue;
    if (!tmByRef[ref]) {
      tmByRef[ref] = { weightG: 0, companyName: b.companyName || "" };
    }
    tmByRef[ref].weightG += b.weightGrams || 0;
    if (!tmByRef[ref].companyName && b.companyName) {
      tmByRef[ref].companyName = b.companyName;
    }
  }

  // Group PMX trades by normalized orderId
  const pmxByRef: Record<
    string,
    { buyOz: number; sellOz: number; netUsd: number }
  > = {};
  for (const t of pmxTrades) {
    const ref = normalizeRef(t.orderId);
    if (!ref) continue;
    if (!pmxByRef[ref]) {
      pmxByRef[ref] = { buyOz: 0, sellOz: 0, netUsd: 0 };
    }

    const sym = (t.symbol || "").toUpperCase().replace(/[/\- ]/g, "");
    const side = (t.side || "").toUpperCase();
    const qty = Math.abs(t.quantity);
    const px = Math.abs(t.price);

    if (sym === "XAUUSD" || sym.startsWith("XAU")) {
      if (side === "BUY") {
        pmxByRef[ref].buyOz += qty;
        pmxByRef[ref].netUsd -= qty * px; // BUY gold = debit USD
      } else {
        pmxByRef[ref].sellOz += qty;
        pmxByRef[ref].netUsd += qty * px; // SELL gold = credit USD
      }
    } else if (sym === "USDZAR" || sym.startsWith("USD")) {
      if (side === "SELL") {
        pmxByRef[ref].netUsd -= qty; // SELL USD = debit USD
      } else {
        pmxByRef[ref].netUsd += qty; // BUY USD = credit USD
      }
    }
  }

  // Merge all known refs
  const allRefs = new Set([...Object.keys(tmByRef), ...Object.keys(pmxByRef)]);
  const rows: HedgingRow[] = [];

  for (const ref of allRefs) {
    const tm = tmByRef[ref] || { weightG: 0, companyName: "" };
    const pmx = pmxByRef[ref] || { buyOz: 0, sellOz: 0, netUsd: 0 };

    const tmWeightOz = tm.weightG / GRAMS_PER_TROY_OUNCE;
    const stonexNetOz = pmx.sellOz - pmx.buyOz; // Positive = net sold
    const stonexHedgeG = stonexNetOz * GRAMS_PER_TROY_OUNCE;
    const hedgeNeedG = tm.weightG - stonexHedgeG;
    const metalNeedOz = hedgeNeedG / GRAMS_PER_TROY_OUNCE;

    const metalHedged = Math.abs(hedgeNeedG) <= metalToleranceG;
    const usdHedged = Math.abs(pmx.netUsd) <= usdTolerance;
    const hedged = metalHedged && usdHedged;

    let hedgeStatus: string;
    if (hedged) {
      hedgeStatus = "Hedged";
    } else if (metalHedged && !usdHedged) {
      hedgeStatus = "USD to cut";
    } else if (!metalHedged && usdHedged) {
      hedgeStatus = "Metal to hedge";
    } else {
      hedgeStatus = "Metal + USD";
    }

    rows.push({
      tradeNum: ref,
      tmWeightG: tm.weightG,
      tmWeightOz,
      companyName: tm.companyName,
      stonexBuyOz: pmx.buyOz,
      stonexSellOz: pmx.sellOz,
      stonexNetOz,
      stonexHedgeG,
      pmxNetUsd: pmx.netUsd,
      hedgeNeedG,
      metalNeedOz,
      usdNeed: Math.abs(pmx.netUsd),
      metalHedged,
      usdHedged,
      hedged,
      hedgeStatus,
    });
  }

  // Sort: unhedged first, then by trade number
  rows.sort((a, b) => {
    if (a.hedged !== b.hedged) return a.hedged ? 1 : -1;
    return a.tradeNum.localeCompare(b.tradeNum);
  });

  return rows;
}

/**
 * Compute hedging summary statistics.
 */
export function computeHedgingSummary(rows: HedgingRow[]): HedgingSummary {
  let fullyHedged = 0;
  let partiallyHedged = 0;
  let unhedged = 0;
  let totalMetalGapG = 0;
  let totalUsdRemaining = 0;

  for (const row of rows) {
    if (row.hedged) {
      fullyHedged++;
    } else if (row.metalHedged || row.usdHedged) {
      partiallyHedged++;
    } else {
      unhedged++;
    }
    if (!row.metalHedged) {
      totalMetalGapG += Math.abs(row.hedgeNeedG);
    }
    if (!row.usdHedged) {
      totalUsdRemaining += Math.abs(row.pmxNetUsd);
    }
  }

  return {
    totalTrades: rows.length,
    fullyHedged,
    partiallyHedged,
    unhedged,
    totalMetalGapG,
    totalMetalGapOz: totalMetalGapG / GRAMS_PER_TROY_OUNCE,
    totalUsdRemaining,
  };
}

function normalizeRef(val: string | null | undefined): string {
  if (!val) return "";
  let s = String(val).trim().toUpperCase();
  if (s.endsWith(".0") && /^\d+\.0$/.test(s)) s = s.slice(0, -2);
  return s;
}
