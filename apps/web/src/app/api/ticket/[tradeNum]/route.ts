import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  buildTradingTicket,
  type TicketTmInput,
  type TicketPmxInput,
} from "@foundation/domain";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tradeNum: string }> }
) {
  try {
    const { tradeNum: rawTradeNum } = await params;

    // Normalize trade number: uppercase, strip trailing .0
    let tradeNum = rawTradeNum.trim().toUpperCase();
    if (tradeNum.endsWith(".0")) {
      tradeNum = tradeNum.slice(0, -2);
    }

    if (!tradeNum) {
      return NextResponse.json(
        { ok: false, error: "Trade number is required" },
        { status: 400 }
      );
    }

    // Load confirmed TradeMC trades matching ref_number, joined with companies
    const tmResult = await (db as any).execute(sql`
      SELECT
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
        AND UPPER(TRIM(t.ref_number)) = ${tradeNum}
    `);

    const tmInputs: TicketTmInput[] = (tmResult as any[]).map((r: any) => {
      const zarToUsd =
        parseFloat(r.zar_to_usd_confirmed) || parseFloat(r.zar_to_usd) || 0;
      const zarPerOz =
        parseFloat(r.zar_per_troy_ounce_confirmed) ||
        parseFloat(r.zar_per_troy_ounce) ||
        0;

      // Use confirmed USD/oz; if absent, derive from ZAR/oz / FX rate
      let usdPerOz = parseFloat(r.usd_per_troy_ounce_confirmed) || 0;
      if (!usdPerOz && zarPerOz > 0 && zarToUsd > 0) {
        usdPerOz = zarPerOz / zarToUsd;
      }

      return {
        companyName: r.company_name || "",
        weightG: parseFloat(r.weight) || 0,
        usdPerTroyOunce: usdPerOz,
        zarToUsd,
        refiningRate: parseFloat(r.refining_rate) || 0,
      };
    });

    // Load PMX/StoneX trades matching order_id
    const pmxResult = await (db as any).execute(sql`
      SELECT
        doc_number, fnc_number,
        trade_date, value_date,
        symbol, side,
        quantity::float8 as quantity,
        price::float8 as price,
        narration
      FROM pmx_trades
      WHERE UPPER(TRIM(order_id)) = ${tradeNum}
    `);

    const pmxInputs: TicketPmxInput[] = (pmxResult as any[]).map((r: any) => ({
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
    }));

    const ticket = buildTradingTicket(tradeNum, tmInputs, pmxInputs);

    return NextResponse.json({ ok: true, ticket });
  } catch (error) {
    console.error("Ticket error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed",
      },
      { status: 500 }
    );
  }
}
