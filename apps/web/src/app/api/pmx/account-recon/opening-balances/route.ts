import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const result = await (db as any).execute(sql`
      SELECT id, month, currency, opening_balance::float8 as opening_balance, updated_at
      FROM account_opening_balances
      ORDER BY month DESC, currency ASC
    `);

    return NextResponse.json({ ok: true, rows: result });
  } catch (error) {
    console.error("Opening balances error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed", rows: [] },
      { status: 500 }
    );
  }
}
