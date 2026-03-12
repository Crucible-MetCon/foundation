import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  buildHedgingComparison,
  computeHedgingSummary,
  type TradeMcBooking,
  type PmxHedgeTrade,
} from "@foundation/domain";

export async function GET() {
  try {
    // Load confirmed TradeMC trades with ref_number
    const tmResult = await (db as any).execute(sql`
      SELECT t.ref_number, t.weight::float8 as weight, c.company_name, t.status, t.trade_timestamp
      FROM trademc_trades t
      LEFT JOIN trademc_companies c ON t.company_id = c.directus_id
      WHERE t.status = 'confirmed'
        AND t.ref_number IS NOT NULL
        AND TRIM(t.ref_number) != ''
    `);

    const bookings: TradeMcBooking[] = (tmResult as any[]).map((r: any) => ({
      refNumber: r.ref_number || "",
      weightGrams: parseFloat(r.weight) || 0,
      companyName: r.company_name || "",
      status: r.status || "",
      tradeTimestamp: r.trade_timestamp ? new Date(r.trade_timestamp).toISOString() : "",
    }));

    // Load PMX trades with order_id (only XAUUSD and USDZAR)
    const pmxResult = await (db as any).execute(sql`
      SELECT order_id, symbol, side, quantity::float8 as quantity, price::float8 as price
      FROM pmx_trades
      WHERE order_id IS NOT NULL
        AND TRIM(order_id) != ''
        AND (
          UPPER(REPLACE(symbol, '/', '')) IN ('XAUUSD', 'USDZAR', 'XAGUSD')
        )
    `);

    const pmxTrades: PmxHedgeTrade[] = (pmxResult as any[]).map((r: any) => ({
      orderId: r.order_id || "",
      symbol: r.symbol || "",
      side: r.side || "",
      quantity: parseFloat(r.quantity) || 0,
      price: parseFloat(r.price) || 0,
    }));

    const rows = buildHedgingComparison(bookings, pmxTrades);
    const summary = computeHedgingSummary(rows);

    return NextResponse.json({ ok: true, rows, summary });
  } catch (error) {
    console.error("Hedging error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
