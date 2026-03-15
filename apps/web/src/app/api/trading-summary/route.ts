import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  buildTradingTicket,
  type TicketTmInput,
  type TicketPmxInput,
} from "@foundation/domain";

export async function GET() {
  try {
    // 1. Load ALL confirmed TradeMC trades with company info
    const tmResult = await (db as any).execute(sql`
      SELECT
        t.ref_number,
        c.company_name,
        t.weight::float8 as weight,
        t.zar_to_usd::float8 as zar_to_usd,
        t.zar_to_usd_confirmed::float8 as zar_to_usd_confirmed,
        t.usd_per_troy_ounce_confirmed::float8 as usd_per_troy_ounce_confirmed,
        t.zar_per_troy_ounce::float8 as zar_per_troy_ounce,
        t.zar_per_troy_ounce_confirmed::float8 as zar_per_troy_ounce_confirmed,
        c.refining_rate::float8 as refining_rate
      FROM trademc_trades t
      LEFT JOIN trademc_companies c ON t.company_id = c.directus_id
      WHERE t.status = 'confirmed'
        AND t.ref_number IS NOT NULL
        AND TRIM(t.ref_number) != ''
    `);

    // 2. Load ALL PMX trades with order_id
    const pmxResult = await (db as any).execute(sql`
      SELECT
        order_id,
        doc_number, fnc_number,
        trade_date, value_date,
        symbol, side,
        quantity::float8 as quantity,
        price::float8 as price,
        narration
      FROM pmx_trades
      WHERE order_id IS NOT NULL
        AND TRIM(order_id) != ''
    `);

    // 3. Group TradeMC rows by ticket number
    const tmByTicket = new Map<string, TicketTmInput[]>();
    for (const r of tmResult as any[]) {
      const key = (r.ref_number || "").toString().trim().toUpperCase();
      const normKey = key.endsWith(".0") ? key.slice(0, -2) : key;
      if (!normKey) continue;

      const zarToUsd =
        parseFloat(r.zar_to_usd_confirmed) || parseFloat(r.zar_to_usd) || 0;
      const zarPerOz =
        parseFloat(r.zar_per_troy_ounce_confirmed) ||
        parseFloat(r.zar_per_troy_ounce) ||
        0;

      let usdPerOz = parseFloat(r.usd_per_troy_ounce_confirmed) || 0;
      if (!usdPerOz && zarPerOz > 0 && zarToUsd > 0) {
        usdPerOz = zarPerOz / zarToUsd;
      }

      const input: TicketTmInput = {
        companyName: r.company_name || "",
        weightG: parseFloat(r.weight) || 0,
        usdPerTroyOunce: usdPerOz,
        zarToUsd,
        refiningRate: parseFloat(r.refining_rate) || 0,
      };

      if (!tmByTicket.has(normKey)) {
        tmByTicket.set(normKey, []);
      }
      tmByTicket.get(normKey)!.push(input);
    }

    // 4. Group PMX rows by ticket number, also track earliest trade date
    const pmxByTicket = new Map<string, TicketPmxInput[]>();
    const tradeDateByTicket = new Map<string, string>();

    for (const r of pmxResult as any[]) {
      const key = (r.order_id || "").toString().trim().toUpperCase();
      const normKey = key.endsWith(".0") ? key.slice(0, -2) : key;
      if (!normKey) continue;

      const input: TicketPmxInput = {
        docNumber: r.doc_number || "",
        fncNumber: r.fnc_number || "",
        tradeDate: r.trade_date
          ? new Date(r.trade_date).toISOString().slice(0, 10)
          : "",
        valueDate: r.value_date
          ? new Date(r.value_date).toISOString().slice(0, 10)
          : "",
        symbol: r.symbol || "",
        side: r.side || "",
        quantity: parseFloat(r.quantity) || 0,
        price: parseFloat(r.price) || 0,
        narration: r.narration || "",
      };

      if (!pmxByTicket.has(normKey)) {
        pmxByTicket.set(normKey, []);
      }
      pmxByTicket.get(normKey)!.push(input);

      // Track earliest trade date
      if (input.tradeDate) {
        const existing = tradeDateByTicket.get(normKey);
        if (!existing || input.tradeDate < existing) {
          tradeDateByTicket.set(normKey, input.tradeDate);
        }
      }
    }

    // 5. Union all ticket numbers
    const allTicketNums = new Set<string>();
    for (const key of tmByTicket.keys()) allTicketNums.add(key);
    for (const key of pmxByTicket.keys()) allTicketNums.add(key);

    // 6. Build ticket summaries (lightweight - no detail rows in response)
    interface TicketSummaryRow {
      tradeNum: string;
      earliestTradeDate: string;
      buyWeightG: number;
      buyWeightOz: number;
      sellWeightOz: number;
      varianceOz: number;
      goldWaUsdOz: number;
      fxWaUsdzar: number;
      spotZarPerG: number;
      profitUsd: number;
      profitZar: number;
      profitPct: number;
      controlAccountOz: number;
      buySideZar: number;
      sellSideZar: number;
      buySideUsd: number;
      sellSideUsd: number;
      stonexZarFlow: number;
      controlAccountG: number;
      controlAccountZar: number;
    }

    const tickets: TicketSummaryRow[] = [];

    for (const tradeNum of allTicketNums) {
      const tmInputs = tmByTicket.get(tradeNum) || [];
      const pmxInputs = pmxByTicket.get(tradeNum) || [];

      const ticket = buildTradingTicket(tradeNum, tmInputs, pmxInputs);

      // Calculate sell weight from PMX XAUUSD SELL trades
      let sellWeightOz = 0;
      for (const row of ticket.stonexRows) {
        const sym = row.symbol.replace(/[/\- ]/g, "");
        if ((sym === "XAUUSD" || sym.startsWith("XAU")) && row.side === "SELL") {
          sellWeightOz += row.quantity;
        }
      }

      const varianceOz = sellWeightOz - ticket.summary.totalTradedOz;

      tickets.push({
        tradeNum,
        earliestTradeDate: tradeDateByTicket.get(tradeNum) || "",
        buyWeightG: ticket.summary.totalTradedG,
        buyWeightOz: ticket.summary.totalTradedOz,
        sellWeightOz,
        varianceOz,
        goldWaUsdOz: ticket.summary.goldWaUsdOz,
        fxWaUsdzar: ticket.summary.fxWaUsdzar,
        spotZarPerG: ticket.summary.spotZarPerG,
        profitUsd: ticket.summary.profitUsd,
        profitZar: ticket.summary.profitZar,
        profitPct: ticket.summary.profitPct,
        controlAccountOz: ticket.summary.controlAccountOz,
        buySideZar: ticket.summary.buySideZar,
        sellSideZar: ticket.summary.sellSideZar,
        buySideUsd: ticket.summary.buySideUsd,
        sellSideUsd: ticket.summary.sellSideUsd,
        stonexZarFlow: ticket.summary.stonexZarFlow,
        controlAccountG: ticket.summary.controlAccountG,
        controlAccountZar: ticket.summary.controlAccountZar,
      });
    }

    // 7. Sort descending by ticket number (numeric first, then alpha)
    tickets.sort((a, b) => {
      const numA = parseInt(a.tradeNum, 10);
      const numB = parseInt(b.tradeNum, 10);
      const aIsNum = !isNaN(numA) && String(numA) === a.tradeNum;
      const bIsNum = !isNaN(numB) && String(numB) === b.tradeNum;
      // Numeric tickets come first
      if (aIsNum && !bIsNum) return -1;
      if (!aIsNum && bIsNum) return 1;
      // Both numeric: sort descending
      if (aIsNum && bIsNum) return numB - numA;
      // Both non-numeric: sort alphabetically descending
      return b.tradeNum.localeCompare(a.tradeNum);
    });

    return NextResponse.json({ ok: true, tickets });
  } catch (error) {
    console.error("Trading summary error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load trading summary",
      },
      { status: 500 },
    );
  }
}
