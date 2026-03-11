import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pmxTrades } from "@foundation/db";
import { sql } from "drizzle-orm";
import {
  fetchAllDealReport,
  mapRowToTrade,
  formatPmxDate,
  type PmxConfig,
} from "@foundation/integrations";

function getPmxConfig(): PmxConfig {
  return {
    pmxHost: process.env.PMX_API_HOST || "pmxapi.stonex.com",
    pmxLoginUsername: process.env.PMX_LOGIN_USERNAME || "",
    pmxLoginPassword: process.env.PMX_LOGIN_PASSWORD || "",
    pmxLoginLocation: process.env.PMX_LOGIN_LOCATION || "LD",
    pmxPlatform: process.env.PMX_PLATFORM || "Desktop",
    pmxAccOptKey: process.env.PMX_ACC_OPT_KEY || "MT0601",
    pmxCreatedBy: process.env.PMX_CREATED_BY || "2",
    stonexHost: process.env.STONEX_HOST || "api.stonex.com",
    stonexSubscriptionKey: process.env.STONEX_SUBSCRIPTION_KEY || "",
    stonexUsername: process.env.STONEX_USERNAME || "",
    stonexPassword: process.env.STONEX_PASSWORD || "",
  };
}

/** Fiscal floor date - trades before this are excluded */
const FISCAL_START = process.env.FISCAL_TRADES_START_DATE || "2026-03-01";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const replace = Boolean(body.replace);
    const config = getPmxConfig();

    // Determine date range
    const now = new Date();
    const fiscalFloor = new Date(FISCAL_START);

    let startDate: Date;
    if (body.startDate) {
      startDate = new Date(body.startDate);
    } else if (!replace) {
      // Get latest trade date from DB to do incremental sync
      const latest = await (db as any).execute(
        sql`SELECT MAX(trade_date) as max_date FROM pmx_trades WHERE trade_date IS NOT NULL`
      );
      const latestDate = latest?.[0]?.max_date;
      startDate = latestDate ? new Date(latestDate) : fiscalFloor;
    } else {
      startDate = fiscalFloor;
    }

    // Enforce fiscal floor
    if (startDate < fiscalFloor) startDate = fiscalFloor;

    const endDate = body.endDate ? new Date(body.endDate) : now;

    // Fetch from PMX
    const result = await fetchAllDealReport(config, {
      startDate: formatPmxDate(startDate),
      endDate: formatPmxDate(endDate),
      cmdty: body.cmdty || "All",
      trdOpt: body.trdOpt || "All",
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error || "PMX fetch failed",
          startDate: result.startDate,
          endDate: result.endDate,
        },
        { status: 502 }
      );
    }

    // Map rows and upsert
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    if (replace) {
      await (db as any).execute(sql`DELETE FROM pmx_trades`);
    }

    for (let i = 0; i < result.rows.length; i++) {
      const mapped = mapRowToTrade(result.rows[i], i + 1);
      if (!mapped) {
        skipped++;
        continue;
      }

      // Enforce fiscal floor
      if (mapped.tradeDate < FISCAL_START) {
        skipped++;
        continue;
      }

      try {
        await (db as any).execute(sql`
          INSERT INTO pmx_trades (
            doc_number, trade_date, value_date, symbol, side,
            quantity, price, narration, settle_currency, settle_amount,
            order_id, clord_id, fnc_number, trader_name, source_system,
            rest_trade_id, raw_payload, synced_at
          ) VALUES (
            ${mapped.docNumber},
            ${mapped.tradeDate ? new Date(mapped.tradeDate) : null},
            ${mapped.valueDate ? new Date(mapped.valueDate) : null},
            ${mapped.symbol},
            ${mapped.side},
            ${mapped.quantity},
            ${mapped.price},
            ${mapped.narration},
            ${mapped.settleCurrency},
            ${mapped.settleAmount},
            ${mapped.orderId || null},
            ${mapped.clordId || null},
            ${mapped.fncNumber || null},
            ${mapped.traderName || null},
            ${mapped.sourceSystem},
            ${mapped.restTradeId || null},
            ${mapped.rawPayload ? sql`${mapped.rawPayload}::jsonb` : null},
            NOW()
          )
          ON CONFLICT (doc_number) DO UPDATE SET
            trade_date = EXCLUDED.trade_date,
            value_date = EXCLUDED.value_date,
            symbol = EXCLUDED.symbol,
            side = EXCLUDED.side,
            quantity = EXCLUDED.quantity,
            price = EXCLUDED.price,
            narration = EXCLUDED.narration,
            settle_currency = EXCLUDED.settle_currency,
            settle_amount = EXCLUDED.settle_amount,
            order_id = CASE
              WHEN EXCLUDED.order_id IS NOT NULL AND TRIM(EXCLUDED.order_id) != ''
              THEN EXCLUDED.order_id
              ELSE pmx_trades.order_id
            END,
            clord_id = EXCLUDED.clord_id,
            fnc_number = CASE
              WHEN EXCLUDED.fnc_number IS NOT NULL AND TRIM(EXCLUDED.fnc_number) != ''
              THEN EXCLUDED.fnc_number
              ELSE pmx_trades.fnc_number
            END,
            trader_name = EXCLUDED.trader_name,
            source_system = EXCLUDED.source_system,
            rest_trade_id = EXCLUDED.rest_trade_id,
            raw_payload = EXCLUDED.raw_payload,
            synced_at = NOW()
        `);

        // Determine if insert or update (simplified - count as insert for new doc_numbers)
        inserted++;
      } catch (err: any) {
        if (err?.message?.includes("duplicate") || err?.code === "23505") {
          updated++;
        } else {
          console.error(`Failed to upsert trade ${mapped.docNumber}:`, err);
          skipped++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      fetchedRows: result.rows.length,
      inserted,
      updated,
      skipped,
      startDate: result.startDate,
      endDate: result.endDate,
      sessionRefreshed: result.sessionRefreshed,
      fiscalCutoff: FISCAL_START,
      replace,
    });
  } catch (error) {
    console.error("PMX sync error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "PMX sync failed",
      },
      { status: 500 }
    );
  }
}
