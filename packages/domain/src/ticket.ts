import { GRAMS_PER_TROY_OUNCE } from "./currency";

// Types
export interface TicketTmInput {
  companyName: string;
  weightG: number;
  usdPerTroyOunce: number;   // confirmed or fallback
  zarToUsd: number;           // confirmed or fallback FX rate
  refiningRate: number;       // percentage (e.g., 0.5 for 0.5%)
}

export interface TicketPmxInput {
  docNumber: string;
  fncNumber: string;
  tradeDate: string;
  valueDate: string;
  symbol: string;     // XAUUSD or USDZAR
  side: string;       // BUY or SELL
  quantity: number;
  price: number;
  narration: string;
}

export interface TicketTmRow {
  companyName: string;
  weightG: number;
  weightOz: number;
  usdPerOzBooked: number;
  fxRate: number;
  usdValue: number;
  zarValue: number;
  refiningRate: number;
  zarValueLessRefining: number;
}

export interface TicketStonexRow {
  docNumber: string;
  fncNumber: string;
  tradeDate: string;
  valueDate: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  narration: string;
}

export interface TicketSummary {
  goldWaUsdOz: number;        // Weighted avg gold price $/oz
  fxWaUsdzar: number;         // Weighted avg FX rate
  spotZarPerG: number;        // (goldWa * fxWa) / GRAMS_PER_TROY_OUNCE
  sellSideUsd: number;
  buySideUsd: number;
  sellSideZar: number;
  buySideZar: number;
  totalTradedOz: number;
  totalTradedG: number;
  controlAccountG: number;
  controlAccountOz: number;
  controlAccountZar: number;
  stonexZarFlow: number;
  profitUsd: number;
  profitZar: number;
  profitPct: number;          // profit % on ZAR cost
}

export interface TicketResult {
  tradeNum: string;
  tmRows: TicketTmRow[];
  stonexRows: TicketStonexRow[];
  summary: TicketSummary;
}

export function buildTradingTicket(
  tradeNum: string,
  tmInputs: TicketTmInput[],
  pmxInputs: TicketPmxInput[],
): TicketResult {
  // 1. Build TradeMC rows
  const tmRows: TicketTmRow[] = tmInputs.map(t => {
    const weightOz = t.weightG / GRAMS_PER_TROY_OUNCE;
    const usdValue = weightOz * t.usdPerTroyOunce;
    const zarValue = usdValue * t.zarToUsd;
    const refRate = (t.refiningRate || 0) / 100;
    const zarValueLessRefining = zarValue * (1 - refRate);
    return {
      companyName: t.companyName,
      weightG: t.weightG,
      weightOz,
      usdPerOzBooked: t.usdPerTroyOunce,
      fxRate: t.zarToUsd,
      usdValue,
      zarValue,
      refiningRate: t.refiningRate,
      zarValueLessRefining,
    };
  });

  // 2. Build StoneX rows (gold first, then FX, sorted by date desc)
  const stonexRows: TicketStonexRow[] = pmxInputs
    .map(t => ({
      docNumber: t.docNumber,
      fncNumber: t.fncNumber,
      tradeDate: t.tradeDate,
      valueDate: t.valueDate,
      symbol: t.symbol.toUpperCase(),
      side: t.side.toUpperCase(),
      quantity: Math.abs(t.quantity),
      price: Math.abs(t.price),
      narration: t.narration || "",
    }))
    .sort((a, b) => {
      // Gold trades first, then FX
      const aIsGold = a.symbol.includes("XAU") ? 0 : 1;
      const bIsGold = b.symbol.includes("XAU") ? 0 : 1;
      if (aIsGold !== bIsGold) return aIsGold - bIsGold;
      // Then by date descending
      return b.tradeDate.localeCompare(a.tradeDate);
    });

  // 3. Calculate weighted averages from PMX trades
  let goldTotalQty = 0, goldTotalVal = 0;
  let fxTotalQty = 0, fxTotalVal = 0;
  let goldSignedOz = 0;

  for (const t of stonexRows) {
    const sym = t.symbol.replace(/[/\- ]/g, "");
    const qty = t.quantity;
    const px = t.price;

    if (sym === "XAUUSD" || sym.startsWith("XAU")) {
      goldTotalQty += qty;
      goldTotalVal += qty * px;
      if (t.side === "BUY") {
        goldSignedOz += qty;
      } else {
        goldSignedOz -= qty;
      }
    } else if (sym === "USDZAR" || sym.startsWith("USD")) {
      fxTotalQty += qty;
      fxTotalVal += qty * px;
    }
  }

  const goldWa = goldTotalQty > 0 ? goldTotalVal / goldTotalQty : 0;
  const fxWa = fxTotalQty > 0 ? fxTotalVal / fxTotalQty : 0;
  const spotZarPerG = goldWa > 0 && fxWa > 0 ? (goldWa * fxWa) / GRAMS_PER_TROY_OUNCE : 0;

  // 4. TradeMC totals
  const tmTotalWeightG = tmRows.reduce((s, r) => s + r.weightG, 0);
  const tmTotalWeightOz = tmTotalWeightG / GRAMS_PER_TROY_OUNCE;
  const tmTotalUsd = tmRows.reduce((s, r) => s + r.usdValue, 0);
  const tmTotalZar = tmRows.reduce((s, r) => s + r.zarValueLessRefining, 0);

  // 5. StoneX USD cash flow
  let stonexCashUsd = 0;
  for (const t of stonexRows) {
    const sym = t.symbol.replace(/[/\- ]/g, "");
    if (sym === "XAUUSD" || sym.startsWith("XAU")) {
      // SELL gold = inflow USD, BUY gold = outflow USD
      stonexCashUsd += t.side === "SELL" ? t.quantity * t.price : -(t.quantity * t.price);
    }
  }

  // 6. Control account: remaining metal exposure
  const controlAccountG = tmTotalWeightG + (goldSignedOz * GRAMS_PER_TROY_OUNCE);
  const controlAccountOz = controlAccountG / GRAMS_PER_TROY_OUNCE;
  const controlAccountZar = controlAccountG * spotZarPerG;

  // 7. Stonex ZAR flow
  const totalDisplayG = tmTotalWeightG;
  const stonexZarFlow = totalDisplayG * spotZarPerG;

  // 8. Profit calculation
  // Standard position: TradeMC is buy side (we buy from client), StoneX is sell side (we sell to StoneX)
  const sellSideUsd = Math.abs(stonexCashUsd);
  const buySideUsd = tmTotalUsd;
  const sellSideZar = stonexZarFlow + controlAccountZar;
  const buySideZar = tmTotalZar;
  const profitUsd = sellSideUsd - buySideUsd;
  const profitZar = sellSideZar - buySideZar;
  const profitPct = buySideZar > 0.01 ? (profitZar / buySideZar) * 100 : 0;

  return {
    tradeNum,
    tmRows,
    stonexRows,
    summary: {
      goldWaUsdOz: goldWa,
      fxWaUsdzar: fxWa,
      spotZarPerG,
      sellSideUsd,
      buySideUsd,
      sellSideZar,
      buySideZar,
      totalTradedOz: tmTotalWeightOz,
      totalTradedG: tmTotalWeightG,
      controlAccountG,
      controlAccountOz,
      controlAccountZar,
      stonexZarFlow,
      profitUsd,
      profitZar,
      profitPct,
    },
  };
}
