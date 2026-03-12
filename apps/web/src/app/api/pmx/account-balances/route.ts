import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    // Aggregate all PMX trades to compute net balances per currency/metal
    // Metal trades (XAUUSD, XAGUSD, XPTUSD, XPDUSD):
    //   BUY  → credit metal (receive) + debit USD (pay: qty * price)
    //   SELL → debit metal (deliver) + credit USD (receive: qty * price)
    // FX trades (USDZAR):
    //   BUY  → credit USD (receive qty) + debit ZAR (pay: qty * price)
    //   SELL → debit USD (deliver qty) + credit ZAR (receive: qty * price)

    const result = await (db as any).execute(sql`
      SELECT
        -- XAU balance (troy ounces)
        COALESCE(SUM(
          CASE
            WHEN UPPER(REPLACE(symbol, '/', '')) LIKE 'XAU%' AND UPPER(side) = 'BUY' THEN quantity::float8
            WHEN UPPER(REPLACE(symbol, '/', '')) LIKE 'XAU%' AND UPPER(side) = 'SELL' THEN -quantity::float8
            ELSE 0
          END
        ), 0) AS xau_balance,

        -- XAG balance (troy ounces)
        COALESCE(SUM(
          CASE
            WHEN UPPER(REPLACE(symbol, '/', '')) LIKE 'XAG%' AND UPPER(side) = 'BUY' THEN quantity::float8
            WHEN UPPER(REPLACE(symbol, '/', '')) LIKE 'XAG%' AND UPPER(side) = 'SELL' THEN -quantity::float8
            ELSE 0
          END
        ), 0) AS xag_balance,

        -- XPT balance (troy ounces)
        COALESCE(SUM(
          CASE
            WHEN UPPER(REPLACE(symbol, '/', '')) LIKE 'XPT%' AND UPPER(side) = 'BUY' THEN quantity::float8
            WHEN UPPER(REPLACE(symbol, '/', '')) LIKE 'XPT%' AND UPPER(side) = 'SELL' THEN -quantity::float8
            ELSE 0
          END
        ), 0) AS xpt_balance,

        -- XPD balance (troy ounces)
        COALESCE(SUM(
          CASE
            WHEN UPPER(REPLACE(symbol, '/', '')) LIKE 'XPD%' AND UPPER(side) = 'BUY' THEN quantity::float8
            WHEN UPPER(REPLACE(symbol, '/', '')) LIKE 'XPD%' AND UPPER(side) = 'SELL' THEN -quantity::float8
            ELSE 0
          END
        ), 0) AS xpd_balance,

        -- USD balance (from all metal trades + USDZAR)
        COALESCE(SUM(
          CASE
            -- All metals vs USD: BUY metal = debit USD, SELL metal = credit USD
            WHEN UPPER(REPLACE(symbol, '/', '')) ~ '^(XAU|XAG|XPT|XPD)' AND UPPER(side) = 'BUY' THEN -(quantity::float8 * price::float8)
            WHEN UPPER(REPLACE(symbol, '/', '')) ~ '^(XAU|XAG|XPT|XPD)' AND UPPER(side) = 'SELL' THEN (quantity::float8 * price::float8)
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
        COUNT(*) FILTER (WHERE UPPER(REPLACE(symbol, '/', '')) LIKE 'XAG%') AS xag_trades,
        COUNT(*) FILTER (WHERE UPPER(REPLACE(symbol, '/', '')) LIKE 'XPT%') AS xpt_trades,
        COUNT(*) FILTER (WHERE UPPER(REPLACE(symbol, '/', '')) LIKE 'XPD%') AS xpd_trades,
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
            WHEN UPPER(REPLACE(symbol, '/', '')) ~ '^(XAU|XAG|XPT|XPD)' AND UPPER(side) = 'BUY' THEN -(quantity::float8 * price::float8)
            WHEN UPPER(REPLACE(symbol, '/', '')) ~ '^(XAU|XAG|XPT|XPD)' AND UPPER(side) = 'SELL' THEN (quantity::float8 * price::float8)
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
    const xagBalOz = parseFloat(row.xag_balance) || 0;
    const xptBalOz = parseFloat(row.xpt_balance) || 0;
    const xpdBalOz = parseFloat(row.xpd_balance) || 0;

    return NextResponse.json({
      ok: true,
      balances: {
        xau: {
          balanceOz: xauBalOz,
          balanceG: xauBalOz * 31.1035,
          label: "Gold (XAU)",
        },
        xag: {
          balanceOz: xagBalOz,
          balanceG: xagBalOz * 31.1035,
          label: "Silver (XAG)",
        },
        xpt: {
          balanceOz: xptBalOz,
          balanceG: xptBalOz * 31.1035,
          label: "Platinum (XPT)",
        },
        xpd: {
          balanceOz: xpdBalOz,
          balanceG: xpdBalOz * 31.1035,
          label: "Palladium (XPD)",
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
        xagTradeCount: parseInt(row.xag_trades) || 0,
        xptTradeCount: parseInt(row.xpt_trades) || 0,
        xpdTradeCount: parseInt(row.xpd_trades) || 0,
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
