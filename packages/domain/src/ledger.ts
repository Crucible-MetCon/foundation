/**
 * PMX Ledger Domain Logic
 *
 * Builds a ledger view from raw PMX trades with:
 * - Debit/Credit computation per trade
 * - Global running balance (USD, ZAR, Au) accumulated chronologically
 * - Open/Closed status per trade key
 * - Narration auto-generation
 * - Output sorted newest-first for display
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

  // Sort chronologically: trade date → doc number (sequential within PMX) → id
  const sorted = [...trades].sort((a, b) => {
    const dateComp = a.tradeDate.localeCompare(b.tradeDate);
    if (dateComp !== 0) return dateComp;
    const docComp = a.docNumber.localeCompare(b.docNumber);
    if (docComp !== 0) return docComp;
    return a.id - b.id;
  });

  // Global running balance accumulators (across all trades)
  let runningUsd = 0;
  let runningZar = 0;
  let runningXau = 0;

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

    // Net differences
    const netUsd = creditUsd - debitUsd;
    const netZar = creditZar - debitZar;
    const netXau = creditXau - debitXau;

    // Accumulate into global running balance
    runningUsd += netUsd;
    runningZar += netZar;
    runningXau += netXau;

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
      balanceUsd: runningUsd,
      debitZar,
      creditZar,
      balanceZar: runningZar,
      netXauOz: runningXau,
      netXauGrams: runningXau * GRAMS_PER_TROY_OUNCE,
      traderName: t.traderName?.trim() || "",
      status: "Open", // Will be set after all rows are processed
    };
  });

  // Determine open/closed status per trade key (grouped by orderId/docNumber)
  // A trade group is "Open" if its net USD or ZAR across all its rows is non-zero
  const groupNet: Record<string, { usd: number; zar: number }> = {};
  for (const row of rows) {
    const key = row.tradeNumber || row.docNumber || `__id_${row.id}`;
    if (!groupNet[key]) groupNet[key] = { usd: 0, zar: 0 };
    groupNet[key].usd += row.creditUsd - row.debitUsd;
    groupNet[key].zar += row.creditZar - row.debitZar;
  }

  const openKeys = new Set<string>();
  for (const [key, net] of Object.entries(groupNet)) {
    if (Math.abs(net.usd) > 0.01 || Math.abs(net.zar) > 0.01) {
      openKeys.add(key);
    }
  }

  for (const row of rows) {
    const key = row.tradeNumber || row.docNumber || `__id_${row.id}`;
    row.status = openKeys.has(key) ? "Open" : "Closed";
  }

  // Reverse to newest-first for display (balance was calculated oldest-first)
  return rows.reverse();
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
