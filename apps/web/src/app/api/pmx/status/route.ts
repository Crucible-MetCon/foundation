import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
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
