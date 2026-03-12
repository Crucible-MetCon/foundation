import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { mapRowToTrade } from "@foundation/integrations";

export async function GET() {
  try {
    // Debug: test parseDate with a mock PMX row
    const testRow = {
      docno: "TEST/001",
      docdate: "05-Mar-2026",
      valdate: "09-Mar-2026",
      inst_desc: "XAU-USD",
      deal_type: "BUY",
      grs_qty: "100",
      mtl_rate: "5000",
      remarks: "Test trade",
      stk_type_name: "XAU",
    };
    const mapped = mapRowToTrade(testRow, 1);
    const parseDebug = {
      inputDocdate: testRow.docdate,
      inputValdate: testRow.valdate,
      mappedTradeDate: mapped?.tradeDate,
      mappedValueDate: mapped?.valueDate,
    };
    const countResult = await (db as any).execute(
      sql`SELECT COUNT(*) as count FROM pmx_trades`
    );
    const count = parseInt((countResult as any[])?.[0]?.count ?? "0", 10);

    const latestResult = await (db as any).execute(
      sql`SELECT MAX(synced_at) as last_sync, MAX(trade_date) as latest_trade FROM pmx_trades`
    );
    const lastSync = (latestResult as any[])?.[0]?.last_sync || null;
    const latestTrade = (latestResult as any[])?.[0]?.latest_trade || null;

    const symbolResult = await (db as any).execute(
      sql`SELECT symbol, COUNT(*) as count FROM pmx_trades GROUP BY symbol ORDER BY count DESC`
    );

    return NextResponse.json({
      ok: true,
      parseDebug,
      tradeCount: count,
      lastSync,
      latestTradeDate: latestTrade,
      symbolBreakdown: (symbolResult as any[]).map((r: any) => ({
        symbol: r.symbol,
        count: parseInt(r.count, 10),
      })),
    });
  } catch (error) {
    console.error("PMX status error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Status check failed" },
      { status: 500 }
    );
  }
}
