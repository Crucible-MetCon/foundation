import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { buildLedger, type RawTradeRow } from "@foundation/domain";

export async function GET() {
  try {
    const result = await (db as any).execute(sql`
      SELECT id, doc_number, trade_date, value_date, symbol, side,
        quantity::float8 as quantity, price::float8 as price,
        narration, order_id, fnc_number, trader_name,
        settle_currency, settle_amount::float8 as settle_amount
      FROM pmx_trades
      ORDER BY trade_date ASC, id ASC
    `);

    const rawTrades: RawTradeRow[] = (result as any[]).map((r: any) => ({
      id: r.id,
      docNumber: r.doc_number || "",
      tradeDate: r.trade_date ? new Date(r.trade_date).toISOString().slice(0, 10) : "",
      valueDate: r.value_date ? new Date(r.value_date).toISOString().slice(0, 10) : "",
      symbol: r.symbol || "",
      side: r.side || "",
      quantity: parseFloat(r.quantity) || 0,
      price: parseFloat(r.price) || 0,
      narration: r.narration || "",
      orderId: r.order_id || "",
      fncNumber: r.fnc_number || "",
      traderName: r.trader_name || "",
      settleCurrency: r.settle_currency || "",
      settleAmount: parseFloat(r.settle_amount) || 0,
    }));

    const ledger = buildLedger(rawTrades);
    const openRows = ledger.filter((r) => r.status === "Open");

    // Group by trade key for summary
    const tradeGroups: Record<string, { balanceUsd: number; balanceZar: number; rows: typeof openRows }> = {};
    for (const row of openRows) {
      const key = row.tradeNumber || row.docNumber || `__id_${row.id}`;
      if (!tradeGroups[key]) {
        tradeGroups[key] = { balanceUsd: 0, balanceZar: 0, rows: [] };
      }
      tradeGroups[key].rows.push(row);
      tradeGroups[key].balanceUsd = row.balanceUsd;
      tradeGroups[key].balanceZar = row.balanceZar;
    }

    const positions = Object.entries(tradeGroups).map(([key, group]) => ({
      tradeNumber: key,
      balanceUsd: group.balanceUsd,
      balanceZar: group.balanceZar,
      tradeCount: group.rows.length,
      lastTradeDate: group.rows[group.rows.length - 1]?.tradeDate || "",
      symbol: group.rows[0]?.symbol || "",
    }));

    const summary = {
      openTrades: positions.length,
      totalOpenUsd: positions.reduce((s, p) => s + p.balanceUsd, 0),
      totalOpenZar: positions.reduce((s, p) => s + p.balanceZar, 0),
    };

    return NextResponse.json({ ok: true, positions, openRows, summary });
  } catch (error) {
    console.error("Open positions error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
