import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Date range defaults to month-to-date
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = searchParams.get("start_date") || firstOfMonth.toISOString().slice(0, 10);
    const endDate = searchParams.get("end_date") || now.toISOString().slice(0, 10);

    // Determine month key from start_date
    const month = startDate.slice(0, 7); // "YYYY-MM"

    // Step 1: Load transactions from pmx_trades
    // We use the computeDebitCredit logic inline:
    // XAUUSD BUY: credit XAU (+qty), debit USD (qty*price)
    // XAUUSD SELL: debit XAU (qty), credit USD (qty*price)
    // USDZAR BUY: credit USD (+qty), debit ZAR (qty*price)
    // USDZAR SELL: debit USD (qty), credit ZAR (qty*price)
    const tradesResult = await (db as any).execute(sql.raw(`
      SELECT id, doc_number, trade_date, value_date, symbol, side, narration,
        quantity::float8 as quantity, price::float8 as price, fnc_number
      FROM pmx_trades
      WHERE COALESCE(trade_date::date::text, '0000-00-00') >= '${startDate}'
        AND COALESCE(trade_date::date::text, '9999-12-31') <= '${endDate}'
        AND UPPER(COALESCE(fnc_number, '')) NOT LIKE 'SWT/%'
        AND UPPER(COALESCE(doc_number, '')) NOT LIKE 'SWT/%'
      ORDER BY trade_date ASC, id ASC
    `));

    let txXau = 0, txUsd = 0, txZar = 0;
    const rows: any[] = [];

    for (const r of (tradesResult as any[])) {
      const sym = (r.symbol || "").toUpperCase().replace(/[/\- ]/g, "");
      const side = (r.side || "").toUpperCase();
      const qty = Math.abs(parseFloat(r.quantity) || 0);
      const px = Math.abs(parseFloat(r.price) || 0);

      let movXau = 0, movUsd = 0, movZar = 0;

      if (sym === "XAUUSD" || sym.startsWith("XAU")) {
        if (side === "BUY") {
          movXau = qty;         // credit XAU
          movUsd = -(qty * px); // debit USD
        } else if (side === "SELL") {
          movXau = -qty;        // debit XAU
          movUsd = qty * px;    // credit USD
        }
      } else if (sym === "USDZAR" || sym.startsWith("USD")) {
        if (side === "BUY") {
          movUsd = qty;         // credit USD
          movZar = -(qty * px); // debit ZAR
        } else if (side === "SELL") {
          movUsd = -qty;        // debit USD
          movZar = qty * px;    // credit ZAR
        }
      }

      const hasXau = Math.abs(movXau) > 1e-12;
      const hasUsd = Math.abs(movUsd) > 1e-12;
      const hasZar = Math.abs(movZar) > 1e-12;

      if (!hasXau && !hasUsd && !hasZar) continue;

      if (hasXau) txXau += movXau;
      if (hasUsd) txUsd += movUsd;
      if (hasZar) txZar += movZar;

      // Classify row type from doc_number prefix
      const docUpper = (r.doc_number || "").toUpperCase();
      let rowType = "OTHER";
      if (docUpper.startsWith("FNC/")) rowType = "FNC";
      else if (docUpper.startsWith("JRV/")) rowType = "JRV";
      else if (docUpper.startsWith("MER/")) rowType = "MER";
      else if (docUpper.includes("/")) rowType = docUpper.split("/")[0];

      rows.push({
        docNumber: r.doc_number || "",
        tradeDate: r.trade_date ? new Date(r.trade_date).toISOString().slice(0, 10) : "",
        valueDate: r.value_date ? new Date(r.value_date).toISOString().slice(0, 10) : "",
        rowType,
        symbol: r.symbol || "",
        side: r.side || "",
        narration: r.narration || "",
        movementXau: hasXau ? movXau : null,
        movementUsd: hasUsd ? movUsd : null,
        movementZar: hasZar ? movZar : null,
      });
    }

    // Step 2: Load opening balances
    const obResult = await (db as any).execute(sql.raw(
      `SELECT currency, opening_balance::float8 as opening_balance FROM account_opening_balances WHERE month = '${month}'`
    ));
    const opening: Record<string, number | null> = { XAU: null, USD: null, ZAR: null };
    for (const r of (obResult as any[])) {
      const ccy = (r.currency || "").toUpperCase();
      if (ccy in opening) opening[ccy] = parseFloat(r.opening_balance) || 0;
    }

    // Step 3: Build per-currency reconciliation
    const currencies: Record<string, any> = {};
    for (const [ccy, txTotal] of Object.entries({ XAU: txXau, USD: txUsd, ZAR: txZar })) {
      const ob = opening[ccy];
      const expected = ob != null ? ob + txTotal : null;
      // Actual balances will come from PMX API when credentials are configured
      // For now, return null
      currencies[ccy] = {
        openingBalance: ob,
        transactionTotal: txTotal,
        expectedBalance: expected,
        actualBalance: null,  // Requires PMX API credentials
        delta: null,
      };
    }

    return NextResponse.json({
      ok: true,
      startDate,
      endDate,
      month,
      currencies,
      actualBalancesOk: false,  // Will be true when PMX API is connected
      transactionsOk: true,
      rows,
      diagnostics: {
        rowCountTotal: rows.length,
        rowCountXau: rows.filter(r => r.movementXau != null).length,
        rowCountUsd: rows.filter(r => r.movementUsd != null).length,
        rowCountZar: rows.filter(r => r.movementZar != null).length,
      },
    });
  } catch (error) {
    console.error("Account recon error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
