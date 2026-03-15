import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  buildProfitReport,
  type TmTradeInput,
  type PmxTradeInput,
} from "@foundation/domain";

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

export async function GET() {
  try {
    // Load confirmed TradeMC trades
    const tmResult = await (db as any).execute(sql`
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
    `);

    const tmTrades: TmTradeInput[] = (tmResult as any[]).map((r: any) => ({
      refNumber: r.ref_number || "",
      weightG: parseFloat(r.weight) || 0,
      companyName: r.company_name || "",
      tradeTimestamp: r.trade_timestamp ? new Date(r.trade_timestamp).toISOString() : "",
      zarToUsd: parseFloat(r.zar_to_usd_confirmed) || parseFloat(r.zar_to_usd) || null,
      usdPerTroyOunce: parseFloat(r.usd_per_troy_ounce_confirmed) || null,
      zarPerTroyOunce: parseFloat(r.zar_per_troy_ounce_confirmed) || parseFloat(r.zar_per_troy_ounce) || null,
    }));

    // Load PMX trades (XAUUSD and USDZAR only)
    const pmxResult = await (db as any).execute(sql`
      SELECT order_id, symbol, side,
        quantity::float8 as quantity, price::float8 as price,
        trade_date
      FROM pmx_trades
      WHERE order_id IS NOT NULL AND TRIM(order_id) != ''
        AND UPPER(REPLACE(symbol, '/', '')) IN ('XAUUSD', 'USDZAR')
    `);

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

    // Add hurdleZar to each month (sum of |sellSideZar| × rate)
    const months = report.months.map((m: any) => {
      const totalTradedValueZar = m.trades.reduce(
        (sum: number, t: any) => sum + Math.abs(t.sellSideZar || 0),
        0,
      );
      return {
        ...m,
        hurdleZar: Math.round(totalTradedValueZar * (hurdleRatePct / 100) * 100) / 100,
      };
    });

    // Add total hurdle to summary
    const totalHurdleZar = months.reduce((sum: number, m: any) => sum + m.hurdleZar, 0);

    return NextResponse.json({
      ok: true,
      months,
      summary: { ...report.summary, hurdleZar: Math.round(totalHurdleZar * 100) / 100, hurdleRatePct },
    });
  } catch (error) {
    console.error("Profit report error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}
