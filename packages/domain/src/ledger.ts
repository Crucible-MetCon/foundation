/**
 * PMX Ledger Domain Logic
 *
 * Builds a ledger view from raw PMX trades with:
 * - Debit/Credit computation per trade
 * - Running balance per trade number (grouped)
 * - Open/Closed status
 * - Narration auto-generation
 */

import { GRAMS_PER_TROY_OUNCE } from "./currency";

export interface RawTradeRow {
  id: number;
  docNumber: string;
  tradeDate: string;   // YYYY-MM-DD
  valueDate: string;    // YYYY-MM-DD
  symbol: string;       // XAUUSD, USDZAR
  side: string;         // BUY, SELL
  quantity: number;
  price: number;
  narration: string;
  orderId: string;      // Trade #
  fncNumber: string;    // FNC #
  traderName: string;
  settleCurrency: string;
  settleAmount: number;
}

export interface LedgerRow {
  id: number;
  tradeNumber: string;    // Trade # (orderId)
  fncNumber: string;      // FNC #
  docNumber: string;      // Doc #
  tradeDate: string;
  valueDate: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  narration: string;
  debitUsd: number;
  creditUsd: number;
  balanceUsd: number;
  debitZar: number;
  creditZar: number;
  balanceZar: number;
  netXauOz: number;
  netXauGrams: number;
  traderName: string;
  status: "Open" | "Closed";
}

export interface LedgerSummary {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  totalDebitUsd: number;
  totalCreditUsd: number;
  totalDebitZar: number;
  totalCreditZar: number;
}

function splitSymbol(sym: string): { base: string; quote: string } {
  const s = (sym ?? "").toUpperCase().trim();
  if (s.includes("/")) {
    const [base, quote] = s.split("/", 2);
    return { base, quote };
  }
  if (s.length === 6) {
    return { base: s.slice(0, 3), quote: s.slice(3) };
  }
  return { base: s, quote: "" };
}

/**
 * Build a full ledger view from raw trades.
 * Sorts by trade date, computes debit/credit, running balances, and status.
 */
export function buildLedger(trades: RawTradeRow[]): LedgerRow[] {
  if (!trades.length) return [];

  // Sort by trade date, then value date, then id
  const sorted = [...trades].sort((a, b) => {
    const dateComp = a.tradeDate.localeCompare(b.tradeDate);
    if (dateComp !== 0) return dateComp;
    const valComp = a.valueDate.localeCompare(b.valueDate);
    if (valComp !== 0) return valComp;
    return a.id - b.id;
  });

  // Running balance accumulators per trade key
  const balances: Record<string, { usd: number; zar: number; xau: number }> = {};

  const rows: LedgerRow[] = sorted.map((t) => {
    const { base, quote } = splitSymbol(t.symbol);
    const qty = Math.abs(t.quantity);
    const px = Math.abs(t.price);
    const isMetal = ["XAU", "XAG", "XPT", "XPD"].includes(base) && quote === "USD";
    const isFx = base === "USD" && quote === "ZAR";
    const isBuy = t.side.toUpperCase() === "BUY";

    let debitUsd = 0, creditUsd = 0;
    let debitZar = 0, creditZar = 0;
    let creditXau = 0, debitXau = 0;

    if (isMetal) {
      if (isBuy) {
        debitUsd = qty * px;
        creditXau = qty;
      } else {
        creditUsd = qty * px;
        debitXau = qty;
      }
    } else if (isFx) {
      if (t.side.toUpperCase() === "SELL") {
        debitUsd = qty;
        creditZar = qty * px;
      } else {
        creditUsd = qty;
        debitZar = qty * px;
      }
    }

    // Trade key: orderId (trade #) > docNumber > row index
    const tradeKey = t.orderId?.trim() || t.docNumber?.trim() || `__id_${t.id}`;

    // Initialize balance for this key if new
    if (!balances[tradeKey]) {
      balances[tradeKey] = { usd: 0, zar: 0, xau: 0 };
    }

    // Net differences
    const netUsd = creditUsd - debitUsd;
    const netZar = creditZar - debitZar;
    const netXau = creditXau - debitXau;

    // Accumulate
    balances[tradeKey].usd += netUsd;
    balances[tradeKey].zar += netZar;
    balances[tradeKey].xau += netXau;

    // Auto-generate narration if empty
    let narration = t.narration?.trim() || "";
    if (!narration) {
      if (isMetal) {
        const pair = `${base}/${quote}`;
        narration = `${pair} ${qty.toFixed(3)} OZ @ ${px.toFixed(2)}`;
      } else if (isFx) {
        narration = `USD/ZAR ${qty.toLocaleString("en-US", { minimumFractionDigits: 2 })} @ ${px.toFixed(5)}`;
      } else {
        narration = `${t.symbol} ${qty.toFixed(4)} @ ${px.toFixed(5)}`;
      }
    }

    return {
      id: t.id,
      tradeNumber: t.orderId?.trim() || "",
      fncNumber: t.fncNumber?.trim() || "",
      docNumber: t.docNumber?.trim() || "",
      tradeDate: t.tradeDate,
      valueDate: t.valueDate,
      symbol: t.symbol.toUpperCase(),
      side: t.side.toUpperCase(),
      quantity: qty,
      price: px,
      narration,
      debitUsd,
      creditUsd,
      balanceUsd: balances[tradeKey].usd,
      debitZar,
      creditZar,
      balanceZar: balances[tradeKey].zar,
      netXauOz: balances[tradeKey].xau,
      netXauGrams: balances[tradeKey].xau * GRAMS_PER_TROY_OUNCE,
      traderName: t.traderName?.trim() || "",
      status: "Open", // Will be set after all rows are processed
    };
  });

  // Determine open/closed status per trade key
  const lastRowByKey: Record<string, LedgerRow> = {};
  for (const row of rows) {
    const key = row.tradeNumber || row.docNumber || `__id_${row.id}`;
    lastRowByKey[key] = row;
  }

  const openKeys = new Set<string>();
  for (const [key, lastRow] of Object.entries(lastRowByKey)) {
    if (Math.abs(lastRow.balanceUsd) > 0.01 || Math.abs(lastRow.balanceZar) > 0.01) {
      openKeys.add(key);
    }
  }

  for (const row of rows) {
    const key = row.tradeNumber || row.docNumber || `__id_${row.id}`;
    row.status = openKeys.has(key) ? "Open" : "Closed";
  }

  return rows;
}

/**
 * Compute ledger summary statistics
 */
export function computeLedgerSummary(rows: LedgerRow[]): LedgerSummary {
  const tradeKeys = new Set<string>();
  const openKeys = new Set<string>();
  let totalDebitUsd = 0, totalCreditUsd = 0;
  let totalDebitZar = 0, totalCreditZar = 0;

  for (const row of rows) {
    const key = row.tradeNumber || row.docNumber || `__id_${row.id}`;
    tradeKeys.add(key);
    if (row.status === "Open") openKeys.add(key);
    totalDebitUsd += row.debitUsd;
    totalCreditUsd += row.creditUsd;
    totalDebitZar += row.debitZar;
    totalCreditZar += row.creditZar;
  }

  return {
    totalTrades: tradeKeys.size,
    openTrades: openKeys.size,
    closedTrades: tradeKeys.size - openKeys.size,
    totalDebitUsd,
    totalCreditUsd,
    totalDebitZar,
    totalCreditZar,
  };
}

/**
 * Calculate weighted average for a symbol from ledger rows
 */
export function calculateWeightedAverage(
  rows: LedgerRow[],
  symbol: string,
): { totalVolume: number; totalSettlement: number; weightedAvg: number } | null {
  const filtered = rows.filter((r) => r.symbol.replace("/", "") === symbol.replace("/", ""));
  if (!filtered.length) return null;

  let totalVolume = 0;
  let totalSettlement = 0;

  const { base, quote } = splitSymbol(symbol);
  const isMetal = ["XAU", "XAG", "XPT", "XPD"].includes(base) && quote === "USD";

  for (const row of filtered) {
    if (isMetal) {
      const volume = row.side === "SELL" ? -row.quantity : row.quantity;
      const settlement = row.side === "SELL" ? row.creditUsd : -row.debitUsd;
      totalVolume += volume;
      totalSettlement += settlement;
    } else {
      // FX (USDZAR)
      const volume = row.side === "SELL" ? -row.debitUsd || -row.quantity : row.creditUsd || row.quantity;
      const settlement = row.side === "SELL" ? row.creditZar : -row.debitZar;
      totalVolume += volume;
      totalSettlement += settlement;
    }
  }

  const weightedAvg = totalVolume !== 0 ? Math.abs(totalSettlement) / Math.abs(totalVolume) : 0;

  return { totalVolume, totalSettlement, weightedAvg };
}
