import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const month = String(body.month || "").trim();
    const currency = String(body.currency || "").trim().toUpperCase();

    if (!month || !currency || !["XAU", "USD", "ZAR"].includes(currency)) {
      return NextResponse.json(
        { ok: false, error: "month and currency (XAU/USD/ZAR) are required" },
        { status: 400 }
      );
    }

    let openingBalance: number;
    try {
      openingBalance = parseFloat(body.opening_balance) || 0;
    } catch {
      return NextResponse.json(
        { ok: false, error: "opening_balance must be a number" },
        { status: 400 }
      );
    }

    await (db as any).execute(sql`
      INSERT INTO account_opening_balances (month, currency, opening_balance, updated_at)
      VALUES (${month}, ${currency}, ${openingBalance}, NOW())
      ON CONFLICT (month, currency) DO UPDATE SET
        opening_balance = EXCLUDED.opening_balance,
        updated_at = NOW()
    `);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Set opening balance error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
