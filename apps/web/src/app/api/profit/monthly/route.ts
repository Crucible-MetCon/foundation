import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  buildProfitReport,
  type TmTradeInput,
  type PmxTradeInput,
} from "@foundation/domain";

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
    return NextResponse.json({ ok: true, ...report });
  } catch (error) {
    console.error("Profit report error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}
