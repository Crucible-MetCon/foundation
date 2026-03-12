import { NextRequest, NextResponse } from "next/server";
import { fetchLivePrices, type TradeMcConfig } from "@foundation/integrations";

function getTmcConfig(): TradeMcConfig {
  return {
    baseUrl: process.env.TRADEMC_BASE_URL || "https://trademc-admin.metcon.co.za",
    apiKey: process.env.TRADEMC_API_KEY || "",
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";
    const config = getTmcConfig();

    if (!config.apiKey) {
      return NextResponse.json(
        { ok: false, error: "TRADEMC_API_KEY not configured" },
        { status: 500 }
      );
    }

    const prices = await fetchLivePrices(config, force);
    return NextResponse.json(prices);
  } catch (error) {
    console.error("Live prices error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
