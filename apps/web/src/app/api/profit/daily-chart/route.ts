import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  buildProfitReport,
  type TmTradeInput,
  type PmxTradeInput,
} from "@foundation/domain";

// Ensure exposure table exists
let exposureTableEnsured = false;
async function ensureExposureTable() {
  if (exposureTableEnsured) return;
  await (db as any).execute(sql`
    CREATE TABLE IF NOT EXISTS daily_max_exposure (
      id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      date DATE NOT NULL UNIQUE,
      max_exposure_zar NUMERIC(18,2) NOT NULL,
      recorded_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  exposureTableEnsured = true;
}

// Ensure settings table exists
let settingsTableEnsured = false;
async function ensureSettingsTable() {
  if (settingsTableEnsured) return;
  await (db as any).execute(sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await (db as any).execute(sql`
    INSERT INTO app_settings (key, value)
    VALUES ('hurdle_rate_pct', '0.2')
    ON CONFLICT (key) DO NOTHING
  `);
  settingsTableEnsured = true;
}

/**
 * GET /api/profit/daily-chart
 *
 * Returns daily P&L aggregates and daily max exposure for chart rendering.
 */
export async function GET() {
  try {
    await requireAuth();

    // Load trades (same SQL as profit/monthly)
    const [tmResult, pmxResult] = await Promise.all([
      (db as any).execute(sql`
        SELECT t.ref_number, t.weight::float8 as weight,
          c.company_name, t.trade_timestamp,
          t.zar_to_usd::float8 as zar_to_usd,
          t.zar_to_usd_confirmed::float8 as zar_to_usd_confirmed,
          t.usd_per_troy_ounce_confirmed::float8 as usd_per_troy_ounce_confirmed,
          t.zar_per_troy_ounce::float8 as zar_per_troy_ounce,
          t.zar_per_troy_ounce_confirmed::float8 as zar_per_troy_ounce_confirmed
        FROM trademc_trades t
        LEFT JOIN trademc_companies c ON t.company_id = c.directus_id
        WHERE t.status = 'confirmed'
          AND t.ref_number IS NOT NULL
          AND TRIM(t.ref_number) != ''
      `),
      (db as any).execute(sql`
        SELECT order_id, symbol, side,
          quantity::float8 as quantity, price::float8 as price,
          trade_date
        FROM pmx_trades
        WHERE order_id IS NOT NULL AND TRIM(order_id) != ''
          AND UPPER(REPLACE(symbol, '/', '')) IN ('XAUUSD', 'USDZAR')
      `),
    ]);

    const tmTrades: TmTradeInput[] = (tmResult as any[]).map((r: any) => ({
      refNumber: r.ref_number || "",
      weightG: parseFloat(r.weight) || 0,
      companyName: r.company_name || "",
      tradeTimestamp: r.trade_timestamp ? new Date(r.trade_timestamp).toISOString() : "",
      zarToUsd: parseFloat(r.zar_to_usd_confirmed) || parseFloat(r.zar_to_usd) || null,
      usdPerTroyOunce: parseFloat(r.usd_per_troy_ounce_confirmed) || null,
      zarPerTroyOunce: parseFloat(r.zar_per_troy_ounce_confirmed) || parseFloat(r.zar_per_troy_ounce) || null,
    }));

    const pmxTrades: PmxTradeInput[] = (pmxResult as any[]).map((r: any) => ({
      orderId: r.order_id || "",
      symbol: r.symbol || "",
      side: r.side || "",
      quantity: parseFloat(r.quantity) || 0,
      price: parseFloat(r.price) || 0,
      tradeDate: r.trade_date ? new Date(r.trade_date).toISOString().slice(0, 10) : "",
    }));

    const report = buildProfitReport(tmTrades, pmxTrades);

    // Fetch hurdle rate setting
    await ensureSettingsTable();
    const settingsRows = await (db as any).execute(sql`
      SELECT value FROM app_settings WHERE key = 'hurdle_rate_pct'
    `);
    const hurdleRatePct = parseFloat((settingsRows as any[])?.[0]?.value) || 0.2;

    // Group profit rows by trade date
    const dailyMap: Record<string, {
      metalProfitZar: number;
      exchangeProfitZar: number;
      totalTradedValueZar: number;
    }> = {};

    for (const month of report.months) {
      for (const trade of month.trades) {
        const d = trade.tradeDate || "Unknown";
        if (d === "Unknown") continue;
        if (!dailyMap[d]) {
          dailyMap[d] = { metalProfitZar: 0, exchangeProfitZar: 0, totalTradedValueZar: 0 };
        }
        dailyMap[d].metalProfitZar += trade.metalProfitZar;
        dailyMap[d].exchangeProfitZar += trade.exchangeProfitZar;
        dailyMap[d].totalTradedValueZar += Math.abs(trade.sellSideZar);
      }
    }

    const dailyPnl = Object.entries(dailyMap)
      .map(([date, v]) => ({
        date,
        metalProfitZar: Math.round(v.metalProfitZar * 100) / 100,
        exchangeProfitZar: Math.round(v.exchangeProfitZar * 100) / 100,
        hurdleZar: Math.round(v.totalTradedValueZar * (hurdleRatePct / 100) * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Fetch daily exposure data
    await ensureExposureTable();
    const exposureRows = await (db as any).execute(sql`
      SELECT date, max_exposure_zar::float8 as max_exposure_zar
      FROM daily_max_exposure
      ORDER BY date ASC
    `);

    const dailyExposure = (exposureRows as any[]).map((r: any) => ({
      date: r.date instanceof Date
        ? r.date.toISOString().slice(0, 10)
        : String(r.date).slice(0, 10),
      maxExposureZar: parseFloat(r.max_exposure_zar) || 0,
    }));

    return NextResponse.json({
      ok: true,
      dailyPnl,
      dailyExposure,
      hurdleRatePct,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Daily chart error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}
