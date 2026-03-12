import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId") || "";
    const type = searchParams.get("type") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    let query = `
      SELECT w.*, c.company_name
      FROM trademc_weight_transactions w
      LEFT JOIN trademc_companies c ON w.company_id = c.directus_id
      WHERE 1=1
    `;

    if (companyId) query += ` AND w.company_id = ${parseInt(companyId, 10)}`;
    if (type) query += ` AND w.type = '${type.replace(/'/g, "''")}'`;
    if (startDate) query += ` AND w.transaction_timestamp >= '${startDate}'::timestamptz`;
    if (endDate) query += ` AND w.transaction_timestamp <= '${endDate}'::timestamptz + interval '1 day'`;
    query += ` ORDER BY w.transaction_timestamp DESC`;

    const result = await (db as any).execute(sql.raw(query));
    return NextResponse.json({ ok: true, transactions: result });
  } catch (error) {
    console.error("Weight transactions error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
