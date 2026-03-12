/**
 * Monthly Profit Report Domain Logic
 *
 * Compares TradeMC metal bookings against PMX/StoneX trades to calculate
 * profit per trade, split into metal vs exchange components.
 */

import { GRAMS_PER_TROY_OUNCE } from "./currency";

// ── Types ──

export interface TmTradeInput {
  refNumber: string;
  weightG: number;
  companyName: string;
  tradeTimestamp: string;
  zarToUsd: number | null;        // FX rate
  usdPerTroyOunce: number | null; // Gold price in USD
  zarPerTroyOunce: number | null; // Gold price in ZAR (fallback to derive USD)
}

export interface PmxTradeInput {
  orderId: string;
  symbol: string;     // XAUUSD or USDZAR
  side: string;       // BUY or SELL
  quantity: number;
  price: number;
  tradeDate: string;
}

export interface ProfitTradeRow {
  tradeNum: string;
  tradeDate: string;
  monthKey: string;     // "YYYY-MM"
  monthLabel: string;   // "Jan 2026"
  clientWeightG: number;

  // Profit components (ZAR)
  exchangeProfitZar: number;
  metalProfitZar: number;
  totalProfitZar: number;
  profitPct: number;

  // Cash flows
  sellSideZar: number;
  buySideZar: number;

  // Weighted averages
  pmxWaGoldUsdOz: number;
  pmxWaUsdzar: number;
  trademcWaGoldUsdOz: number;
  trademcWaUsdzar: number;

  // Hedging status
  matchedOz: number;
  unmatchedOz: number;
}

export interface ProfitMonth {
  monthKey: string;
  monthLabel: string;
  exchangeProfitZar: number;
  metalProfitZar: number;
  totalProfitZar: number;
  tradeCount: number;
  trades: ProfitTradeRow[];
}

export interface ProfitSummary {
  months: number;
  trades: number;
  exchangeProfitZar: number;
  metalProfitZar: number;
  totalProfitZar: number;
  averageProfitMarginPct: number;
}

export interface ProfitReport {
  months: ProfitMonth[];
  summary: ProfitSummary;
}

// ── Helpers ──

function normalizeRef(val: string | null | undefined): string {
  if (!val) return "";
  let s = String(val).trim().toUpperCase();
  if (s.endsWith(".0") && /^\d+\.0$/.test(s)) s = s.slice(0, -2);
  return s;
}

function normSymbol(val: string): string {
  return val.toUpperCase().replace(/[/\- ]/g, "");
}

function monthKey(dateStr: string | null | undefined): string {
  if (!dateStr) return "Unknown";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Unknown";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  if (key === "Unknown") return "Unknown";
  const [y, m] = key.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const idx = parseInt(m, 10) - 1;
  return `${months[idx] || m} ${y}`;
}

function safeDiv(num: number, den: number): number {
  if (!den || !isFinite(den)) return 0;
  return num / den;
}

// ── Core Logic ──

export function buildProfitReport(
  tmTrades: TmTradeInput[],
  pmxTrades: PmxTradeInput[],
): ProfitReport {
  // Step 1: Group TradeMC by ref number
  const tmByRef: Record<string, {
    weightG: number;
    usdValue: number;
    zarValue: number;
    hasUsd: boolean;
    hasZar: boolean;
    latestDt: string;
    companyName: string;
  }> = {};

  for (const t of tmTrades) {
    const ref = normalizeRef(t.refNumber);
    if (!ref) continue;

    const weightG = t.weightG || 0;
    const weightOz = weightG / GRAMS_PER_TROY_OUNCE;
    const fx = t.zarToUsd || 0;
    let usdRate = t.usdPerTroyOunce || 0;

    // Derive USD rate from ZAR if needed
    if (!usdRate && t.zarPerTroyOunce && fx > 0) {
      usdRate = t.zarPerTroyOunce / fx;
    }

    const usdValue = weightOz * usdRate;
    const zarSpotPerG = fx > 0 && usdRate > 0 ? (usdRate * fx) / GRAMS_PER_TROY_OUNCE : 0;
    const zarValue = zarSpotPerG * weightG;

    if (!tmByRef[ref]) {
      tmByRef[ref] = { weightG: 0, usdValue: 0, zarValue: 0, hasUsd: false, hasZar: false, latestDt: "", companyName: t.companyName || "" };
    }
    tmByRef[ref].weightG += weightG;
    tmByRef[ref].usdValue += usdValue;
    tmByRef[ref].zarValue += zarValue;
    tmByRef[ref].hasUsd = tmByRef[ref].hasUsd || usdRate > 0;
    tmByRef[ref].hasZar = tmByRef[ref].hasZar || zarValue > 0;
    if (t.tradeTimestamp > tmByRef[ref].latestDt) tmByRef[ref].latestDt = t.tradeTimestamp;
    if (!tmByRef[ref].companyName && t.companyName) tmByRef[ref].companyName = t.companyName;
  }

  // Step 2: Group PMX trades by order ID
  const pmxByRef: Record<string, {
    goldAbsQty: number;
    goldAbsPriceQty: number;
    fxAbsQty: number;
    fxAbsPriceQty: number;
    goldSignedOz: number;
    xauTotalQty: number;
    xauTotalVal: number;
    fxTotalQty: number;
    fxTotalVal: number;
    latestDt: string;
  }> = {};

  for (const t of pmxTrades) {
    const ref = normalizeRef(t.orderId);
    if (!ref) continue;

    if (!pmxByRef[ref]) {
      pmxByRef[ref] = {
        goldAbsQty: 0, goldAbsPriceQty: 0,
        fxAbsQty: 0, fxAbsPriceQty: 0,
        goldSignedOz: 0,
        xauTotalQty: 0, xauTotalVal: 0,
        fxTotalQty: 0, fxTotalVal: 0,
        latestDt: "",
      };
    }

    const sym = normSymbol(t.symbol);
    const side = t.side?.toUpperCase() || "";
    const qty = Math.abs(t.quantity);
    const px = Math.abs(t.price);
    const p = pmxByRef[ref];

    if (sym === "XAUUSD" || sym.startsWith("XAU")) {
      p.goldAbsQty += qty;
      p.goldAbsPriceQty += qty * px;

      if (side === "BUY") {
        p.goldSignedOz += qty;
        p.xauTotalQty += qty;
        p.xauTotalVal += qty * px;
      } else {
        p.goldSignedOz -= qty;
        p.xauTotalQty -= qty;
        p.xauTotalVal -= qty * px;
      }
    } else if (sym === "USDZAR" || sym.startsWith("USD")) {
      p.fxAbsQty += qty;
      p.fxAbsPriceQty += qty * px;

      if (side === "BUY") {
        p.fxTotalQty += qty;
        p.fxTotalVal += qty * px;
      } else {
        p.fxTotalQty -= qty;
        p.fxTotalVal -= qty * px;
      }
    }

    if (t.tradeDate > p.latestDt) p.latestDt = t.tradeDate;
  }

  // Step 3: Calculate profit per trade
  const tradeRows: ProfitTradeRow[] = [];

  for (const ref of Object.keys(tmByRef)) {
    const tm = tmByRef[ref];
    const pmx = pmxByRef[ref] || {
      goldAbsQty: 0, goldAbsPriceQty: 0, fxAbsQty: 0, fxAbsPriceQty: 0,
      goldSignedOz: 0, xauTotalQty: 0, xauTotalVal: 0, fxTotalQty: 0, fxTotalVal: 0, latestDt: "",
    };

    const tmBookedOz = Math.abs(tm.weightG) / GRAMS_PER_TROY_OUNCE;

    // Weighted averages
    const goldAvg = safeDiv(pmx.xauTotalVal, pmx.xauTotalQty);
    const goldAbsWa = safeDiv(pmx.goldAbsPriceQty, pmx.goldAbsQty);
    const fxAvg = safeDiv(pmx.fxTotalVal, pmx.fxTotalQty);
    const fxAbsWa = safeDiv(pmx.fxAbsPriceQty, pmx.fxAbsQty);

    const waGoldPrice = goldAvg !== 0 ? Math.abs(goldAvg) : goldAbsWa;
    const waUsdzar = fxAvg !== 0 ? Math.abs(fxAvg) : fxAbsWa;

    // TradeMC WA
    const tmWaUsdPerOz = tmBookedOz > 0 ? Math.abs(tm.usdValue) / tmBookedOz : 0;
    const tmWaFx = tm.hasUsd && Math.abs(tm.usdValue) > 0.01
      ? Math.abs(tm.zarValue) / Math.abs(tm.usdValue) : 0;

    // Determine position direction and calculate profit
    const pmxSoldOz = Math.abs(pmx.goldSignedOz);
    const matchedOz = Math.min(pmxSoldOz, tmBookedOz);
    const unmatchedOz = Math.max(0, tmBookedOz - matchedOz);

    if (matchedOz < 0.001) continue; // Skip trades with no matched oz

    // Pro-rate to matched quantity
    const pmxLegUsd = matchedOz * waGoldPrice;
    const pmxLegZar = pmxLegUsd * waUsdzar;
    const tmLegUsd = matchedOz * tmWaUsdPerOz;
    const tmLegZar = tmLegUsd * (tmWaFx > 0 ? tmWaFx : waUsdzar);

    // Long position: sell PMX, buy TradeMC
    const sellSideZar = pmxLegZar;
    const buySideZar = tmLegZar;
    const profitZar = sellSideZar - buySideZar;
    const profitUsd = pmxLegUsd - tmLegUsd;
    const profitPct = buySideZar > 0.01 ? (profitZar / buySideZar) * 100 : 0;

    // Split: metal vs exchange profit
    const metalProfitZar = tmWaFx > 0
      ? profitUsd * tmWaFx
      : waUsdzar > 0 ? profitUsd * waUsdzar : 0;
    const exchangeProfitZar = profitZar - metalProfitZar;

    const latestDate = tm.latestDt > pmx.latestDt ? tm.latestDt : pmx.latestDt;
    const mk = monthKey(latestDate);

    tradeRows.push({
      tradeNum: ref,
      tradeDate: latestDate ? new Date(latestDate).toISOString().slice(0, 10) : "",
      monthKey: mk,
      monthLabel: monthLabel(mk),
      clientWeightG: tm.weightG,
      exchangeProfitZar,
      metalProfitZar,
      totalProfitZar: profitZar,
      profitPct,
      sellSideZar,
      buySideZar,
      pmxWaGoldUsdOz: waGoldPrice,
      pmxWaUsdzar: waUsdzar,
      trademcWaGoldUsdOz: tmWaUsdPerOz,
      trademcWaUsdzar: tmWaFx,
      matchedOz,
      unmatchedOz,
    });
  }

  // Step 4: Group by month
  const monthMap: Record<string, ProfitMonth> = {};
  for (const row of tradeRows) {
    if (!monthMap[row.monthKey]) {
      monthMap[row.monthKey] = {
        monthKey: row.monthKey,
        monthLabel: row.monthLabel,
        exchangeProfitZar: 0,
        metalProfitZar: 0,
        totalProfitZar: 0,
        tradeCount: 0,
        trades: [],
      };
    }
    const m = monthMap[row.monthKey];
    m.exchangeProfitZar += row.exchangeProfitZar;
    m.metalProfitZar += row.metalProfitZar;
    m.totalProfitZar += row.totalProfitZar;
    m.tradeCount++;
    m.trades.push(row);
  }

  // Sort months reverse-chronologically
  const months = Object.values(monthMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

  // Step 5: Summary
  const summary: ProfitSummary = {
    months: months.length,
    trades: tradeRows.length,
    exchangeProfitZar: tradeRows.reduce((s, r) => s + r.exchangeProfitZar, 0),
    metalProfitZar: tradeRows.reduce((s, r) => s + r.metalProfitZar, 0),
    totalProfitZar: tradeRows.reduce((s, r) => s + r.totalProfitZar, 0),
    averageProfitMarginPct: tradeRows.length > 0
      ? tradeRows.reduce((s, r) => s + r.profitPct, 0) / tradeRows.length
      : 0,
  };

  return { months, summary };
}
