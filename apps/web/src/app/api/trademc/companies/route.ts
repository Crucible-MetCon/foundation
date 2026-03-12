import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const result = await (db as any).execute(
      sql`SELECT * FROM trademc_companies ORDER BY company_name ASC`
    );
    return NextResponse.json({ ok: true, companies: result });
  } catch (error) {
    console.error("Companies error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
