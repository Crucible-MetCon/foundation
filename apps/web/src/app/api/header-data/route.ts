import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { fetchLivePrices, type TradeMcConfig } from "@foundation/integrations";

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
 */
export async function GET() {
  try {
    // Fetch prices and pending grams in parallel
    const [pricesResult, pendingResult] = await Promise.all([
      // Live prices (has its own 15s server-side cache)
      fetchLivePrices(getTmcConfig()).catch(() => null),

      // Pending TradeMC trade grams
      (db as any)
        .execute(
          sql`SELECT COALESCE(SUM(weight::float8), 0) AS pending_grams
              FROM trademc_trades
              WHERE LOWER(status) = 'pending'`,
        )
        .catch(() => null),
    ]);

    const pendingRow = pendingResult ? (pendingResult as any[])[0] : null;

    return NextResponse.json({
      ok: true,
      prices: {
        xauUsd: pricesResult?.xauUsd ?? 0,
        usdZar: pricesResult?.usdZar ?? 0,
        timestamp: pricesResult?.timestamp ?? null,
      },
      pendingGrams: parseFloat(pendingRow?.pending_grams) || 0,
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
