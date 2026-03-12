import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { buildLedger, computeLedgerSummary, type RawTradeRow } from "@foundation/domain";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol") || "";
    const tradeNum = searchParams.get("tradeNum") || "";
    const narration = searchParams.get("narration") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const status = searchParams.get("status") || "";

    // Build WHERE clauses
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (symbol && symbol !== "All") {
      const symbolNorm = symbol.replace(/[/\- ]/g, "").toUpperCase();
      conditions.push(`REPLACE(REPLACE(REPLACE(UPPER(COALESCE(symbol, '')), '/', ''), '-', ''), ' ', '') = $${paramIdx++}`);
      params.push(symbolNorm);
    }

    if (tradeNum) {
      conditions.push(`UPPER(COALESCE(order_id, '')) LIKE $${paramIdx++}`);
      params.push(`%${tradeNum.toUpperCase()}%`);
    }

    if (narration) {
      conditions.push(`UPPER(COALESCE(narration, '')) LIKE $${paramIdx++}`);
      params.push(`%${narration.toUpperCase()}%`);
    }

    if (startDate) {
      conditions.push(`trade_date >= $${paramIdx++}::date`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`trade_date <= $${paramIdx++}::date`);
      params.push(endDate);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const query = `
      SELECT
        id,
        doc_number,
        trade_date,
        value_date,
        symbol,
        side,
        quantity::float8 as quantity,
        price::float8 as price,
        narration,
        order_id,
        fnc_number,
        trader_name,
        settle_currency,
        settle_amount::float8 as settle_amount
      FROM pmx_trades
      ${whereClause}
      ORDER BY trade_date ASC, id ASC
    `;

    const result = await (db as any).execute(sql.raw(
      params.length > 0
        ? query.replace(/\$(\d+)/g, (_, idx) => {
            const val = params[parseInt(idx) - 1];
            if (val === null) return "NULL";
            if (typeof val === "number") return String(val);
            return `'${String(val).replace(/'/g, "''")}'`;
          })
        : query
    ));

    // Map to RawTradeRow format
    const rawTrades: RawTradeRow[] = (result as any[]).map((row: any) => ({
      id: row.id,
      docNumber: row.doc_number || "",
      tradeDate: row.trade_date ? new Date(row.trade_date).toISOString().slice(0, 10) : "",
      valueDate: row.value_date ? new Date(row.value_date).toISOString().slice(0, 10) : "",
      symbol: row.symbol || "",
      side: row.side || "",
      quantity: parseFloat(row.quantity) || 0,
      price: parseFloat(row.price) || 0,
      narration: row.narration || "",
      orderId: row.order_id || "",
      fncNumber: row.fnc_number || "",
      traderName: row.trader_name || "",
      settleCurrency: row.settle_currency || "",
      settleAmount: parseFloat(row.settle_amount) || 0,
    }));

    // Build ledger with running balances
    let ledgerRows = buildLedger(rawTrades);

    // Post-filter by status if requested
    if (status === "Open" || status === "Closed") {
      ledgerRows = ledgerRows.filter((r) => r.status === status);
    }

    const summary = computeLedgerSummary(ledgerRows);

    return NextResponse.json({
      ok: true,
      rows: ledgerRows,
      summary,
      count: ledgerRows.length,
    });
  } catch (error) {
    console.error("Ledger error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load ledger" },
      { status: 500 }
    );
  }
}
