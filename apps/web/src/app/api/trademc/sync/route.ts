import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  fetchCompanies,
  fetchAllTrades,
  fetchAllWeightTransactions,
  type TradeMcConfig,
} from "@foundation/integrations";

function getTmcConfig(): TradeMcConfig {
  return {
    baseUrl: process.env.TRADEMC_BASE_URL || "https://trademc-admin.metcon.co.za",
    apiKey: process.env.TRADEMC_API_KEY || "",
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const includeWeight = Boolean(body.includeWeight);
    const config = getTmcConfig();

    if (!config.apiKey) {
      return NextResponse.json(
        { ok: false, error: "TRADEMC_API_KEY not configured" },
        { status: 500 }
      );
    }

    const result: Record<string, unknown> = { ok: true };

    // Sync companies
    const compResult = await fetchCompanies(config);
    let companiesInserted = 0;
    if (compResult.ok) {
      for (const c of compResult.companies) {
        await (db as any).execute(sql`
          INSERT INTO trademc_companies (directus_id, company_name, status, registration_number,
            contact_number, email_address, trade_limit, blocked, vat_number,
            evo_customer_code, refining_rate, synced_at)
          VALUES (${c.id}, ${c.company_name}, ${c.status}, ${c.registration_number},
            ${c.contact_number}, ${c.email_address}, ${c.trade_limit},
            ${c.blocked || false}, ${c.vat_number}, ${c.EVO_customer_code},
            ${c.refining_rate}, NOW())
          ON CONFLICT (directus_id) DO UPDATE SET
            company_name = EXCLUDED.company_name,
            status = EXCLUDED.status,
            registration_number = EXCLUDED.registration_number,
            contact_number = EXCLUDED.contact_number,
            email_address = EXCLUDED.email_address,
            trade_limit = EXCLUDED.trade_limit,
            blocked = EXCLUDED.blocked,
            vat_number = EXCLUDED.vat_number,
            evo_customer_code = EXCLUDED.evo_customer_code,
            refining_rate = EXCLUDED.refining_rate,
            synced_at = NOW()
        `);
        companiesInserted++;
      }
    }
    result.companies = { fetched: compResult.companies.length, synced: companiesInserted };

    // Sync trades (incremental: only fetch trades updated since last sync)
    const lastSyncResult = await (db as any).execute(sql`
      SELECT MAX(synced_at) as last_sync FROM trademc_trades
    `);
    const lastSync = (lastSyncResult as any[])?.[0]?.last_sync
      ? new Date((lastSyncResult as any[])[0].last_sync).toISOString()
      : undefined;

    const tradeResult = await fetchAllTrades(config, {
      updatedAfter: lastSync,
    });
    let tradesInserted = 0;
    if (tradeResult.ok) {
      for (const t of tradeResult.trades) {
        await (db as any).execute(sql`
          INSERT INTO trademc_trades (directus_id, status, company_id, weight, notes,
            ref_number, trade_timestamp, zar_per_troy_ounce, zar_to_usd,
            requested_zar_per_gram, zar_per_troy_ounce_confirmed,
            zar_to_usd_confirmed, usd_per_troy_ounce_confirmed,
            evo_exported, synced_at)
          VALUES (${t.id}, ${t.status}, ${t.company_id}, ${t.weight},
            ${t.notes}, ${t.ref_number},
            ${t.trade_timestamp ? new Date(t.trade_timestamp).toISOString() : null},
            ${t.zar_per_troy_ounce}, ${t.zar_to_usd}, ${t.requested_zar_per_gram},
            ${t.zar_per_troy_ounce_confirmed}, ${t.zar_to_usd_confirmed},
            ${t.usd_per_troy_ounce_confirmed}, ${t.evo_exported || false}, NOW())
          ON CONFLICT (directus_id) DO UPDATE SET
            status = EXCLUDED.status,
            company_id = EXCLUDED.company_id,
            weight = EXCLUDED.weight,
            notes = EXCLUDED.notes,
            ref_number = EXCLUDED.ref_number,
            trade_timestamp = EXCLUDED.trade_timestamp,
            zar_per_troy_ounce = EXCLUDED.zar_per_troy_ounce,
            zar_to_usd = EXCLUDED.zar_to_usd,
            requested_zar_per_gram = EXCLUDED.requested_zar_per_gram,
            zar_per_troy_ounce_confirmed = EXCLUDED.zar_per_troy_ounce_confirmed,
            zar_to_usd_confirmed = EXCLUDED.zar_to_usd_confirmed,
            usd_per_troy_ounce_confirmed = EXCLUDED.usd_per_troy_ounce_confirmed,
            evo_exported = EXCLUDED.evo_exported,
            synced_at = NOW()
        `);
        tradesInserted++;
      }
    }
    result.trades = {
      fetched: tradeResult.trades.length,
      synced: tradesInserted,
      incremental: !!lastSync,
    };

    // Optionally sync weight transactions
    if (includeWeight) {
      const wtResult = await fetchAllWeightTransactions(config);
      let wtInserted = 0;
      if (wtResult.ok) {
        for (const w of wtResult.transactions) {
          await (db as any).execute(sql`
            INSERT INTO trademc_weight_transactions (directus_id, company_id, trade_id,
              type, weight, gold_percentage, rolling_balance, notes, pc_code,
              transaction_timestamp, synced_at)
            VALUES (${w.id}, ${w.company_id}, ${w.trade_id}, ${w.type},
              ${w.weight}, ${w.gold_percentage}, ${w.rolling_balance},
              ${w.notes}, ${w.pc_code},
              ${w.transaction_timestamp ? new Date(w.transaction_timestamp).toISOString() : null},
              NOW())
            ON CONFLICT (directus_id) DO UPDATE SET
              company_id = EXCLUDED.company_id,
              trade_id = EXCLUDED.trade_id,
              type = EXCLUDED.type,
              weight = EXCLUDED.weight,
              gold_percentage = EXCLUDED.gold_percentage,
              rolling_balance = EXCLUDED.rolling_balance,
              notes = EXCLUDED.notes,
              pc_code = EXCLUDED.pc_code,
              transaction_timestamp = EXCLUDED.transaction_timestamp,
              synced_at = NOW()
          `);
          wtInserted++;
        }
      }
      result.weightTransactions = { fetched: wtResult.transactions.length, synced: wtInserted };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("TradeMC sync error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
