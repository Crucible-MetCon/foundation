import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { fetchLivePrices, type TradeMcConfig } from "@foundation/integrations";

const GRAMS_PER_TROY_OUNCE = 31.1035;

// Ensure daily_max_exposure table exists
let exposureTableReady = false;
async function ensureExposureTable() {
  if (exposureTableReady) return;
  await (db as any).execute(sql`
    CREATE TABLE IF NOT EXISTS daily_max_exposure (
      id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      date DATE NOT NULL UNIQUE,
      max_exposure_zar NUMERIC(18,2) NOT NULL,
      recorded_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  exposureTableReady = true;
}

function getTmcConfig(): TradeMcConfig {
  return {
    baseUrl: process.env.TRADEMC_BASE_URL || "https://trademc-admin.metcon.co.za",
    apiKey: process.env.TRADEMC_API_KEY || "",
  };
}

/**
 * GET /api/header-data
 *
 * Returns live metal/FX prices and pending TradeMC grams
 * for the global header ticker. Designed to be polled every 60s.
 * Also records the current exposure as a daily max snapshot.
 */
export async function GET() {
  try {
    // Fetch prices and pending grams in parallel
    const [pricesResult, pendingResult] = await Promise.all([
      fetchLivePrices(getTmcConfig()).catch(() => null),
      (db as any)
        .execute(
          sql`SELECT COALESCE(SUM(weight::float8), 0) AS pending_grams
              FROM trademc_trades
              WHERE LOWER(status) = 'pending'`,
        )
        .catch(() => null),
    ]);

    const pendingRow = pendingResult ? (pendingResult as any[])[0] : null;
    const pendingGrams = parseFloat(pendingRow?.pending_grams) || 0;
    const xauUsd = pricesResult?.xauUsd ?? 0;
    const usdZar = pricesResult?.usdZar ?? 0;

    // Record daily max exposure (fire-and-forget, non-blocking)
    if (pendingGrams > 0 && xauUsd > 0 && usdZar > 0) {
      const exposureZar = pendingGrams * (xauUsd * usdZar / GRAMS_PER_TROY_OUNCE);
      const rounded = Math.round(exposureZar * 100) / 100;
      ensureExposureTable()
        .then(() =>
          (db as any).execute(sql`
            INSERT INTO daily_max_exposure (date, max_exposure_zar)
            VALUES (CURRENT_DATE, ${rounded})
            ON CONFLICT (date) DO UPDATE
            SET max_exposure_zar = GREATEST(daily_max_exposure.max_exposure_zar, ${rounded}),
                recorded_at = NOW()
          `),
        )
        .catch((err: any) => console.error("Exposure record error:", err));
    }

    return NextResponse.json({
      ok: true,
      prices: {
        xauUsd,
        usdZar,
        timestamp: pricesResult?.timestamp ?? null,
      },
      pendingGrams,
    });
  } catch (error) {
    console.error("Header data error:", error);
    return NextResponse.json(
      {
        ok: false,
        prices: { xauUsd: 0, usdZar: 0, timestamp: null },
        pendingGrams: 0,
      },
      { status: 500 },
    );
  }
}
