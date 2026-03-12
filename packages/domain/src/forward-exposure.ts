/**
 * Forward Exposure Domain Logic
 *
 * Calculates forward-only PMX exposure by settlement date.
 * Forward = value_date > spot_date (trade_date + T+2 business days)
 */

// ── Types ──

export interface ForwardTradeInput {
  id: number;
  tradeNum: string;
  docNumber: string;
  tradeDate: string;   // YYYY-MM-DD
  valueDate: string;    // YYYY-MM-DD
  symbol: string;
  side: string;
  quantity: number;
  price: number;
}

export interface ForwardRow {
  id: number;
  tradeNum: string;
  docNumber: string;
  tradeDate: string;
  valueDate: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  usdNet: number;
  goldNetOz: number;
  zarFlow: number;
  daysFromSpot: number;
}

export interface ForwardCalendarRow {
  valueDate: string;
  daysFromSpot: number;
  tradeCount: number;
  tradeNumbers: number;
  usdNet: number;
  goldNetOz: number;
  zarFlow: number;
}

export interface ForwardSummary {
  rows: number;
  tradeNumbers: number;
  usdNet: number;
  goldNetOz: number;
  zarFlow: number;
}

export interface ForwardExposureResult {
  rows: ForwardRow[];
  calendar: ForwardCalendarRow[];
  summary: ForwardSummary;
}

// ── Helpers ──

function normSymbol(val: string): string {
  return val.toUpperCase().replace(/[/\- ]/g, "");
}

function parseDate(val: string): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

/** Add business days to a date (skip weekends) */
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

/** Count business days between two dates (excluding start, including end if business day) */
function businessDaysBetween(start: Date, end: Date): number {
  if (end >= start) {
    let count = 0;
    const cur = new Date(start);
    while (cur < end) {
      cur.setDate(cur.getDate() + 1);
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    return count;
  }
  // Negative
  let count = 0;
  const cur = new Date(end);
  while (cur < start) {
    cur.setDate(cur.getDate() + 1);
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return -count;
}

function dateToStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function normalizeRef(val: string | null | undefined): string {
  if (!val) return "";
  let s = String(val).trim().toUpperCase();
  if (s.endsWith(".0") && /^\d+\.0$/.test(s)) s = s.slice(0, -2);
  return s;
}

// ── Core ──

export function buildForwardExposure(
  trades: ForwardTradeInput[],
  filters?: { symbol?: string; startDate?: string; endDate?: string },
): ForwardExposureResult {
  const empty: ForwardExposureResult = {
    rows: [],
    calendar: [],
    summary: { rows: 0, tradeNumbers: 0, usdNet: 0, goldNetOz: 0, zarFlow: 0 },
  };

  if (!trades.length) return empty;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = dateToStr(today);

  // Process each trade
  const forwardRows: ForwardRow[] = [];

  for (const t of trades) {
    const sym = normSymbol(t.symbol);
    if (sym !== "XAUUSD" && sym !== "USDZAR") continue;

    const side = t.side?.toUpperCase();
    if (side !== "BUY" && side !== "SELL") continue;

    const tradeDate = parseDate(t.tradeDate);
    const valueDate = parseDate(t.valueDate);
    if (!tradeDate || !valueDate) continue;

    // Calculate spot date (T+2)
    const spotDate = addBusinessDays(tradeDate, 2);
    const daysFromSpot = businessDaysBetween(spotDate, valueDate);

    // Filter to forward-only
    if (daysFromSpot <= 0) continue;

    // Filter to future value dates only
    if (t.valueDate <= todayStr) continue;

    // Apply user filters
    if (filters?.symbol) {
      const filterSym = normSymbol(filters.symbol);
      if (filterSym && filterSym !== "ALL" && sym !== filterSym) continue;
    }
    if (filters?.startDate && t.valueDate < filters.startDate) continue;
    if (filters?.endDate && t.valueDate > filters.endDate) continue;

    const qtyAbs = Math.abs(t.quantity);
    let usdNet = 0;
    let goldNetOz = 0;
    let zarFlow = 0;

    if (sym === "XAUUSD") {
      if (side === "BUY") {
        usdNet = -(qtyAbs * t.price);
        goldNetOz = qtyAbs;
      } else {
        usdNet = qtyAbs * t.price;
        goldNetOz = -qtyAbs;
      }
    } else {
      // USDZAR
      if (side === "BUY") {
        usdNet = qtyAbs;
        zarFlow = -(qtyAbs * t.price);
      } else {
        usdNet = -qtyAbs;
        zarFlow = qtyAbs * t.price;
      }
    }

    const tradeKey = normalizeRef(t.tradeNum) || t.docNumber || `ID:${t.id}`;

    forwardRows.push({
      id: t.id,
      tradeNum: tradeKey,
      docNumber: t.docNumber,
      tradeDate: t.tradeDate,
      valueDate: t.valueDate,
      symbol: sym,
      side: side,
      quantity: qtyAbs,
      price: t.price,
      usdNet,
      goldNetOz,
      zarFlow,
      daysFromSpot,
    });
  }

  // Sort by value date asc, trade date desc
  forwardRows.sort((a, b) => {
    const vd = a.valueDate.localeCompare(b.valueDate);
    if (vd !== 0) return vd;
    return b.tradeDate.localeCompare(a.tradeDate);
  });

  // Build calendar (group by value_date)
  const calMap: Record<string, ForwardCalendarRow> = {};
  for (const r of forwardRows) {
    if (!calMap[r.valueDate]) {
      calMap[r.valueDate] = {
        valueDate: r.valueDate,
        daysFromSpot: r.daysFromSpot,
        tradeCount: 0,
        tradeNumbers: 0,
        usdNet: 0,
        goldNetOz: 0,
        zarFlow: 0,
      };
    }
    calMap[r.valueDate].tradeCount++;
    calMap[r.valueDate].usdNet += r.usdNet;
    calMap[r.valueDate].goldNetOz += r.goldNetOz;
    calMap[r.valueDate].zarFlow += r.zarFlow;
  }

  // Count unique trade numbers per date
  for (const vd of Object.keys(calMap)) {
    const uniqueNums = new Set(forwardRows.filter(r => r.valueDate === vd).map(r => r.tradeNum));
    calMap[vd].tradeNumbers = uniqueNums.size;
  }

  const calendar = Object.values(calMap).sort((a, b) => a.valueDate.localeCompare(b.valueDate));

  // Summary
  const uniqueTradeNums = new Set(forwardRows.map(r => r.tradeNum));
  const summary: ForwardSummary = {
    rows: forwardRows.length,
    tradeNumbers: uniqueTradeNums.size,
    usdNet: forwardRows.reduce((s, r) => s + r.usdNet, 0),
    goldNetOz: forwardRows.reduce((s, r) => s + r.goldNetOz, 0),
    zarFlow: forwardRows.reduce((s, r) => s + r.zarFlow, 0),
  };

  return { rows: forwardRows, calendar, summary };
}
