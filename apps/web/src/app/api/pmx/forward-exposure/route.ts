import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  buildForwardExposure,
  type ForwardTradeInput,
} from "@foundation/domain";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol") || "";
    const startDate = searchParams.get("start_date") || "";
    const endDate = searchParams.get("end_date") || "";

    // Load all PMX trades with value_date in the future
    const result = await (db as any).execute(sql`
      SELECT id, order_id, doc_number,
        trade_date, value_date, symbol, side,
        quantity::float8 as quantity, price::float8 as price
      FROM pmx_trades
      WHERE value_date IS NOT NULL
        AND trade_date IS NOT NULL
        AND UPPER(REPLACE(symbol, '/', '')) IN ('XAUUSD', 'USDZAR')
        AND side IS NOT NULL
        AND UPPER(COALESCE(fnc_number, '')) NOT LIKE 'SWT/%'
        AND UPPER(COALESCE(doc_number, '')) NOT LIKE 'SWT/%'
      ORDER BY value_date ASC, trade_date DESC
    `);

    const trades: ForwardTradeInput[] = (result as any[]).map((r: any) => ({
      id: r.id,
      tradeNum: r.order_id || "",
      docNumber: r.doc_number || "",
      tradeDate: r.trade_date ? new Date(r.trade_date).toISOString().slice(0, 10) : "",
      valueDate: r.value_date ? new Date(r.value_date).toISOString().slice(0, 10) : "",
      symbol: r.symbol || "",
      side: r.side || "",
      quantity: parseFloat(r.quantity) || 0,
      price: parseFloat(r.price) || 0,
    }));

    const exposure = buildForwardExposure(trades, {
      symbol: symbol || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });

    return NextResponse.json({ ok: true, ...exposure });
  } catch (error) {
    console.error("Forward exposure error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
