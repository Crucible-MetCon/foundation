import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const refFilter = searchParams.get("refFilter") || "";
    const companyId = searchParams.get("companyId") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    let query = `
      SELECT t.*, c.company_name, c.refining_rate AS company_refining_rate
      FROM trademc_trades t
      LEFT JOIN trademc_companies c ON t.company_id = c.directus_id
      WHERE 1=1
    `;

    if (status) query += ` AND t.status = '${status.replace(/'/g, "''")}'`;
    if (refFilter) query += ` AND UPPER(COALESCE(t.ref_number, '')) LIKE '%${refFilter.toUpperCase().replace(/'/g, "''")}%'`;
    if (companyId) query += ` AND t.company_id = ${parseInt(companyId, 10)}`;
    if (startDate) query += ` AND t.trade_timestamp >= '${startDate}'::timestamptz`;
    if (endDate) query += ` AND t.trade_timestamp <= '${endDate}'::timestamptz + interval '1 day'`;
    query += ` ORDER BY t.trade_timestamp DESC`;

    const result = await (db as any).execute(sql.raw(query));
    return NextResponse.json({ ok: true, trades: result });
  } catch (error) {
    console.error("TradeMC trades error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
