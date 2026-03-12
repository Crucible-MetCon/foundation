import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    // Aggregate all PMX trades to compute net balances per currency
    // XAUUSD trades: BUY → credit XAU (receive metal) + debit USD (pay cash)
    //                SELL → debit XAU (deliver metal) + credit USD (receive cash)
    // USDZAR trades: BUY → credit USD (receive) + debit ZAR (pay)
    //                SELL → debit USD (deliver) + credit ZAR (receive)

    const result = await (db as any).execute(sql`
      SELECT
        -- XAU balance (from XAUUSD trades only)
        COALESCE(SUM(
          CASE
            WHEN UPPER(REPLACE(symbol, '/', '')) LIKE 'XAU%' AND UPPER(side) = 'BUY' THEN quantity::float8
            WHEN UPPER(REPLACE(symbol, '/', '')) LIKE 'XAU%' AND UPPER(side) = 'SELL' THEN -quantity::float8
            ELSE 0
          END
        ), 0) AS xau_balance,

        -- USD balance (from both XAUUSD and USDZAR trades)
        COALESCE(SUM(
          CASE
            -- XAUUSD: BUY gold = debit USD, SELL gold = credit USD
            WHEN UPPER(REPLACE(symbol, '/', '')) LIKE 'XAU%' AND UPPER(side) = 'BUY' THEN -(quantity::float8 * price::float8)
            WHEN UPPER(REPLACE(symbol, '/', '')) LIKE 'XAU%' AND UPPER(side) = 'SELL' THEN (quantity::float8 * price::float8)
            -- USDZAR: SELL USD = debit USD, BUY USD = credit USD
            WHEN UPPER(REPLACE(symbol, '/', '')) LIKE 'USD%' AND UPPER(side) = 'SELL' THEN -quantity::float8
            WHEN UPPER(REPLACE(symbol, '/', '')) LIKE 'USD%' AND UPPER(side) = 'BUY' THEN quantity::float8
            ELSE 0
          END
        ), 0) AS usd_balance,

        -- ZAR balance (from USDZAR trades only)
        COALESCE(SUM(
          CASE
            WHEN UPPER(REPLACE(symbol, '/', '')) LIKE 'USD%' AND UPPER(side) = 'SELL' THEN (quantity::float8 * price::float8)
            WHEN UPPER(REPLACE(symbol, '/', '')) LIKE 'USD%' AND UPPER(side) = 'BUY' THEN -(quantity::float8 * price::float8)
            ELSE 0
          END
        ), 0) AS zar_balance,

        -- Trade counts
        COUNT(*) AS total_trades,
        COUNT(DISTINCT order_id) FILTER (WHERE order_id IS NOT NULL AND TRIM(order_id) != '') AS unique_trades,
        MAX(trade_date) AS last_trade_date,

        -- Per-symbol counts
        COUNT(*) FILTER (WHERE UPPER(REPLACE(symbol, '/', '')) LIKE 'XAU%') AS xau_trades,
        COUNT(*) FILTER (WHERE UPPER(REPLACE(symbol, '/', '')) LIKE 'USD%') AS fx_trades
      FROM pmx_trades
    `);

    const row = (result as any[])[0] || {};

    // Also get per-trade breakdown for open positions
    const openResult = await (db as any).execute(sql`
      WITH trade_balances AS (
        SELECT
          COALESCE(order_id, doc_number) AS trade_key,
          SUM(CASE
            WHEN UPPER(REPLACE(symbol, '/', '')) LIKE 'XAU%' AND UPPER(side) = 'BUY' THEN -(quantity::float8 * price::float8)
            WHEN UPPER(REPLACE(symbol, '/', '')) LIKE 'XAU%' AND UPPER(side) = 'SELL' THEN (quantity::float8 * price::float8)
            WHEN UPPER(REPLACE(symbol, '/', '')) LIKE 'USD%' AND UPPER(side) = 'SELL' THEN -quantity::float8
            WHEN UPPER(REPLACE(symbol, '/', '')) LIKE 'USD%' AND UPPER(side) = 'BUY' THEN quantity::float8
            ELSE 0
          END) AS usd_bal,
          SUM(CASE
            WHEN UPPER(REPLACE(symbol, '/', '')) LIKE 'USD%' AND UPPER(side) = 'SELL' THEN (quantity::float8 * price::float8)
            WHEN UPPER(REPLACE(symbol, '/', '')) LIKE 'USD%' AND UPPER(side) = 'BUY' THEN -(quantity::float8 * price::float8)
            ELSE 0
          END) AS zar_bal
        FROM pmx_trades
        WHERE order_id IS NOT NULL AND TRIM(order_id) != ''
        GROUP BY COALESCE(order_id, doc_number)
      )
      SELECT
        COUNT(*) FILTER (WHERE ABS(usd_bal) > 0.01 OR ABS(zar_bal) > 0.01) AS open_count,
        COUNT(*) FILTER (WHERE ABS(usd_bal) <= 0.01 AND ABS(zar_bal) <= 0.01) AS closed_count
      FROM trade_balances
    `);

    const openRow = (openResult as any[])[0] || {};

    const xauBalOz = parseFloat(row.xau_balance) || 0;

    return NextResponse.json({
      ok: true,
      balances: {
        xau: {
          balanceOz: xauBalOz,
          balanceG: xauBalOz * 31.1035,
          label: "Gold (XAU)",
        },
        usd: {
          balance: parseFloat(row.usd_balance) || 0,
          label: "US Dollar (USD)",
        },
        zar: {
          balance: parseFloat(row.zar_balance) || 0,
          label: "South African Rand (ZAR)",
        },
      },
      stats: {
        totalTrades: parseInt(row.total_trades) || 0,
        uniqueTrades: parseInt(row.unique_trades) || 0,
        lastTradeDate: row.last_trade_date ? new Date(row.last_trade_date).toISOString().slice(0, 10) : null,
        xauTradeCount: parseInt(row.xau_trades) || 0,
        fxTradeCount: parseInt(row.fx_trades) || 0,
        openPositions: parseInt(openRow.open_count) || 0,
        closedPositions: parseInt(openRow.closed_count) || 0,
      },
    });
  } catch (error) {
    console.error("Account balances error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load balances" },
      { status: 500 }
    );
  }
}
